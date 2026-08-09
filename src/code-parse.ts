/**
 * Parse edited ggpbi code back into a spec — the other half of codegen.
 *
 * The debug view shows the fluent chain behind a chart; this module lets an
 * edited version of that chain change the chart. Two constraints shape it:
 *
 * - **No eval.** Power BI certification forbids `eval`/`new Function` inside
 *   the visual, so this is a real (small) recursive-descent parser for
 *   exactly the grammar `specToCode` emits: a fluent chain of known methods
 *   whose arguments are strings, numbers, booleans, object literals,
 *   arrays and `new Date('…')`.
 * - **The generated code is lossy.** Long arrays are elided
 *   (`[/* 32 values *\/]`), functions appear as placeholders, layer-local
 *   aesthetics and stats are never printed. Whatever the code cannot
 *   express is inherited from the live spec on apply, so applying the
 *   generated code unchanged is a no-op.
 */
import type { PlotSpec, AesMapping, Layer, GeomConfig } from './types';
import type { CodeFieldLabels } from './codegen';

// ---------------------------------------------------------------------------
// Sentinels — values the code shows but cannot spell out
// ---------------------------------------------------------------------------

/** An elided array (`[/* 32 values *\/]`) — resolved from the live spec. */
export const ELIDED = Symbol('ggpbi.elided');
/** A function placeholder (`d => …`) — resolved from the live spec. */
export const FUNC = Symbol('ggpbi.func');

// ---------------------------------------------------------------------------
// The parsed result
// ---------------------------------------------------------------------------

/** What the edited code expressed. A missing key means the call was absent. */
export interface CodePatch {
  aes?: Record<string, unknown>;
  /** One entry per `.geom(…)` call, in order. Always present after parse. */
  layers: Array<{ type: string; opts: Record<string, unknown> }>;
  scales?: Record<string, unknown>;
  facet?: Record<string, unknown>;
  highlight?: Record<string, unknown> | typeof FUNC;
  theme?: Record<string, unknown> | typeof FUNC;
  subtitle?: string;
  format?: Record<string, unknown>;
  /** `.size(w, h)` — kept for library callers; the visual follows its viewport. */
  size?: { width: number; height: number };
}

export type ParseResult =
  | { ok: true; patch: CodePatch }
  | { ok: false; error: string; line: number };

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type TokKind = 'punct' | 'string' | 'number' | 'ident' | 'comment' | 'arrow' | 'op';

interface Tok {
  kind: TokKind;
  text: string;
  line: number;
}

class ParseError extends Error {
  constructor(message: string, public line: number) {
    super(message);
  }
}

function tokenize(code: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let line = 1;

  while (i < code.length) {
    const ch = code[i];
    if (ch === '\n') { line++; i++; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue; }

    if (ch === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i);
      toks.push({ kind: 'comment', text: code.slice(i, end === -1 ? code.length : end), line });
      i = end === -1 ? code.length : end;
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      if (end === -1) throw new ParseError('unterminated /* comment', line);
      const text = code.slice(i, end + 2);
      line += text.split('\n').length - 1;
      toks.push({ kind: 'comment', text, line });
      i = end + 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
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
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(code[i + 1] ?? ''))) {
      const m = /-?\d+(?:\.\d+)?/y;
      m.lastIndex = i;
      const hit = m.exec(code)!;
      toks.push({ kind: 'number', text: hit[0], line });
      i += hit[0].length;
      continue;
    }
    if (/[a-zA-Z_$]/.test(ch)) {
      const m = /[a-zA-Z_$][\w$]*/y;
      m.lastIndex = i;
      const hit = m.exec(code)!;
      toks.push({ kind: 'ident', text: hit[0], line });
      i += hit[0].length;
      continue;
    }
    if (ch === '=' && code[i + 1] === '>') {
      toks.push({ kind: 'arrow', text: '=>', line });
      i += 2;
      continue;
    }
    if ('{}()[].,:;'.includes(ch)) {
      toks.push({ kind: 'punct', text: ch, line });
      i += 1;
      continue;
    }
    // Operators appear only inside skipped function bodies; parseValue
    // rejects them anywhere a value is expected.
    if ('+-*/%<>=&|!?'.includes(ch)) {
      const m = /[+\-*/%<>=&|!?]+/y;
      m.lastIndex = i;
      const hit = m.exec(code)!;
      toks.push({ kind: 'op', text: hit[0], line });
      i += hit[0].length;
      continue;
    }
    throw new ParseError(`unexpected character "${ch}"`, line);
  }
  return toks;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export const KNOWN_METHODS = new Set([
  'data', 'aes', 'geom', 'scale', 'facet', 'highlight',
  'theme', 'subtitle', 'format', 'size', 'renderTo',
]);

