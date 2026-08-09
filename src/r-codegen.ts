/**
 * Turn a PlotSpec into the ggplot2 (R) code that would produce it.
 *
 * The second dialect of the code view: where `specToCode` speaks the
 * fluent ggpbi chain, this speaks ggplot2 — the language the grammar was
 * learned from. The same two honesty rules apply: field names are the
 * ones in the wells, and only non-defaults are emitted.
 *
 * It is a dialect, not an R interpreter: the code shown is real ggplot2
 * wherever a true equivalent exists (`scale_y_log10()`,
 * `facet_wrap(~ cyl, ncol = 3)`, `theme_minimal()`), and carries
 * ggpbi-flavoured arguments where ggplot2 has no direct slice
 * (`labels = "compact"`). r-parse.ts reads exactly this dialect back.
 */
import type { PlotSpec, GeomConfig, AesMapping, AxisScaleConfig, ScaleType } from './types';
import type { CodeFieldLabels, CodeToken, TokenKind } from './codegen';

/** ggpbi aesthetic → ggplot2 aes() argument name. */
const AES_TO_R: Array<[keyof AesMapping, string]> = [
  ['x', 'x'], ['y', 'y'], ['color', 'colour'], ['fill', 'fill'],
  ['size', 'size'], ['shape', 'shape'], ['alpha', 'alpha'], ['group', 'group'],
  ['label', 'label'], ['xend', 'xend'], ['yend', 'yend'],
  ['xmin', 'xmin'], ['xmax', 'xmax'], ['ymin', 'ymin'], ['ymax', 'ymax'],
];

/** ggpbi geom type → ggplot2 geom function. */
export const GEOM_TO_R: Record<string, string> = {
  point: 'geom_point', line: 'geom_line', bar: 'geom_bar', col: 'geom_col',
  area: 'geom_area', text: 'geom_text', boxplot: 'geom_boxplot',
  histogram: 'geom_histogram', smooth: 'geom_smooth', density: 'geom_density',
  violin: 'geom_violin', hline: 'geom_hline', vline: 'geom_vline',
  abline: 'geom_abline', segment: 'geom_segment', pointrange: 'geom_pointrange',
};

/** Geom option name → ggplot2 argument name (only where they differ). */
const OPT_TO_R: Record<string, string> = {
  color: 'colour',
  lineend: 'lineend',
  linejoin: 'linejoin',
};

/** Options that never appear in R code — internals or host-owned. */
const SKIP_OPT = new Set(['type', 'aes', 'stat', 'applyHighlight', 'naRm']);

const GEOM_DEFAULTS: Record<string, unknown> = {
  position: 'identity', alpha: 1, repel: false, orientation: 'x',
  linetype: 'solid', shape: 'circle', notch: false, varwidth: false, se: true,
};

/** A bare R name, backtick-quoted when it needs to be. */
const rName = (name: string): string =>
  /^[a-zA-Z.][\w.]*$/.test(name) ? name : `\`${name.replace(/`/g, '')}\``;

const rString = (s: string): string => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

function rValue(value: unknown): string {
  if (typeof value === 'string') return rString(value);
  if (typeof value === 'number') return String(Math.round(value * 1000) / 1000);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return `as.Date(${rString(value.toISOString().slice(0, 10))})`;
  if (Array.isArray(value)) return `c(${value.map(rValue).join(', ')})`;
  return String(value);
}

function fieldName(aes: AesMapping, key: keyof AesMapping, labels: CodeFieldLabels): string | undefined {
  const bound = aes[key];
  if (typeof bound !== 'string' || !bound || bound.startsWith('__')) return undefined;
  return (labels as Record<string, string | undefined>)[key] ?? bound;
}

function geomArgs(geom: GeomConfig): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(geom as unknown as Record<string, unknown>)) {
    if (SKIP_OPT.has(key)) continue;
    if (value === undefined || value === null || value === '') continue;
    if (key in GEOM_DEFAULTS && GEOM_DEFAULTS[key] === value) continue;
    if (typeof value === 'function') continue;
    parts.push(`${OPT_TO_R[key] ?? key} = ${rValue(value)}`);
  }
  return parts.join(', ');
}

function scaleLine(axis: 'x' | 'y', cfg: ScaleType | AxisScaleConfig | undefined): string | undefined {
  if (!cfg) return undefined;
  const conf: AxisScaleConfig = typeof cfg === 'string' ? { type: cfg } : cfg;
  const args: string[] = [];
  const type = conf.type && (conf.type as string) !== 'auto' ? conf.type : undefined;
  if (type === 'log') {
    // Real ggplot2 — extra arguments ride along.
    for (const [key, value] of Object.entries(conf)) {
      if (key === 'type' || value === undefined || value === null || value === '') continue;
      if (typeof value === 'function') continue;
      if (key === 'min' || key === 'max') continue; // handled via limits below
      args.push(`${key} = ${rValue(value)}`);
    }
    const limits = limitsArg(conf);
    if (limits) args.push(limits);
    return `scale_${axis}_log10(${args.join(', ')})`;
  }
  for (const [key, value] of Object.entries(conf)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'function') continue;
    if (key === 'type') { if (type) args.push(`trans = ${rString(type)}`); continue; }
    if (key === 'labels') { args.push(`labels = ${rString(String(value))}`); continue; }
    if (key === 'dateLabels') { args.push(`date_labels = ${rString(String(value))}`); continue; }
    if (key === 'min' || key === 'max') continue;
    args.push(`${key} = ${rValue(value)}`);
  }
  const limits = limitsArg(conf);
  if (limits) args.push(limits);
  if (args.length === 0) return undefined;
  return `scale_${axis}_continuous(${args.join(', ')})`;
}

