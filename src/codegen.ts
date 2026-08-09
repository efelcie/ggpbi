/**
 * Turn a PlotSpec back into the ggpbi code that would produce it.
 *
 * The Format Pane builds charts by clicking; this reads the result back
 * out as the fluent chain a developer would have written. Useful for
 * learning the API, for filing a reproducible bug, and for lifting a
 * chart out of a report into the library.
 *
 * Two rules keep the output honest:
 *
 * - **Field names are the ones in the wells.** Power BI binds internal
 *   keys (`yRaw1`, `x`), so every field goes through the same label map
 *   the chart description uses. Code naming `__sum` would be a lie.
 * - **Only what differs from the default is emitted.** A faithful dump of
 *   every resolved option would bury the two lines that matter.
 */
import type { PlotSpec, GeomConfig, AesMapping, AxisScaleConfig, ScaleType } from './types';

export type TokenKind = 'plain' | 'call' | 'string' | 'number' | 'keyword' | 'property' | 'punct';

export interface CodeToken {
  text: string;
  kind: TokenKind;
}

/** Field labels per aesthetic, as used for the chart description. */
export type CodeFieldLabels = Partial<Record<keyof AesMapping | 'facetCol' | 'facetRow', string>>;

/** Aesthetics worth naming, in the order ggplot2 users write them. */
export const AES_ORDER: Array<keyof AesMapping> = [
  'x', 'y', 'color', 'fill', 'size', 'shape', 'alpha', 'group',
  'label', 'facetCol', 'facetRow', 'xend', 'yend', 'xmin', 'xmax', 'ymin', 'ymax',
];

/**
 * Geom options that carry a default the generator can leave out. Values
 * match the geom defaults in `src/geoms/*`; anything absent is always
 * emitted when set.
 */
const GEOM_DEFAULTS: Record<string, unknown> = {
  position: 'identity',
  alpha: 1,
  repel: false,
  trim: undefined,
  orientation: 'x',
  linetype: 'solid',
  shape: 'circle',
  notch: false,
  varwidth: false,
  se: true,
};

/** Keys that never belong in generated code — internals, not options. */
const SKIP_GEOM_KEYS = new Set(['type', 'aes', 'stat']);

/**
 * Theme values the host supplies — the report palette, contrast state.
 * Shown in full (the code hides nothing) but emitted on their own lines,
 * because the editor greys them: display, not configuration.
 */
export const HOST_THEME_KEYS = new Set(['colorPalette', 'isHighContrast']);

const q = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function literal(value: unknown): string {
  if (typeof value === 'string') return q(value);
  if (typeof value === 'number') return String(Math.round(value * 1000) / 1000);
  if (typeof value === 'boolean') return String(value);
  if (value instanceof Date) return `new Date(${q(value.toISOString().slice(0, 10))})`;
  // Spelled out in full, palettes included — the code never hides
  // anything behind a summary; whole truth beats short truth.
  if (Array.isArray(value)) return `[${value.map(literal).join(', ')}]`;
  if (value && typeof value === 'object') return objectLiteral(value as Record<string, unknown>);
  return String(value);
}

