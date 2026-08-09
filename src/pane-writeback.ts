/**
 * Translate an applied code edit into Format Pane properties.
 *
 * The editor and the pane are meant to be two doors into the same room:
 * change the geom in the code, and the pane's dropdown follows — the
 * edit becomes persisted report configuration instead of a session
 * overlay. The visual persists these instances via `persistProperties`;
 * the host then re-invokes update() with the new values, the pane-built
 * spec matches the edit, and the overlay dissolves.
 *
 * The pane cannot hold everything the code can say. Field bindings
 * (`.aes(…)`) are well state, not properties; a fourth layer has no
 * card; `min`/`max` on scales and free-text subtitles have no slice yet.
 * Whatever finds no pane home sets `residual` — the caller keeps the
 * session overlay (and its "(edited)" label) for exactly those parts.
 *
 * Property names and enum values mirror capabilities.json;
 * tests/pane-writeback.test.ts asserts they stay in sync.
 */
import type { PlotSpec } from './types';
import { FUNC, type CodePatch } from './code-parse';

export interface PersistInstance {
  objectName: string;
  selector: null;
  properties: Record<string, unknown>;
}

export interface WritebackResult {
  instances: PersistInstance[];
  /** True when parts of the patch have no pane home — keep the overlay. */
  residual: boolean;
}

// --- The pane's vocabulary (asserted against capabilities.json) -------------

export const LAYER_TYPES = new Set([
  'auto', 'bar', 'point', 'line', 'area', 'text', 'boxplot', 'histogram',
  'smooth', 'segment', 'pointrange', 'density', 'violin',
]);
export const POSITIONS = new Set(['identity', 'stack', 'dodge', 'dodge2', 'fill', 'jitter']);
export const LINE_STYLES = new Set(['solid', 'dashed', 'dotted', 'dashdot', 'longdash', 'twodash']);
export const SHAPES = new Set([
  'circle', 'square', 'triangle', 'diamond',
  'circleOpen', 'squareOpen', 'triangleOpen', 'diamondOpen',
  'circleFilled', 'squareFilled', 'triangleFilled', 'diamondFilled',
  'plus', 'cross', 'asterisk', 'star',
]);
export const SCALE_TYPES = new Set(['auto', 'linear', 'log', 'sqrt', 'time', 'ordinal', 'category']);
export const LABEL_FORMATS = new Set(['auto', 'thousands', 'compact', 'currency', 'percent']);
export const DATE_FORMATS = new Set(['auto', 'year', 'monthYear', 'monthDay', 'date', 'dateTime']);

const fill = (color: string): unknown => ({ solid: { color } });

/**
 * Geom option → layer-card property. The value mapper returns undefined
 * to reject (→ residual) — an enum value the pane does not know must
 * never be persisted.
 */
const LAYER_OPTION_MAP: Record<string, { prop: string; map: (v: unknown) => unknown }> = {
  alpha: { prop: 'alpha', map: (v) => (typeof v === 'number' ? v : undefined) },
  size: { prop: 'size', map: (v) => (typeof v === 'number' ? v : undefined) },
  color: { prop: 'fill', map: (v) => (typeof v === 'string' ? fill(v) : undefined) },
  fill: { prop: 'pointFill', map: (v) => (typeof v === 'string' ? fill(v) : undefined) },
  linetype: { prop: 'lineStyle', map: (v) => (LINE_STYLES.has(v as string) ? v : undefined) },
  position: { prop: 'position', map: (v) => (POSITIONS.has(v as string) ? v : undefined) },
  shape: { prop: 'shape', map: (v) => (SHAPES.has(v as string) ? v : undefined) },
  strokeWidth: { prop: 'strokeWidth', map: (v) => (typeof v === 'number' ? v : undefined) },
  jitterWidth: { prop: 'jitterWidth', map: (v) => (typeof v === 'number' ? v : undefined) },
  jitterHeight: { prop: 'jitterHeight', map: (v) => (typeof v === 'number' ? v : undefined) },
  lineend: { prop: 'lineEnd', map: (v) => (['butt', 'round', 'square'].includes(v as string) ? v : undefined) },
  linejoin: { prop: 'lineJoin', map: (v) => (['round', 'miter', 'bevel'].includes(v as string) ? v : undefined) },
  arrowShow: { prop: 'arrowShow', map: (v) => (typeof v === 'boolean' ? v : undefined) },
  arrowEnds: { prop: 'arrowEnds', map: (v) => (['last', 'first', 'both'].includes(v as string) ? v : undefined) },
  arrowType: { prop: 'arrowType', map: (v) => (['open', 'closed'].includes(v as string) ? v : undefined) },
  arrowLength: { prop: 'arrowLength', map: (v) => (typeof v === 'number' ? v : undefined) },
  arrowAngle: { prop: 'arrowAngle', map: (v) => (typeof v === 'number' ? v : undefined) },
  just: { prop: 'just', map: (v) => (typeof v === 'number' ? v : undefined) },
  orientation: { prop: 'orientation', map: (v) => (v === 'x' || v === 'y' ? v : undefined) },
  repel: { prop: 'repel', map: (v) => (typeof v === 'boolean' ? v : undefined) },
  labelTemplate: { prop: 'labelTemplate', map: (v) => (typeof v === 'string' ? v : undefined) },
};