const ELIDED_COMMENT = /^\/\*\s*[\d,.]+\s+values\s*\*\/$/;

class Parser {
  private pos = 0;
  constructor(private toks: Tok[]) {}

  /** Next non-comment token, or undefined at the end. */
  private peek(offset = 0): Tok | undefined {
    let seen = 0;
    for (let p = this.pos; p < this.toks.length; p++) {
      if (this.toks[p].kind === 'comment') continue;
      if (seen === offset) return this.toks[p];
      seen++;
    }
    return undefined;
  }

  /** The raw next token including comments — for the elided-array marker. */
  private peekRaw(): Tok | undefined {
    return this.toks[this.pos];
  }

  private next(): Tok {
    while (this.toks[this.pos]?.kind === 'comment') this.pos++;
    const t = this.toks[this.pos];
    if (!t) throw new ParseError('unexpected end of code', this.lastLine());
    this.pos++;
    return t;
  }

  private nextRaw(): Tok {
    const t = this.toks[this.pos];
    if (!t) throw new ParseError('unexpected end of code', this.lastLine());
    this.pos++;
    return t;
  }

  private lastLine(): number {
    return this.toks[this.toks.length - 1]?.line ?? 1;
  }

  private expect(text: string): Tok {
    const t = this.next();
    if (t.text !== text) throw new ParseError(`expected "${text}", found "${t.text}"`, t.line);
    return t;
  }

  parseChain(): CodePatch {
    const first = this.next();
    if (first.kind !== 'ident' || first.text !== 'ggpbi') {
      throw new ParseError('code must start with ggpbi()', first.line);
    }
    this.expect('(');
    this.expect(')');

    const patch: CodePatch = { layers: [] };

    while (this.peek()) {
      const dot = this.next();
      if (dot.text === ';') {
        if (this.peek()) throw new ParseError('nothing may follow the final ";"', this.peek()!.line);
        break;
      }
      if (dot.text !== '.') throw new ParseError(`expected ".", found "${dot.text}"`, dot.line);
      const name = this.next();
      if (name.kind !== 'ident') throw new ParseError(`expected a method name after "."`, name.line);
      if (!KNOWN_METHODS.has(name.text)) {
        throw new ParseError(
          `unknown method .${name.text}() — known: ${[...KNOWN_METHODS].map(m => `.${m}`).join(', ')}`,
          name.line,
        );
      }
      this.expect('(');
      const args = this.parseArgs();
      this.expect(')');

      switch (name.text) {
        case 'data':
        case 'renderTo':
          break; // symbolic — data and target come from the host
        case 'aes':
          patch.aes = this.wantObject(args, name);
          break;
        case 'geom': {
          const type = args[0];
          if (typeof type !== 'string') throw new ParseError(`.geom() needs a geom name string`, name.line);
          const opts = args[1] === undefined ? {} : args[1];
          if (typeof opts !== 'object' || opts === null || Array.isArray(opts)) {
            throw new ParseError(`.geom() options must be an object`, name.line);
          }
          patch.layers.push({ type, opts: opts as Record<string, unknown> });
          break;
        }
        case 'scale':
          patch.scales = this.wantObject(args, name);
          break;
        case 'facet':
          patch.facet = this.wantObject(args, name);
          break;
        case 'highlight': {
          const obj = this.wantObject(args, name);
          patch.highlight = Object.values(obj).includes(FUNC) ? FUNC : obj;
          break;
        }
        case 'theme':
          // `.theme(themeDark())` parses as an opaque call — keep the live
          // theme rather than failing on code the demo legitimately writes.
          patch.theme = args[0] === FUNC ? FUNC : this.wantObject(args, name);
          break;
        case 'subtitle': {
          if (typeof args[0] !== 'string') throw new ParseError(`.subtitle() needs a string`, name.line);
          patch.subtitle = args[0];
          break;
        }
        case 'format':
          patch.format = this.wantObject(args, name);
          break;
        case 'size': {
          const [w, h] = args;
          if (typeof w !== 'number' || typeof h !== 'number') {
            throw new ParseError(`.size() needs two numbers`, name.line);
          }
          patch.size = { width: w, height: h };
          break;
        }
      }
    }
    return patch;
  }