function objectLiteral(obj: Record<string, unknown>): string {
  const parts = Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${literal(v)}`);
  return parts.length > 0 ? `{ ${parts.join(', ')} }` : '';
}

/** Resolve an aesthetic to the name the user sees in the field well. */
function fieldName(
  aes: AesMapping,
  key: keyof AesMapping,
  labels: CodeFieldLabels,
): string | undefined {
  const bound = aes[key];
  if (typeof bound !== 'string' || !bound) return undefined;
  // Synthetic fields the pipeline invents (pseudo-x, stat outputs) have no
  // meaning to a reader and no place in code they might run.
  if (bound.startsWith('__')) return undefined;
  return (labels as Record<string, string | undefined>)[key] ?? bound;
}

/** The options of one geom, minus defaults and internals. */
function geomOptions(geom: GeomConfig): string {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(geom as unknown as Record<string, unknown>)) {
    if (SKIP_GEOM_KEYS.has(key)) continue;
    if (value === undefined || value === null || value === '') continue;
    if (key in GEOM_DEFAULTS && GEOM_DEFAULTS[key] === value) continue;
    if (typeof value === 'function') continue; // filters, custom formatters
    out[key] = value;
  }
  return objectLiteral(out);
}

/** Axis config, minus an `auto` type that says nothing. */
function scaleOptions(cfg: ScaleType | AxisScaleConfig | undefined): string {
  if (!cfg) return '';
  if (typeof cfg === 'string') return q(cfg);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(cfg)) {
    if (value === undefined || value === null || value === '') continue;
    if (key === 'type' && value === 'auto') continue;
    if (typeof value === 'function') continue;
    out[key] = value;
  }
  return objectLiteral(out);
}

/**
 * Generate the fluent chain for a spec.
 *
 * Pass the spec as the user built it — *before* stats rewrite aesthetics
 * to `__sum` / `__count`, which is what they would compute themselves
 * from the code below.
 */
export function specToCode(spec: PlotSpec, labels: CodeFieldLabels = {}): string {
  const lines: string[] = ['ggpbi()'];
  lines.push('  .data(data)');

  const aesParts: string[] = [];
  for (const key of AES_ORDER) {
    const name = fieldName(spec.aes, key, labels);
    if (name) aesParts.push(`${key}: ${q(name)}`);
  }
  if (aesParts.length > 0) lines.push(`  .aes({ ${aesParts.join(', ')} })`);

  for (const layer of spec.layers) {
    const opts = geomOptions(layer.geom);
    lines.push(`  .geom(${q(layer.geom.type)}${opts ? `, ${opts}` : ''})`);
  }
  if (spec.layers.length === 0) lines.push('  // no explicit layer — ggpbi picks one from the fields');

  const scaleParts: string[] = [];
  for (const axis of ['x', 'y'] as const) {
    const opts = scaleOptions(spec.scales?.[axis]);
    if (opts) scaleParts.push(`${axis}: ${opts}`);
  }
  if (scaleParts.length > 0) lines.push(`  .scale({ ${scaleParts.join(', ')} })`);

  if (spec.facet) {
    const facet = objectLiteral(spec.facet as unknown as Record<string, unknown>);
    if (facet) lines.push(`  .facet(${facet})`);
  }

  if (spec.highlight) {
    const values = (spec.highlight as { values?: unknown[] }).values;
    lines.push(Array.isArray(values)
      ? `  .highlight({ values: ${literal(values)} })`
      : '  .highlight({ filter: d => /* … */ })');
  }

  // Host-owned theme values (the report palette, high-contrast state) get
  // their own lines: the editor greys per line, and these are display,
  // not configuration — shown whole, but not yours to change.
  const themeEntries = Object.entries((spec.theme ?? {}) as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && typeof v !== 'function');
  const hostEntries = themeEntries.filter(([k]) => HOST_THEME_KEYS.has(k));
  const ownEntries = themeEntries.filter(([k]) => !HOST_THEME_KEYS.has(k));
  if (hostEntries.length > 0) {
    const inner = [...hostEntries, ...ownEntries].map(([k, v]) => `    ${k}: ${literal(v)}`);
    lines.push(`  .theme({\n${inner.join(',\n')},\n  })`);
  } else if (ownEntries.length > 0) {
    lines.push(`  .theme(${objectLiteral(Object.fromEntries(ownEntries))})`);
  }

  if (typeof spec.subtitle === 'string' && spec.subtitle !== 'auto') {
    lines.push(`  .subtitle(${q(spec.subtitle)})`);
  }
  if (spec.format?.locale) lines.push(`  .format({ locale: ${q(spec.format.locale)} })`);
  if (spec.width && spec.height) lines.push(`  .size(${Math.round(spec.width)}, ${Math.round(spec.height)})`);

  lines.push('  .renderTo(element);');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Highlighting
// ---------------------------------------------------------------------------

const CALL_RE = /\.[a-zA-Z_$][\w$]*(?=\()/y;
const STRING_RE = /'(?:[^'\\]|\\.)*'/y;
const NUMBER_RE = /-?\d+(?:\.\d+)?/y;
const KEYWORD_RE = /\b(?:true|false|null|undefined|new|Date)\b/y;
const PROPERTY_RE = /[a-zA-Z_$][\w$]*(?=\s*:)/y;
const IDENT_RE = /[a-zA-Z_$][\w$]*/y;
const COMMENT_RE = /\/\/[^\n]*/y;

/**
 * Tokenise the generated code for colouring.
 *
 * A full JavaScript lexer would be overkill: this only ever sees output
 * from `specToCode` above, which is a fluent chain of calls, object
 * literals and primitives. Anything unrecognised falls through as plain
 * text, so a miss shows up as uncoloured code, never as wrong code.
 */
export function highlight(code: string): CodeToken[] {
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
      tryMatch(COMMENT_RE, 'plain') ||
      tryMatch(CALL_RE, 'call') ||
      tryMatch(STRING_RE, 'string') ||
      tryMatch(KEYWORD_RE, 'keyword') ||
      tryMatch(NUMBER_RE, 'number') ||
      tryMatch(PROPERTY_RE, 'property') ||
      tryMatch(IDENT_RE, 'plain')
    ) continue;

    const ch = code[i];
    const kind: TokenKind = '{}()[].,:;'.includes(ch) ? 'punct' : 'plain';
    const last = tokens[tokens.length - 1];
    if (last && last.kind === kind) last.text += ch;
    else tokens.push({ text: ch, kind });
    i += 1;
  }

  // Comments come back as plain above so `//` does not swallow colours;
  // mark them afterwards, when their full extent is known.
  return tokens.map(t => (t.text.startsWith('//') ? { ...t, kind: 'plain' as const } : t));
}
