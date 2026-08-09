/**
 * Parse ggplot2 (R) code into the same CodePatch the ggpbi parser emits.
 *
 * The second dialect of the editor: `r-codegen.ts` writes it, this reads
 * it — and because both parsers produce one CodePatch shape, everything
 * downstream (merge over the live spec, Format Pane write-back) is
 * shared. Like the ggpbi parser it is a real recursive-descent parser,
 * no eval, and it reads the dialect specToR emits plus the ggplot2
 * spellings people actually paste: positional `aes(wt, mpg)`,
 * `geom_bar(stat = "identity")`, numeric shapes and linetypes,
 * `theme_minimal()`, `scale_y_log10()`.
 *
 * Unknown constructs fail loudly with a line number — a silently
 * dropped `+ stat_summary(...)` would lie about what the chart shows.
 */
import { ELIDED, FUNC, type CodePatch, type ParseResult } from './code-parse';
import { GEOM_TO_R } from './r-codegen';
import { themeDark, themeMinimal } from './theme';

// --- Vocabulary -------------------------------------------------------------

/** ggplot2 geom function → ggpbi geom type (inverse of GEOM_TO_R). */
const R_TO_GEOM: Record<string, string> = Object.fromEntries(
  Object.entries(GEOM_TO_R).map(([type, fn]) => [fn, type]),
);

/** R aes argument → ggpbi aesthetic. */
const R_AES: Record<string, string> = {
  x: 'x', y: 'y', colour: 'color', color: 'color', fill: 'fill',
  size: 'size', shape: 'shape', alpha: 'alpha', group: 'group',
  label: 'label', xend: 'xend', yend: 'yend',
  xmin: 'xmin', xmax: 'xmax', ymin: 'ymin', ymax: 'ymax',
};

/** Positional aes arguments, the ggplot2 way: aes(wt, mpg). */
const AES_POSITIONAL = ['x', 'y'];

/** R geom argument → ggpbi option (only where they differ). */
const R_OPT: Record<string, string> = { colour: 'color' };

/** R pch numbers → ggpbi shape names. */
const R_SHAPES: Record<number, string> = {
  16: 'circle', 15: 'square', 17: 'triangle', 18: 'diamond',
  1: 'circleOpen', 0: 'squareOpen', 2: 'triangleOpen', 5: 'diamondOpen',
  21: 'circleFilled', 22: 'squareFilled', 24: 'triangleFilled', 23: 'diamondFilled',
  3: 'plus', 4: 'cross', 8: 'asterisk', 11: 'star',
};

/** R linetype numbers → names. */
const R_LINETYPES: Record<number, string> = {
  1: 'solid', 2: 'dashed', 3: 'dotted', 4: 'dashdot', 5: 'longdash', 6: 'twodash',
};

// --- Tokenizer --------------------------------------------------------------

type TokKind = 'punct' | 'string' | 'number' | 'ident' | 'formula';

interface Tok { kind: TokKind; text: string; line: number }

class ParseError extends Error {
  constructor(message: string, public line: number) { super(message); }
}

function tokenize(code: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let line = 1;

  while (i < code.length) {
    const ch = code[i];
    if (ch === '\n') { line++; i++; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue; }
    if (ch === '#') {
      const end = code.indexOf('\n', i);
      i = end === -1 ? code.length : end;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      let out = '';
      while (j < code.length && code[j] !== ch) {
        if (code[j] === '\\') {
          const esc = code[j + 1];
          out += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc;
          j += 2;
        } else {
          if (code[j] === '\n') throw new ParseError('unterminated string', line);
          out += code[j];
          j += 1;
        }
      }
      if (j >= code.length) throw new ParseError('unterminated string', line);
      toks.push({ kind: 'string', text: out, line });
      i = j + 1;
      continue;
    }
    if (ch === '`') {
      const end = code.indexOf('`', i + 1);
      if (end === -1) throw new ParseError('unterminated `name`', line);
      toks.push({ kind: 'ident', text: code.slice(i + 1, end), line });
      i = end + 1;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9.]/.test(code[i + 1] ?? '') && /[(,=~\s+]/.test(code[i - 1] ?? '('))) {
      const m = /-?(?:\d+\.?\d*|\.\d+)/y;
      m.lastIndex = i;
      const hit = m.exec(code)!;
      toks.push({ kind: 'number', text: hit[0], line });
      i += hit[0].length;
      continue;
    }
    if (/[a-zA-Z.]/.test(ch)) {
      const m = /[a-zA-Z.][\w.]*/y;
      m.lastIndex = i;
      const hit = m.exec(code)!;
      toks.push({ kind: 'ident', text: hit[0], line });
      i += hit[0].length;
      continue;
    }
    if (ch === '~') { toks.push({ kind: 'formula', text: '~', line }); i++; continue; }
    if ('(),=+'.includes(ch)) {
      toks.push({ kind: 'punct', text: ch, line });
      i += 1;
      continue;
    }
    throw new ParseError(`unexpected character "${ch}"`, line);
  }
  return toks;
}