/** Theme option → theme-card property. */
const THEME_OPTION_MAP: Record<string, { prop: string; map: (v: unknown) => unknown }> = {
  panelFill: { prop: 'panelFill', map: (v) => (typeof v === 'string' ? fill(v) : undefined) },
  gridColor: { prop: 'gridlineColor', map: (v) => (typeof v === 'string' ? fill(v) : undefined) },
  ink: { prop: 'ink', map: (v) => (typeof v === 'string' ? fill(v) : undefined) },
  paper: { prop: 'paper', map: (v) => (typeof v === 'string' ? fill(v) : undefined) },
  baseSize: { prop: 'baseSize', map: (v) => (typeof v === 'number' ? v : undefined) },
};

/** Theme keys the host supplies — present in the code, but never edits. */
const THEME_HOST_KEYS = new Set(['colorPalette', 'isHighContrast']);

// ---------------------------------------------------------------------------

/**
 * Compute the pane's share of an applied patch.
 *
 * `live` is the pane-built spec of the same update — the baseline against
 * which "did the edit change this?" is decided for the parts (like aes)
 * that only the wells can change. `merged` is the spec after
 * `applyCodeEdit`, whose aes already carries internal field names.
 */
export function computePaneWriteback(
  patch: CodePatch,
  live: PlotSpec,
  merged: PlotSpec,
  /**
   * The pane's default values per object → property, from a pristine
   * formatting model. With them, a DELETED line writes its property
   * back to the default — the pane follows deletions like edits, and
   * closing the overlay can never snap the chart back.
   */
  paneDefaults: Record<string, Record<string, unknown>> = {},
): WritebackResult {
  const instances: PersistInstance[] = [];
  let residual = false;

  const add = (objectName: string, properties: Record<string, unknown>): void => {
    if (Object.keys(properties).length === 0) return;
    instances.push({ objectName, selector: null, properties });
  };

  /** A pane default in persistable form (hex colors become fills). */
  const defaultFor = (objectName: string, prop: string): unknown => {
    const value = paneDefaults[objectName]?.[prop];
    if (value === undefined) return undefined;
    return typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value) ? fill(value) : value;
  };

  /**
   * The live spec carried a value the edit no longer expresses: revert
   * the pane property to its default, or flag residual if the default
   * is unknown.
   */
  const revert = (
    properties: Record<string, unknown>,
    objectName: string,
    prop: string,
  ): void => {
    const fallback = defaultFor(objectName, prop);
    if (fallback === undefined) residual = true;
    else properties[prop] = fallback;
  };

  // --- aes: wells, not properties — any change is overlay-only ---
  if (patch.aes) {
    const a = merged.aes as unknown as Record<string, unknown>;
    const b = live.aes as unknown as Record<string, unknown>;
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (a[key] !== b[key]) { residual = true; break; }
    }
  }

  // --- layers: the three cards ---
  const cardLayers = patch.layers.slice(0, 3);
  if (patch.layers.length > 3) residual = true;
  cardLayers.forEach((layer, i) => {
    const properties: Record<string, unknown> = { enabled: true };
    // The pane spells col as bar; the visual resolves bar back to col
    // when a y is mapped.
    const paneType = layer.type === 'col' ? 'bar' : layer.type;
    if (LAYER_TYPES.has(paneType)) properties.type = paneType;
    else if (['hline', 'vline', 'abline'].includes(layer.type)) {
      // Reference lines live in the Analytics-style card, not a layer.
      residual = true;
      return;
    } else {
      residual = true;
      return;
    }
    for (const [key, value] of Object.entries(layer.opts)) {
      if (value === FUNC || typeof value === 'function') continue; // live-owned
      const entry = LAYER_OPTION_MAP[key];
      const mapped = entry?.map(value);
      if (entry && mapped !== undefined) properties[entry.prop] = mapped;
      else residual = true; // geom-card options (bins, method, …) for now
    }
    // Options the live layer had and the edit deleted revert to default.
    const liveGeom = live.layers[i]?.geom as unknown as Record<string, unknown> | undefined;
    if (liveGeom) {
      for (const [key, entry] of Object.entries(LAYER_OPTION_MAP)) {
        if (liveGeom[key] === undefined || typeof liveGeom[key] === 'function') continue;
        if (key in layer.opts) continue;
        revert(properties, `layer${i + 1}`, entry.prop);
      }
    }
    add(`layer${i + 1}`, properties);
  });
  // Layers the edit removed: switch their cards off.
  const liveCardLayers = Math.min(live.layers.length, 3);
  for (let i = cardLayers.length; i < liveCardLayers; i++) {
    add(`layer${i + 1}`, { enabled: false });
  }

  // --- scales ---
  const SCALE_PROP: Record<string, string> = { type: 'type', labels: 'labelFormat', dateLabels: 'dateFormat' };
  const scalePatch = (axis: 'x' | 'y', objectName: string): void => {
    const cfg = patch.scales?.[axis];
    const properties: Record<string, unknown> = {};
    const entries: Record<string, unknown> =
      cfg === undefined ? {}
        : typeof cfg === 'string' ? { type: cfg } : (cfg as Record<string, unknown>);
    for (const [key, value] of Object.entries(entries)) {
      if (key === 'type' && SCALE_TYPES.has(value as string)) properties.type = value;
      else if (key === 'labels' && LABEL_FORMATS.has(value as string)) properties.labelFormat = value;
      else if (key === 'dateLabels' && DATE_FORMATS.has(value as string)) properties.dateFormat = value;
      else residual = true; // min, max, breaks … have no pane slice yet
    }
    // Live scale settings the edit deleted (or the whole call) revert.
    const liveCfg = live.scales?.[axis];
    const liveEntries: Record<string, unknown> =
      liveCfg === undefined ? {}
        : typeof liveCfg === 'string' ? { type: liveCfg } : (liveCfg as Record<string, unknown>);
    for (const [key, prop] of Object.entries(SCALE_PROP)) {
      if (liveEntries[key] === undefined || key in entries) continue;
      revert(properties, objectName, prop);
    }
    add(objectName, properties);
  };
  scalePatch('x', 'scaleX');
  scalePatch('y', 'scaleY');
  if (patch.scales) {
    for (const key of Object.keys(patch.scales)) {
      if (key !== 'x' && key !== 'y') residual = true;
    }
  }

  // --- facet: the field is a well; the layout options are properties ---
  {
    const FACET_PROP: Record<string, string> = { ncol: 'columns', freeX: 'freeX', freeY: 'freeY' };
    const properties: Record<string, unknown> = {};
    if (patch.facet) {
      for (const [key, value] of Object.entries(patch.facet)) {
        if (key === 'ncol' && typeof value === 'number') properties.columns = value;
        else if (key === 'freeX' && typeof value === 'boolean') properties.freeX = value;
        else if (key === 'freeY' && typeof value === 'boolean') properties.freeY = value;
        else if (key === 'wrap' || key === 'row' || key === 'col') {
          const liveFacet = live.facet as Record<string, unknown> | undefined;
          if (liveFacet?.[key] !== value) residual = true; // rebinding is well work
        } else residual = true;
      }
    } else if (live.facet) {
      // Deleting .facet(…) unfacets — but the bound field sits in a well
      // the visual cannot clear.
      residual = true;
    }
    // Layout options the edit deleted revert to their defaults.
    const liveFacet = (live.facet ?? {}) as Record<string, unknown>;
    for (const [key, prop] of Object.entries(FACET_PROP)) {
      if (liveFacet[key] === undefined) continue;
      if (patch.facet && key in patch.facet) continue;
      revert(properties, 'facet', prop);
    }
    add('facet', properties);
  }

  // --- theme ---
  {
    const properties: Record<string, unknown> = {};
    if (patch.theme && patch.theme !== FUNC) {
      for (const [key, value] of Object.entries(patch.theme)) {
        if (THEME_HOST_KEYS.has(key)) continue;
        const entry = THEME_OPTION_MAP[key];
        const mapped = entry?.map(value);
        if (entry && mapped !== undefined) properties[entry.prop] = mapped;
        else residual = true; // preset spreads (dark/minimal internals) etc.
      }
    }
    // Theme values the edit deleted (or the whole call) revert.
    if (patch.theme !== FUNC) {
      const liveTheme = (live.theme ?? {}) as Record<string, unknown>;
      const patchTheme = (patch.theme ?? {}) as Record<string, unknown>;
      for (const [key, entry] of Object.entries(THEME_OPTION_MAP)) {
        if (liveTheme[key] === undefined || key in patchTheme) continue;
        revert(properties, 'theme', entry.prop);
      }
    }
    add('theme', properties);
  }

  // --- highlight ---
  if (patch.highlight && patch.highlight !== FUNC) {
    const values = (patch.highlight as { values?: unknown }).values;
    if (Array.isArray(values) && values.every(v => typeof v === 'string' || typeof v === 'number')) {
      add('highlight', { enabled: true, values: values.map(String).join(', ') });
    } else {
      residual = true;
    }
  } else if (patch.highlight === undefined && live.highlight) {
    add('highlight', { enabled: false });
  }

  // --- subtitle: the pane knows auto/always/off, not free text ---
  if (patch.subtitle !== undefined) {
    if (patch.subtitle === 'auto' || patch.subtitle === 'always') {
      add('theme', { subtitle: patch.subtitle });
    } else {
      residual = true;
    }
  } else if (typeof live.subtitle === 'string' && live.subtitle !== 'auto' && live.subtitle !== 'always') {
    // A deleted explicit subtitle had come from an earlier overlay — the
    // pane cannot have held it.
    residual = true;
  }

  // --- format: locale is the host's; currency has a slice ---
  if (patch.format) {
    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch.format)) {
      if (key === 'currency' && typeof value === 'string') properties.currency = value;
      else if (key === 'locale') continue; // host-owned, informational
      else residual = true;
    }
    add('theme', properties);
  }

  return { instances, residual };
}