  private wantObject(args: unknown[], at: Tok): Record<string, unknown> {
    const obj = args[0];
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj) || obj instanceof Date) {
      throw new ParseError(`.${at.text}() needs an object literal`, at.line);
    }
    return obj as Record<string, unknown>;
  }

  private parseArgs(): unknown[] {
    const args: unknown[] = [];
    if (this.peek()?.text === ')') return args;
    for (;;) {
      args.push(this.parseValue());
      if (this.peek()?.text === ',') { this.next(); continue; }
      return args;
    }
  }

  private parseValue(): unknown {
    const t = this.next();

    if (t.kind === 'string') return t.text;
    if (t.kind === 'number') return parseFloat(t.text);

    if (t.kind === 'ident') {
      if (t.text === 'true') return true;
      if (t.text === 'false') return false;
      if (t.text === 'null') return null;
      if (t.text === 'undefined') return undefined;
      if (t.text === 'new') {
        const ctor = this.next();
        if (ctor.text !== 'Date') throw new ParseError(`only new Date('…') is supported`, ctor.line);
        this.expect('(');
        const arg = this.parseValue();
        this.expect(')');
        if (typeof arg !== 'string') throw new ParseError(`new Date() needs a string`, ctor.line);
        return new Date(arg);
      }
      // `d => …` — a function the code cannot carry. Skip its body without
      // running anything; the live spec supplies the real function on apply.
      if (this.peek()?.kind === 'arrow') {
        this.next(); // =>
        this.skipExpression();
        return FUNC;
      }
      // A call like `themeDark()` — consume its arguments unevaluated.
      if (this.peek()?.text === '(') {
        this.next();
        this.skipExpression();
        this.expect(')');
        return FUNC;
      }
      // A bare identifier: `data`, `element`, a dataset name in the demo.
      return FUNC;
    }

    if (t.text === '[') {
      // The elided marker is a block comment as the sole array content.
      const raw = this.peekRaw();
      if (raw?.kind === 'comment' && ELIDED_COMMENT.test(raw.text)) {
        this.nextRaw();
        this.expect(']');
        return ELIDED;
      }
      const arr: unknown[] = [];
      if (this.peek()?.text === ']') { this.next(); return arr; }
      for (;;) {
        arr.push(this.parseValue());
        const sep = this.next();
        if (sep.text === ']') return arr;
        if (sep.text !== ',') throw new ParseError(`expected "," or "]" in array`, sep.line);
        if (this.peek()?.text === ']') { this.next(); return arr; } // trailing comma
      }
    }

    if (t.text === '{') {
      const obj: Record<string, unknown> = {};
      if (this.peek()?.text === '}') { this.next(); return obj; }
      for (;;) {
        const key = this.next();
        if (key.kind !== 'ident' && key.kind !== 'string') {
          throw new ParseError(`expected a property name, found "${key.text}"`, key.line);
        }
        this.expect(':');
        obj[key.text] = this.parseValue();
        const sep = this.next();
        if (sep.text === '}') return obj;
        if (sep.text !== ',') throw new ParseError(`expected "," or "}" in object`, sep.line);
        if (this.peek()?.text === '}') { this.next(); return obj; } // trailing comma
      }
    }

    throw new ParseError(`unexpected "${t.text}"`, t.line);
  }

  /**
   * Skip one expression without interpreting it — the body of an arrow
   * function. Consumes tokens until the argument's own closing bracket or a
   * top-level comma, tracking nesting so `d => f(d.x, 2) > 3` stays whole.
   */
  private skipExpression(): void {
    let depth = 0;
    for (;;) {
      const t = this.peek();
      if (!t) return;
      if (depth === 0 && (t.text === ',' || t.text === ')' || t.text === '}' || t.text === ']')) return;
      if ('([{'.includes(t.text)) depth++;
      if (')]}'.includes(t.text)) depth--;
      this.next();
    }
  }
}