// --- Parser -----------------------------------------------------------------

type RValue =
  | string | number | boolean | null | undefined | Date
  | RValue[] | { symbol: string } | { formula: [string | null, string | null] }
  | { call: RCall }
  | typeof FUNC | typeof ELIDED;

interface RArg { name: string | null; value: RValue; line: number }
interface RCall { fn: string; args: RArg[]; line: number }

class Parser {
  private pos = 0;
  constructor(private toks: Tok[]) {}

  private peek(): Tok | undefined { return this.toks[this.pos]; }

  private next(): Tok {
    const t = this.toks[this.pos];
    if (!t) throw new ParseError('unexpected end of code', this.toks[this.toks.length - 1]?.line ?? 1);
    this.pos++;
    return t;
  }

  private expect(text: string): Tok {
    const t = this.next();
    if (t.text !== text) throw new ParseError(`expected "${text}", found "${t.text}"`, t.line);
    return t;
  }

  /** The whole program: call (+ call)* */
  parseChain(): RCall[] {
    const calls: RCall[] = [this.parseCall()];
    while (this.peek()) {
      this.expect('+');
      calls.push(this.parseCall());
    }
    return calls;
  }

  private parseCall(): RCall {
    const name = this.next();
    if (name.kind !== 'ident') throw new ParseError(`expected a function name, found "${name.text}"`, name.line);
    this.expect('(');
    const args: RArg[] = [];
    if (this.peek()?.text !== ')') {
      for (;;) {
        args.push(this.parseArg());
        if (this.peek()?.text === ',') { this.next(); continue; }
        break;
      }
    }
    this.expect(')');
    return { fn: name.text, args, line: name.line };
  }

  private parseArg(): RArg {
    const t = this.peek()!;
    // Named argument: name = value
    if (t.kind === 'ident' && this.toks[this.pos + 1]?.text === '=') {
      this.next();
      this.next();
      return { name: t.text, value: this.parseValue(), line: t.line };
    }
    return { name: null, value: this.parseValue(), line: t.line };
  }

  private parseValue(): RValue {
    const t = this.next();

    if (t.kind === 'string') return t.text;
    if (t.kind === 'number') return parseFloat(t.text);

    if (t.kind === 'formula') {
      // ~ rhs  (lhs-less formula)
      const rhs = this.next();
      if (rhs.kind !== 'ident') throw new ParseError('expected a field after "~"', rhs.line);
      return { formula: [null, rhs.text] };
    }

    if (t.kind === 'ident') {
      if (t.text === 'TRUE' || t.text === 'T') return true;
      if (t.text === 'FALSE' || t.text === 'F') return false;
      if (t.text === 'NULL') return null;
      if (t.text === 'NA' || t.text === 'Inf') return undefined;
      if (t.text === 'c') {
        this.expect('(');
        const arr: RValue[] = [];
        if (this.peek()?.text !== ')') {
          for (;;) {
            arr.push(this.parseValue());
            if (this.peek()?.text === ',') { this.next(); continue; }
            break;
          }
        }
        this.expect(')');
        // The elided-palette comment form `c(1) # 32 values` parses as
        // c(1); comments are gone by now, so a one-element numeric vector
        // from our own generator is indistinguishable — treat literally.
        return arr;
      }
      if (t.text === 'as.Date') {
        this.expect('(');
        const v = this.parseValue();
        this.expect(')');
        if (typeof v !== 'string') throw new ParseError('as.Date() needs a string', t.line);
        return new Date(v);
      }
      // aes(...) nests inside ggplot(...) — parse it as a call value. Any
      // other call as a value (element_rect(…), stat inside a geom) is a
      // loud error; silent misreading would lie about the chart.
      if (this.peek()?.text === '(') {
        if (t.text === 'aes') {
          this.next(); // (
          const args: RArg[] = [];
          if (this.peek()?.text !== ')') {
            for (;;) {
              args.push(this.parseArg());
              if (this.peek()?.text === ',') { this.next(); continue; }
              break;
            }
          }
          this.expect(')');
          return { call: { fn: 'aes', args, line: t.line } };
        }
        throw new ParseError(
          `${t.text}(…) as an argument value is not supported — move aesthetics to the top-level aes()`,
          t.line,
        );
      }
      // lhs ~ rhs formula
      if (this.peek()?.kind === 'formula') {
        this.next();
        const rhs = this.next();
        const rhsName = rhs.text === '.' ? null : rhs.text;
        const lhsName = t.text === '.' ? null : t.text;
        if (rhs.kind !== 'ident') throw new ParseError('expected a field after "~"', rhs.line);
        return { formula: [lhsName, rhsName] };
      }
      // Bare symbol: a data-frame column (aes) or the data itself.
      return { symbol: t.text };
    }

    throw new ParseError(`unexpected "${t.text}"`, t.line);
  }
}