function limitsArg(conf: AxisScaleConfig): string | undefined {
  const { min, max } = conf as { min?: unknown; max?: unknown };
  if (min === undefined && max === undefined) return undefined;
  const lo = min === undefined ? 'NA' : rValue(min);
  const hi = max === undefined ? 'NA' : rValue(max);
  return `limits = c(${lo}, ${hi})`;
}

/**
 * Generate ggplot2 code for a spec — the R sibling of `specToCode`.
 */
export function specToR(spec: PlotSpec, labels: CodeFieldLabels = {}): string {
  const aesParts: string[] = [];
  for (const [key, rArg] of AES_TO_R) {
    const name = fieldName(spec.aes, key, labels);
    if (name) aesParts.push(`${rArg} = ${rName(name)}`);
  }

  const lines: string[] = [`ggplot(data, aes(${aesParts.join(', ')}))`];

  for (const layer of spec.layers) {
    const fn = GEOM_TO_R[layer.geom.type];
    if (!fn) continue;
    lines.push(`  ${fn}(${geomArgs(layer.geom)})`);
  }

  for (const axis of ['x', 'y'] as const) {
    const line = scaleLine(axis, spec.scales?.[axis]);
    if (line) lines.push(`  ${line}`);
  }

  if (spec.facet) {
    const { wrap, row, col, ncol, nrow, freeX, freeY } = spec.facet;
    const scalesArg =
      freeX && freeY ? ', scales = "free"'
        : freeX ? ', scales = "free_x"'
          : freeY ? ', scales = "free_y"' : '';
    if (wrap) {
      const extra = ncol ? `, ncol = ${ncol}` : nrow ? `, nrow = ${nrow}` : '';
      lines.push(`  facet_wrap(~ ${rName(wrap)}${extra}${scalesArg})`);
    } else if (row || col) {
      lines.push(`  facet_grid(${row ? rName(row) : '.'} ~ ${col ? rName(col) : '.'}${scalesArg})`);
    }
  }

  if (spec.highlight) {
    const values = (spec.highlight as { values?: unknown[] }).values;
    lines.push(Array.isArray(values)
      ? `  gghighlight(${rValue(values)})`
      : '  gghighlight() # filter from the live chart');
  }

  if (spec.theme && Object.keys(spec.theme).length > 0) {
    const entries = Object.entries(spec.theme as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null && v !== '' && typeof v !== 'function');
    const host = entries.filter(([k]) => k === 'colorPalette' || k === 'isHighContrast');
    const own = entries.filter(([k]) => k !== 'colorPalette' && k !== 'isHighContrast');
    if (host.length > 0) {
      // Host-owned values on their own lines — shown whole, greyed in the
      // editor, not yours to change.
      const inner = [...host, ...own].map(([k, v]) => `    ${k} = ${rValue(v)}`);
      lines.push(`  theme_ggpbi(\n${inner.join(',\n')}\n  )`);
    } else if (own.length > 0) {
      lines.push(`  theme_ggpbi(${own.map(([k, v]) => `${k} = ${rValue(v)}`).join(', ')})`);
    }
  }

  if (typeof spec.subtitle === 'string' && spec.subtitle !== 'auto' && spec.subtitle !== 'always') {
    lines.push(`  labs(subtitle = ${rString(spec.subtitle)})`);
  }

  return lines.join(' +\n');
}

// ---------------------------------------------------------------------------
// Highlighting — R flavour
// ---------------------------------------------------------------------------

const R_CALL = /[a-zA-Z.][\w.]*(?=\()/y;
const R_STRING = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y;
const R_NUMBER = /-?\d+(?:\.\d+)?/y;
const R_KEYWORD = /\b(?:TRUE|FALSE|NULL|NA|Inf)\b/y;
const R_NAMED_ARG = /[a-zA-Z.][\w.]*(?=\s*=[^=])/y;
const R_IDENT = /`[^`]*`|[a-zA-Z.][\w.]*/y;
const R_COMMENT = /#[^\n]*/y;

/**
 * Tokenise ggplot2 code for colouring — the R sibling of `highlight`.
 * Same guarantee: a miss shows as uncoloured code, never as wrong code.
 */
export function highlightR(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let i = 0;

  const tryMatch = (re: RegExp, kind: TokenKind): boolean => {
    re.lastIndex = i;
    const m = re.exec(code);
    if (!m) return false;
    tokens.push({ text: m[0], kind });
    i += m[0].length;
    return true;
  };

  while (i < code.length) {
    if (
      tryMatch(R_COMMENT, 'plain') ||
      tryMatch(R_STRING, 'string') ||
      tryMatch(R_KEYWORD, 'keyword') ||
      tryMatch(R_CALL, 'call') ||
      tryMatch(R_NAMED_ARG, 'property') ||
      tryMatch(R_NUMBER, 'number') ||
      tryMatch(R_IDENT, 'plain')
    ) continue;

    const ch = code[i];
    const kind: TokenKind = '{}()[].,;+~='.includes(ch) ? 'punct' : 'plain';
    const last = tokens[tokens.length - 1];
    if (last && last.kind === kind) last.text += ch;
    else tokens.push({ text: ch, kind });
    i += 1;
  }

  return tokens;
}