/** Parse edited code. Never throws — errors come back with a line number. */
export function parseCode(code: string): ParseResult {
  try {
    const patch = new Parser(tokenize(code)).parseChain();
    return { ok: true, patch };
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: e.message, line: e.line };
    return { ok: false, error: e instanceof Error ? e.message : String(e), line: 1 };
  }
}

// ---------------------------------------------------------------------------
// Apply — merge a patch over the live spec
// ---------------------------------------------------------------------------

/**
 * Resolve a parsed value against its live counterpart: sentinels take the
 * live value, and function-valued properties the code could never show are
 * inherited. Everything the code does express wins over the live spec.
 */
function resolve(patchVal: unknown, liveVal: unknown): unknown {
  if (patchVal === ELIDED || patchVal === FUNC) return liveVal;
  if (Array.isArray(patchVal)) {
    const liveArr = Array.isArray(liveVal) ? liveVal : [];
    return patchVal.map((v, i) => resolve(v, liveArr[i]));
  }
  if (patchVal && typeof patchVal === 'object' && !(patchVal instanceof Date)) {
    const liveObj =
      liveVal && typeof liveVal === 'object' && !Array.isArray(liveVal)
        ? (liveVal as Record<string, unknown>)
        : undefined;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patchVal as Record<string, unknown>)) {
      out[k] = resolve(v, liveObj?.[k]);
    }
    if (liveObj) {
      for (const [k, v] of Object.entries(liveObj)) {
        if (typeof v === 'function' && !(k in out)) out[k] = v;
      }
    }
    return out;
  }
  return patchVal;
}

/** Map the display names the code shows back to the fields the data carries. */
function mergeAes(
  liveAes: AesMapping,
  patchAes: Record<string, unknown>,
  labels: CodeFieldLabels,
): AesMapping {
  const out: Record<string, unknown> = {};
  const live = liveAes as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(patchAes)) {
    const label = (labels as Record<string, string | undefined>)[key];
    out[key] =
      label !== undefined && value === label && typeof live[key] === 'string'
        ? live[key]
        : resolve(value, live[key]);
  }
  // Synthetic fields the pipeline invented never appear in the code; losing
  // them would break the chart the user did not mean to touch.
  for (const [key, value] of Object.entries(live)) {
    if (!(key in out) && typeof value === 'string' && value.startsWith('__')) out[key] = value;
  }
  return out as unknown as AesMapping;
}

function mergeLayers(
  liveLayers: Layer[],
  patchLayers: CodePatch['layers'],
): Layer[] {
  return patchLayers.map((pl, i) => {
    const liveLayer = liveLayers[i];
    const sameType = liveLayer?.geom.type === pl.type;
    const base = sameType ? (liveLayer.geom as unknown as Record<string, unknown>) : undefined;
    const geom = resolve(pl.opts, base) as Record<string, unknown>;
    geom.type = pl.type;
    // Layer-local aes and stat are never printed; they only make sense for
    // the geom they were built for, so they follow an unchanged type.
    const layer: Layer = { geom: geom as unknown as GeomConfig };
    if (sameType && liveLayer.stat !== undefined) layer.stat = liveLayer.stat;
    if (sameType && liveLayer.aes !== undefined) layer.aes = liveLayer.aes;
    return layer;
  });
}