// --- Mapping the calls onto a CodePatch -------------------------------------

const asFieldName = (v: RValue, line: number): string => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'symbol' in v) return v.symbol;
  throw new ParseError('expected a field name', line);
};

function mapAes(call: RCall): Record<string, unknown> {
  const aes: Record<string, unknown> = {};
  let positional = 0;
  for (const arg of call.args) {
    const key = arg.name === null
      ? AES_POSITIONAL[positional++]
      : R_AES[arg.name];
    if (!key) throw new ParseError(`aes(${arg.name} = …) is not a supported aesthetic`, arg.line);
    if (arg.name === null && positional > AES_POSITIONAL.length) {
      throw new ParseError('too many positional aes() arguments — name them', arg.line);
    }
    aes[key] = asFieldName(arg.value, arg.line);
  }
  return aes;
}

function mapGeom(call: RCall): { type: string; opts: Record<string, unknown> } {
  let type = R_TO_GEOM[call.fn];
  const opts: Record<string, unknown> = {};
  for (const arg of call.args) {
    if (arg.name === null) {
      const v = arg.value;
      if (v !== null && typeof v === 'object' && 'call' in v && v.call.fn === 'aes') {
        throw new ParseError('per-layer aes() is not supported yet — move it to the top-level aes()', arg.line);
      }
      throw new ParseError(`${call.fn}() takes named arguments only in this dialect`, arg.line);
    }
    // geom_bar(stat = "identity") is geom_col by another name.
    if (call.fn === 'geom_bar' && arg.name === 'stat') {
      if (arg.value === 'identity') { type = 'col'; continue; }
      if (arg.value === 'count') continue;
      throw new ParseError(`stat = "${String(arg.value)}" is not supported`, arg.line);
    }
    const key = R_OPT[arg.name] ?? arg.name;
    let value = arg.value;
    if (key === 'shape' && typeof value === 'number') {
      const mapped = R_SHAPES[value];
      if (!mapped) throw new ParseError(`shape ${value} has no ggpbi equivalent`, arg.line);
      value = mapped;
    }
    if (key === 'linetype' && typeof value === 'number') {
      const mapped = R_LINETYPES[value];
      if (!mapped) throw new ParseError(`linetype ${value} has no ggpbi equivalent`, arg.line);
      value = mapped;
    }
    if (value !== null && typeof value === 'object'
      && ('symbol' in value || 'formula' in value || 'call' in value)) {
      throw new ParseError(
        `${call.fn}(${arg.name} = …) expects a constant — per-layer aes() is not supported yet`,
        arg.line,
      );
    }
    opts[key] = value as unknown;
  }
  return { type, opts };
}

function mapScale(call: RCall, patch: CodePatch): void {
  const m = /^scale_([xy])_(log10|continuous|sqrt)$/.exec(call.fn)!;
  const axis = m[1] as 'x' | 'y';
  const kind = m[2];
  const cfg: Record<string, unknown> = {};
  if (kind === 'log10') cfg.type = 'log';
  if (kind === 'sqrt') cfg.type = 'sqrt';
  for (const arg of call.args) {
    if (arg.name === null) throw new ParseError(`${call.fn}() takes named arguments`, arg.line);
    if (arg.name === 'limits') {
      const v = arg.value;
      if (!Array.isArray(v) || v.length !== 2) throw new ParseError('limits needs c(min, max)', arg.line);
      if (v[0] !== undefined && v[0] !== null) cfg.min = v[0];
      if (v[1] !== undefined && v[1] !== null) cfg.max = v[1];
      continue;
    }
    if (arg.name === 'trans') { cfg.type = arg.value; continue; }
    if (arg.name === 'labels') { cfg.labels = arg.value; continue; }
    if (arg.name === 'date_labels') { cfg.dateLabels = arg.value; continue; }
    cfg[arg.name] = arg.value;
  }
  patch.scales = { ...(patch.scales ?? {}), [axis]: cfg };
}