function mergeHighlight(
  live: PlotSpec['highlight'],
  patchHl: CodePatch['highlight'],
  aes: AesMapping,
): PlotSpec['highlight'] {
  if (patchHl === FUNC) return live; // placeholder kept → keep the live filter
  const values = patchHl && (patchHl as { values?: unknown }).values;
  if (Array.isArray(values)) {
    const colorField = typeof aes.color === 'string' ? aes.color : undefined;
    if (!colorField) return undefined; // nothing to match the values against
    const wanted = values.map(String);
    return {
      filter: (d) => wanted.includes(String(d[colorField])),
      ...(typeof (patchHl as { color?: unknown }).color === 'string'
        ? { color: (patchHl as { color: string }).color }
        : live?.color !== undefined
          ? { color: live.color }
          : {}),
    };
  }
  return undefined;
}

/**
 * Apply an edited-code patch to the live spec.
 *
 * The live spec keeps everything the code cannot express: the data itself,
 * host services, selection, viewport size, field labels. The patch owns the
 * declarative story — aes, layers, scales, facet, theme, subtitle — and a
 * call deleted from the code is gone from the chart.
 */
export function applyCodeEdit(
  live: PlotSpec,
  patch: CodePatch,
  labels: CodeFieldLabels = {},
): PlotSpec {
  const spec: PlotSpec = { ...live };

  if (patch.aes) spec.aes = mergeAes(live.aes, patch.aes, labels);
  spec.layers = mergeLayers(live.layers, patch.layers);

  spec.scales = patch.scales
    ? (resolve(patch.scales, live.scales) as PlotSpec['scales'])
    : undefined;
  spec.facet = patch.facet
    ? (resolve(patch.facet, live.facet) as PlotSpec['facet'])
    : undefined;
  spec.theme = patch.theme === FUNC
    ? live.theme
    : patch.theme
      ? (resolve(patch.theme, live.theme) as PlotSpec['theme'])
      : undefined;
  // Host-owned theme values are greyed in the editor and mean it: the
  // report palette and contrast state always come from the live chart,
  // whatever the edited text says.
  if (spec.theme && live.theme) {
    for (const key of ['colorPalette', 'isHighContrast'] as const) {
      const liveValue = (live.theme as Record<string, unknown>)[key];
      if (liveValue !== undefined) (spec.theme as Record<string, unknown>)[key] = liveValue;
      else delete (spec.theme as Record<string, unknown>)[key];
    }
  }
  spec.highlight = mergeHighlight(live.highlight, patch.highlight, spec.aes);

  // `subtitle: 'auto'` is never printed, so its absence from the code is not
  // a deletion — only an explicit subtitle can be deleted by removing it.
  spec.subtitle = patch.subtitle !== undefined
    ? patch.subtitle
    : live.subtitle === 'auto' || live.subtitle === 'always'
      ? live.subtitle
      : undefined;

  // The code only ever shows the locale; currency and other host-supplied
  // format details merge underneath instead of being wiped — and the
  // locale itself is host-owned: greyed in the editor, kept from live.
  if (patch.format) {
    spec.format = { ...live.format, ...(resolve(patch.format, live.format) as object) };
    if (live.format?.locale !== undefined) spec.format.locale = live.format.locale;
  }

  // An edited x/y field makes the well-derived axis titles wrong — drop
  // them and let the pipeline derive titles from the new fields.
  if (spec.aes.x !== live.aes.x) delete spec.xLabel;
  if (spec.aes.y !== live.aes.y) delete spec.yLabel;

  return spec;
}