function mapFacet(call: RCall, patch: CodePatch): void {
  const facet: Record<string, unknown> = {};
  for (const arg of call.args) {
    const v = arg.value;
    if (arg.name === null) {
      if (!(v && typeof v === 'object' && 'formula' in v)) {
        throw new ParseError(`${call.fn}() expects a ~ formula`, arg.line);
      }
      const [lhs, rhs] = v.formula;
      if (call.fn === 'facet_wrap') {
        if (!rhs) throw new ParseError('facet_wrap(~ field) needs a field', arg.line);
        facet.wrap = rhs;
      } else {
        if (lhs) facet.row = lhs;
        if (rhs) facet.col = rhs;
      }
      continue;
    }
    if (arg.name === 'ncol' || arg.name === 'nrow') { facet[arg.name] = v; continue; }
    if (arg.name === 'scales') {
      if (v === 'free') { facet.freeX = true; facet.freeY = true; }
      else if (v === 'free_x') facet.freeX = true;
      else if (v === 'free_y') facet.freeY = true;
      else if (v !== 'fixed') throw new ParseError(`scales = "${String(v)}" is not supported`, arg.line);
      continue;
    }
    throw new ParseError(`${call.fn}(${arg.name} = …) is not supported`, arg.line);
  }
  patch.facet = facet;
}

/**
 * Parse ggplot2 code. Never throws — errors come back with a line number.
 */
export function parseR(code: string): ParseResult {
  try {
    const calls = new Parser(tokenize(code)).parseChain();
    const patch: CodePatch = { layers: [] };

    const first = calls[0];
    if (!first || first.fn !== 'ggplot') {
      throw new ParseError('code must start with ggplot(…)', first?.line ?? 1);
    }
    for (const arg of first.args) {
      const v = arg.value;
      if (arg.name === null && v && typeof v === 'object' && 'symbol' in v) continue; // the data
      if (v && typeof v === 'object' && 'call' in v && v.call.fn === 'aes') {
        patch.aes = mapAes(v.call);
        continue;
      }
      throw new ParseError('ggplot() takes the data and aes(…) — nothing else', arg.line);
    }

    for (const call of calls.slice(1)) {
      if (call.fn in R_TO_GEOM) {
        patch.layers.push(mapGeom(call));
        continue;
      }
      if (/^scale_[xy]_(log10|continuous|sqrt)$/.test(call.fn)) {
        mapScale(call, patch);
        continue;
      }
      if (call.fn === 'facet_wrap' || call.fn === 'facet_grid') {
        mapFacet(call, patch);
        continue;
      }
      if (call.fn === 'gghighlight') {
        const v = call.args[0]?.value;
        patch.highlight = Array.isArray(v)
          ? { values: v as unknown[] }
          : FUNC;
        continue;
      }
      if (call.fn === 'theme_ggpbi') {
        const theme: Record<string, unknown> = {};
        for (const arg of call.args) {
          if (arg.name === null) throw new ParseError('theme_ggpbi() takes named arguments', arg.line);
          theme[arg.name] = arg.value;
        }
        patch.theme = theme;
        continue;
      }
      if (call.fn === 'theme_minimal') { patch.theme = { ...themeMinimal() }; continue; }
      if (call.fn === 'theme_dark') { patch.theme = { ...themeDark() }; continue; }
      if (call.fn === 'theme_grey' || call.fn === 'theme_gray' || call.fn === 'theme_bw') {
        patch.theme = {};
        continue;
      }
      if (call.fn === 'labs') {
        for (const arg of call.args) {
          if (arg.name === 'subtitle' && typeof arg.value === 'string') {
            patch.subtitle = arg.value;
          } else {
            throw new ParseError(
              `labs(${arg.name ?? '…'} = …) is not supported — titles and axis labels come from Power BI`,
              arg.line,
            );
          }
        }
        continue;
      }
      throw new ParseError(
        `+ ${call.fn}(…) is not supported in this dialect`,
        call.line,
      );
    }
    return { ok: true, patch };
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: e.message, line: e.line };
    return { ok: false, error: e instanceof Error ? e.message : String(e), line: 1 };
  }
}
