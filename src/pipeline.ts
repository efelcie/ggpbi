/**
 * Pipeline: PlotSpec → BuiltPlot → (SceneGraph → SVG)
 *
 * Pure data pipeline — no DOM, no side effects.
 *
 * Stages (see buildPlot):
 *   resolveGeoms → computeStat → validateAes
 *   → computeLegendInfo → computeLayout
 *   → computeLayerBindings → computeSizeScale
 *   → computePosition → trainScales → BuiltPlot
 */

import * as d3 from 'd3';
import type { PlotSpec, DataPoint, AesMapping, GeomConfig, Layer, StatType, ScaleType, AxisScaleConfig, LabelFormat } from './types';
import { bindData, validateAes, type BoundPoint } from './bind-data';
import { createScale, inferScaleType, createSizeScale, type GgpbiScale, type BandScaleOptions } from './scales';
import { stats, DEFAULT_GEOM_STAT } from './stats';
import { inferGeom } from './auto-geom';
import { computePosition } from './position';
import type { ResolvedTheme } from './theme';
import { resolveTheme } from './theme';
import { estimateLegendWidth, type LegendEntry } from './legend';
import { extendedBreaks, formatBreaksAs } from './breaks';
import { describePlot, hasHiddenTransform, fieldLabelsFor, type LayerDescription } from './describe';
import { shouldWarnAggregated, AGGREGATION_NOTE } from './row-identity';
import { specToCode } from './codegen';

// ---------------------------------------------------------------------------
// Pipeline types
// ---------------------------------------------------------------------------

/** Trained scale model — all scales with their domains learned from data. */
export interface ScaleSet {
  x: GgpbiScale;
  y: GgpbiScale;
  color?: d3.ScaleOrdinal<string, string>;
  /** Unwrapped colour scale for layers exempted from highlighting. */
  colorBase?: d3.ScaleOrdinal<string, string>;
  xType: ScaleType;
  yType: ScaleType;
  geomPad: { x: number; y: number };
}

/** A single built layer — data bound to aesthetics, stats computed. */
export interface BuiltLayer {
  geom: GeomConfig;
  data: BoundPoint[];
  aes: AesMapping;
}

/** Plot layout dimensions computed from spec + theme. */
export interface PlotLayout {
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  margin: { top: number; right: number; bottom: number; left: number };
}

/** Legend info computed from data + theme. */
export interface LegendInfo {
  entries: LegendEntry[];
  width: number;
}

/** Result of the pure data pipeline — everything needed to render. */
export interface BuiltPlot {
  /** Spec after auto-geom and stat transforms. */
  spec: PlotSpec;
  /** Data after stat transforms. */
  data: DataPoint[];
  /** Built layers with bound data. */
  layers: BuiltLayer[];
  /** Trained scales. */
  scales: ScaleSet;
  /** Resolved theme. */
  theme: ResolvedTheme;
  /** Layout dimensions. */
  layout: PlotLayout;
  /** Legend info. */
  legend: LegendInfo;
  /** Pixel padding for geom marks (per axis). */
  geomPadPx: { x: number; y: number };
  /** Resolved subtitle line (explicit or generated); undefined when off. */
  subtitleText?: string;
  /** Generated ggpbi code for the debug view; undefined when off. */
  codeText?: string;
}

// ---------------------------------------------------------------------------
// resolveGeoms — infer geom when no layers specified
// ---------------------------------------------------------------------------

/** Resolve auto-geom if no layers specified. Pure. */
export function resolveGeoms(spec: PlotSpec): PlotSpec {
  if (spec.layers.length > 0) return spec;
  const data = spec.data ?? [];
  if (data.length === 0) return spec;
  const autoGeom = inferGeom(data, spec.aes);
  return { ...spec, layers: [{ geom: autoGeom }] };
}

/**
 * geom_col-style orientation inference (ggplot2 infers bar orientation
 * from the data): a bar/col layer with no explicit orientation flips
 * horizontal when x is continuous and y is discrete — "value in X,
 * grouping in Y" must give value bars, not vertical nonsense. Explicit
 * `orientation` always wins. Pure.
 */
export function inferBarOrientation(spec: PlotSpec, data: DataPoint[]): PlotSpec {
  const isBar = (g: GeomConfig): boolean => g.type === 'bar' || g.type === 'col';
  const needsInference = spec.layers.some(
    l => isBar(l.geom) && !(l.geom as { orientation?: string }).orientation,
  );
  if (!needsInference || !spec.aes.x || !spec.aes.y || data.length === 0) return spec;

  const declaredType = (s?: ScaleType | AxisScaleConfig): ScaleType | undefined =>
    typeof s === 'string' ? s : s?.type;
  const xType = declaredType(spec.scales?.x) ?? inferScaleType(data, spec.aes.x);
  const yType = declaredType(spec.scales?.y) ?? inferScaleType(data, spec.aes.y);
  const xContinuous = xType === 'linear' || xType === 'log' || xType === 'sqrt' || xType === 'time';
  const yDiscrete = yType === 'ordinal' || yType === 'category';
  if (!(xContinuous && yDiscrete)) return spec;

  return {
    ...spec,
    layers: spec.layers.map(l =>
      isBar(l.geom) && !(l.geom as { orientation?: string }).orientation
        ? { ...l, geom: { ...l.geom, orientation: 'y' } as GeomConfig }
        : l,
    ),
  };
}

// ---------------------------------------------------------------------------
// mergeAes / computeLayerBindings — bind data to aesthetics per layer
// ---------------------------------------------------------------------------

/**
 * Merge aes mappings: layer-local overrides global, but only for non-empty values.
 */
export function mergeAes(base: AesMapping, overrides?: Partial<AesMapping>): AesMapping {
  if (!overrides) return base;
  const filtered: Partial<AesMapping> = {};
  for (const [k, v] of Object.entries(overrides) as Array<[keyof AesMapping, any]>) {
    if (v !== undefined && v !== null && v !== '') {
      (filtered as any)[k] = v;
    }
  }
  return { ...base, ...filtered };
}

/**
 * Bind data to aesthetics for each layer. Pure.
 * Returns one BoundPoint[] per layer.
 *
 * Per-layer stats (like smooth) are applied here: the layer's data
 * is transformed before binding, keeping other layers' data intact.
 */
export function computeLayerBindings(
  data: DataPoint[],
  globalAes: AesMapping,
  layers: Layer[],
  scales?: PlotSpec['scales'],
): BoundPoint[][] {
  const globalBound = bindData(data, globalAes);

  return layers.map(layer => {
    const layerAes = layer.aes ?? layer.geom.aes;
    const merged = layerAes ? mergeAes(globalAes, layerAes) : globalAes;

    // Per-layer row filter (ggplot2 layer-local data): restrict this
    // layer's rows before stats and binding.
    const layerData = applyLayerFilter(data, layer.geom, merged, scales);

    // Per-layer stat (smooth): transform data before binding
    const statType = resolveLayerStat(layer, globalAes, data);
    if (statType === 'smooth') {
      const statFn = stats[statType];
      const result = statFn(layerData, merged, layer.geom);
      const smoothAes = result.aesOverrides
        ? mergeAes(merged, result.aesOverrides)
        : merged;
      return bindData(result.data, smoothAes);
    }

    if (layerAes || layerData !== data) {
      return bindData(layerData, merged);
    }
    return globalBound;
  });
}

/**
 * Apply a layer's `filter` option (ggplot2's layer-local `data = subset(...)`).
 *
 * A function keeps matching rows. The keywords 'min' / 'max' / 'extremes'
 * keep, per discrete-axis group, the row(s) with the lowest / highest /
 * both value(s) on the continuous axis — the ends of a dumbbell. When
 * neither axis is discrete, rows group by the group/color aesthetic (or
 * form one group). Returns `data` unchanged when there is no filter.
 */
export function applyLayerFilter(
  data: DataPoint[],
  geom: GeomConfig,
  aes: AesMapping,
  scales?: PlotSpec['scales'],
): DataPoint[] {
  const filter = geom.filter;
  if (!filter) return data;
  if (typeof filter === 'function') return data.filter(filter);

  const declaredType = (axis: 'x' | 'y'): ScaleType | undefined => {
    const s = scales?.[axis];
    if (!s) return undefined;
    return typeof s === 'string' ? s : s.type;
  };
  const axisType = (axis: 'x' | 'y', field?: string): ScaleType | undefined =>
    declaredType(axis) ?? (field ? inferScaleType(data, field) : undefined);
  const isDiscrete = (t?: ScaleType): boolean => t === 'ordinal' || t === 'category';

  const xDiscrete = isDiscrete(axisType('x', aes.x));
  const yDiscrete = isDiscrete(axisType('y', aes.y));

  let groupField: string | undefined;
  let valueField: string | undefined;
  if (yDiscrete && !xDiscrete) {
    groupField = aes.y;
    valueField = aes.x;
  } else if (xDiscrete && !yDiscrete) {
    groupField = aes.x;
    valueField = aes.y;
  } else {
    groupField = aes.group ?? aes.color;
    valueField = aes.y ?? aes.x;
  }
  if (!valueField) return data;

  const groups = new Map<string, DataPoint[]>();
  for (const d of data) {
    const v = d[valueField];
    if (v == null || (typeof v === 'number' && isNaN(v))) continue;
    const key = groupField ? String(d[groupField]) : '';
    const rows = groups.get(key);
    if (rows) rows.push(d);
    else groups.set(key, [d]);
  }

  const keep = new Set<DataPoint>();
  for (const rows of groups.values()) {
    let lo = rows[0];
    let hi = rows[0];
    for (const r of rows) {
      if (Number(r[valueField]) < Number(lo[valueField])) lo = r;
      if (Number(r[valueField]) > Number(hi[valueField])) hi = r;
    }
    if (filter === 'min' || filter === 'extremes') keep.add(lo);
    if (filter === 'max' || filter === 'extremes') keep.add(hi);
  }
  return data.filter(d => keep.has(d));
}

// ---------------------------------------------------------------------------
// computeStat — statistical transforms (count, boxplot, …)
// ---------------------------------------------------------------------------

/**
 * Resolve the effective stat for a layer.
 *
 * Priority: Layer.stat → GeomConfig.stat → default for geom type.
 * Special case: bar with explicit y → identity (no counting needed).
 */
/**
 * Does the data carry more than one row per (category × colour × group ×
 * facet)? That is the shape where drawing one rectangle per row differs
 * visibly from drawing the group total.
 */
function hasMultipleRowsPerGroup(
  data: DataPoint[] | undefined,
  aes: AesMapping,
  horizontal: boolean,
): boolean {
  if (!data || data.length === 0) return false;
  const catField = horizontal ? aes.y : aes.x;
  if (!catField) return false;
  const keyFields = [catField, aes.color, aes.group, aes.facetRow, aes.facetCol]
    .filter((f): f is string => !!f);
  const seen = new Set<string>();
  for (const d of data) {
    const key = keyFields.map(f => String(d[f])).join('\u0000');
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

export function resolveLayerStat(
  layer: Layer,
  globalAes: AesMapping,
  data?: DataPoint[],
): StatType {
  // Explicit stat on layer or geom config wins
  const explicit = layer.stat ?? layer.geom.stat;
  if (explicit) return explicit;

  // Default stat for this geom type
  const defaultStat = DEFAULT_GEOM_STAT[layer.geom.type];
  if (!defaultStat) return 'identity';

  // Bar without a value mapping → count (like ggplot2: geom_bar() defaults
  // to stat_count). The value axis depends on orientation: horizontal bars
  // put categories on y and the value on x.
  if (defaultStat === 'count') {
    const horizontal = ('orientation' in layer.geom) && layer.geom.orientation === 'y';
    const valueMapped = horizontal ? !!globalAes.x : !!globalAes.y;
    if (valueMapped) {
      // Several rows per (category × colour) → sum them instead of
      // drawing one rectangle per row (see statSumFn). Power BI sends
      // this shape whenever a column is set to "Don't summarize".
      return hasMultipleRowsPerGroup(data, globalAes, horizontal) ? 'sum' : 'identity';
    }
  }

  // Histogram always uses stat_bin (never identity)
  if (defaultStat === 'bin') return 'bin';

  // Smooth always uses stat_smooth
  if (defaultStat === 'smooth') return 'smooth';

  return defaultStat;
}

/**
 * Apply statistical transforms. Pure.
 *
 * Uses the stat registry to dispatch based on resolved stat type.
 * Returns potentially modified spec + data.
 */
/**
 * Drop layer-local aes overrides for aesthetics a stat has just computed.
 * Without this the layer keeps binding the pre-stat field while scales
 * train on the computed one — axis and marks disagree.
 */
function stripStatAes(layers: Layer[], keys: Array<keyof AesMapping>): Layer[] {
  const strip = (a?: Partial<AesMapping>): Partial<AesMapping> | undefined => {
    if (!a) return a;
    let changed = false;
    const out: Partial<AesMapping> = { ...a };
    for (const k of keys) {
      if (k in out) {
        delete out[k];
        changed = true;
      }
    }
    return changed ? out : a;
  };

  return layers.map(layer => {
    const layerAes = strip(layer.aes);
    const geomAes = strip(layer.geom.aes);
    if (layerAes === layer.aes && geomAes === layer.geom.aes) return layer;
    return {
      ...layer,
      ...(layerAes !== layer.aes && { aes: layerAes }),
      ...(geomAes !== layer.geom.aes && { geom: { ...layer.geom, aes: geomAes } }),
    };
  });
}

export function computeStat(
  spec: PlotSpec,
  data: DataPoint[],
): { spec: PlotSpec; data: DataPoint[] } {
  // Find the first layer that needs a non-identity, non-per-layer stat.
  // Per-layer stats (smooth) are handled in computeLayerBindings instead.
  for (const layer of spec.layers) {
    const statType = resolveLayerStat(layer, spec.aes, data);
    if (statType === 'identity' || statType === 'boxplot' || statType === 'smooth') continue;

    const statFn = stats[statType];
    const result = statFn(data, spec.aes, layer.geom);

    // A stat that yields nothing leaves the scales with an empty field, whose
    // error blames the field ("no numeric values") instead of the real cause:
    // density and its relatives need at least two observations per group.
    if (data.length > 0 && result.data.length === 0) {
      throw new Error(`ggpbi: stat "${statType}" needs at least 2 values per group`);
    }

    const newAes = result.aesOverrides
      ? { ...spec.aes, ...result.aesOverrides }
      : spec.aes;

    // A stat replaces the data AND the aesthetic it computes (y → __sum,
    // __count, …). Layer-local overrides for that same aesthetic must go:
    // they would still point at the raw field, which the aggregated rows
    // only carry as a leftover of the first row of each group. Power BI
    // sets such an override on every layer (aes.y = 'yRaw1'), so leaving
    // them in place drew the first raw value per bar while the axis was
    // trained on the computed one.
    const newLayers = result.aesOverrides
      ? stripStatAes(spec.layers, Object.keys(result.aesOverrides) as Array<keyof AesMapping>)
      : spec.layers;

    return {
      spec: { ...spec, data: result.data, aes: newAes, layers: newLayers },
      data: result.data,
    };
  }

  return { spec, data };
}

// ---------------------------------------------------------------------------
// computeSizeScale — map size aesthetic to pixel values
// ---------------------------------------------------------------------------

/**
 * Map size aesthetic to pixel radius. Returns NEW arrays (no mutation).
 */
export function computeSizeScale(
  layerBindings: BoundPoint[][],
  data: DataPoint[],
  sizeField?: string,
): BoundPoint[][] {
  if (!sizeField) return layerBindings;

  const sizeScale = createSizeScale(data, sizeField);

  return layerBindings.map(layer =>
    layer.map(bp => {
      if (bp.size != null) {
        return { ...bp, size: sizeScale(Number(bp.size)) };
      }
      return bp;
    }),
  );
}

// ---------------------------------------------------------------------------
// trainScales — learn scale domains from data
// ---------------------------------------------------------------------------

/** Default expand multiplier (ggplot2: expansion(mult = 0.05)) */
const EXPAND_MULT = 0.05;

/** Parse a ScaleConfig entry. */
export function parseScaleConfig(cfg: ScaleType | AxisScaleConfig | undefined): {
  type?: ScaleType; min?: number; max?: number; paddingInner?: number; paddingOuter?: number;
  labels?: LabelFormat; dateLabels?: AxisScaleConfig['dateLabels'];
} {
  if (!cfg) return {};
  if (typeof cfg === 'string') return { type: cfg };
  return cfg;
}

/** Normalize scale type: validate compatibility with data. */
function normalizeScaleType(chosen: ScaleType | undefined, inferred: ScaleType, axis: 'x' | 'y', warn = true): ScaleType {
  if (!chosen) return inferred;

  const isCategorical = (t: ScaleType) => t === 'ordinal' || t === 'category';
  const isContinuousNumeric = (t: ScaleType) => t === 'linear' || t === 'log' || t === 'sqrt';

  if (isCategorical(inferred) && !isCategorical(chosen)) {
    if (warn) console.warn(`ggpbi: incompatible ${axis}-scale "${chosen}" for categorical data; falling back to "${inferred}"`);
    return inferred;
  }
  if (inferred === 'time' && (chosen === 'log' || chosen === 'sqrt')) {
    if (warn) console.warn(`ggpbi: incompatible ${axis}-scale "${chosen}" for time data; falling back to "time"`);
    return 'time';
  }
  // If the data looks numeric but the user explicitly chose a categorical scale,
  // honour that choice (treat numbers like discrete categories).
  // This is important for scenarios like Power BI numeric groupings where the
  // user wants ticks at 3/4/5 rather than a continuous axis.
  if (isContinuousNumeric(inferred) && chosen === 'time') {
    if (warn) console.warn(`ggpbi: incompatible ${axis}-scale "${chosen}" for numeric data; falling back to "${inferred}"`);
    return inferred;
  }
  return chosen;
}

/**
 * Apply ggplot2-style expand padding and optional user limits.
 * Mutates the scale domain. Only continuous scales.
 */
export function applyExpandAndLimits(
  scale: GgpbiScale,
  scaleType: ScaleType,
  limits?: { min?: number; max?: number },
  extraPadPx: number = 0,
): void {
  if (scaleType === 'ordinal' || scaleType === 'category') return;

  const dom = (scale as any).domain() as [number, number];
  if (!dom || dom.length < 2) return;

  const range = Number(dom[1]) - Number(dom[0]);
  const expandAmount = range * EXPAND_MULT;

  let newMin = Number(dom[0]) - expandAmount;
  let newMax = Number(dom[1]) + expandAmount;

  if (extraPadPx > 0 && typeof (scale as any).range === 'function') {
    try {
      const r = (scale as any).range() as [number, number];
      const rLen = Math.abs(Number(r[1]) - Number(r[0]));

      // Solve for the padded domain EXACTLY: after widening the domain,
      // pixels-per-unit shrink, so inverting the pad on the original scale
      // under-delivers (a 103px request came out as ~87px and boxes were
      // clipped at the panel edges). We need δ such that the original
      // domain occupies rLen − 2·pad pixels — computed in the scale's
      // transform space so log/sqrt axes pad correctly too.
      if (rLen > 2 * extraPadPx) {
        const fwd = scaleType === 'log' ? Math.log
          : scaleType === 'sqrt' ? Math.sqrt
          : (v: number) => v;
        const inv = scaleType === 'log' ? Math.exp
          : scaleType === 'sqrt' ? (t: number) => t * t
          : (t: number) => t;

        const t0 = fwd(Number(dom[0]));
        const t1 = fwd(Number(dom[1]));
        const tSpan = t1 - t0;
        if (Number.isFinite(tSpan) && tSpan > 0) {
          const delta = (extraPadPx * tSpan) / (rLen - 2 * extraPadPx);
          const lo = inv(t0 - delta);
          const hi = inv(t1 + delta);
          if (Number.isFinite(lo)) newMin = Math.min(newMin, lo);
          if (Number.isFinite(hi)) newMax = Math.max(newMax, hi);
        }
      }
    } catch {
      // ignore
    }
  }

  if (limits?.min !== undefined) newMin = limits.min;
  if (limits?.max !== undefined) newMax = limits.max;

  (scale as any).domain([newMin, newMax]);
}

/** Apply zero-baseline semantics for bar/area charts (like ggplot2). */
function applyBaselineSemantics(
  spec: PlotSpec,
  xScale: GgpbiScale,
  yScale: GgpbiScale,
  xType: ScaleType,
  yType: ScaleType,
): void {
  const geoms = spec.layers.map(l => l.geom);
  const isBarLike = (g: GeomConfig) => g.type === 'bar' || g.type === 'col' || g.type === 'histogram';
  const hasFillPosition = geoms.some(g => isBarLike(g) && g.position === 'fill');
  const hasHorizontalBars = geoms.some(g => isBarLike(g) && ('orientation' in g ? g.orientation : undefined) === 'y');
  const needsZeroBaseline = geoms.some(g => isBarLike(g) || g.type === 'area');

  if (needsZeroBaseline && !hasHorizontalBars && (yType === 'linear' || yType === 'sqrt')) {
    const continuous = yScale as d3.ScaleLinear<number, number>;
    if (hasFillPosition) {
      continuous.domain([0, 1]);
    } else {
      const dom = continuous.domain();
      continuous.domain([Math.min(dom[0], 0), Math.max(dom[1], 0)]);
    }
  }

  if (hasHorizontalBars && (xType === 'linear' || xType === 'sqrt')) {
    const continuous = xScale as d3.ScaleLinear<number, number>;
    const dom = continuous.domain();
    continuous.domain([Math.min(dom[0], 0), Math.max(dom[1], 0)]);
  }
}

/**
 * Compute pixel padding needed so geom marks don't overflow the panel.
 * Returns per-axis padding: bars need padding on the category axis only,
 * points need it on both axes, etc.
 */
export function computeGeomPadding(
  geoms: GeomConfig[],
  layerBindings: BoundPoint[][],
  spec: PlotSpec,
  xType: ScaleType,
  yType: ScaleType,
  innerWidth: number,
  innerHeight: number,
): { x: number; y: number } {
  let xPad = 0;
  let yPad = 0;

  for (let gi = 0; gi < geoms.length; gi++) {
    const geom = geoms[gi];
    switch (geom.type) {
      case 'point': {
        const defaultR = geom.size ?? 4;
        const strokeW = geom.strokeWidth ?? 0.5;
        const pts = layerBindings[gi] ?? [];
        let maxR = defaultR;
        for (const p of pts as any[]) {
          const r = (p?.size ?? defaultR);
          if (typeof r === 'number' && Number.isFinite(r)) maxR = Math.max(maxR, r);
        }
        const pad = maxR + strokeW + 1;
        xPad = Math.max(xPad, pad);
        yPad = Math.max(yPad, pad);
        break;
      }
      case 'line':
      case 'area':
      case 'smooth': {
        const pad = (geom.size ?? 2) / 2 + 1;
        xPad = Math.max(xPad, pad);
        yPad = Math.max(yPad, pad);
        break;
      }
      case 'text': {
        const fontSize = geom.size ?? 12;
        xPad = Math.max(xPad, fontSize * 2);
        yPad = Math.max(yPad, fontSize / 2);
        break;
      }
      case 'bar':
      case 'col':
      case 'histogram':
      case 'boxplot': {
        const isHoriz = ('orientation' in geom) ? geom.orientation === 'y' : false;
        const catAxis = isHoriz ? 'y' : 'x';
        const catType = catAxis === 'x' ? xType : yType;

        // Band scales handle padding via paddingOuter — only add small buffer
        if (catType === 'ordinal' || catType === 'category') {
          const pad = 2;
          if (catAxis === 'x') xPad = Math.max(xPad, pad);
          else yPad = Math.max(yPad, pad);
          break;
        }

        // Continuous scale: estimate half-bar-width
        const catSize = catAxis === 'x' ? innerWidth : innerHeight;
        const field = spec.aes[catAxis];
        if (!field) break;
        const nCat = new Set(
          (layerBindings[gi] ?? []).map(d => String(d[catAxis === 'x' ? 'x' : 'y']))
        ).size || 1;

        const widthFraction = geom.width ?? 0.9;
        const multiplier = geom.type === 'boxplot' ? 0.6 : 0.8;
        const halfBarWidth = (catSize / nCat) * multiplier * widthFraction / 2;

        if (catAxis === 'x') xPad = Math.max(xPad, halfBarWidth);
        else yPad = Math.max(yPad, halfBarWidth);
        break;
      }
    }
  }
  return { x: xPad, y: yPad };
}

/** Create an ordinal color scale from data + theme palette. */
function createColorScale(
  data: DataPoint[],
  aes: AesMapping,
  theme: ResolvedTheme,
): d3.ScaleOrdinal<string, string> | undefined {
  if (!aes.color) return undefined;
  const unique = Array.from(new Set(data.map(d => d[aes.color!])));
  return d3.scaleOrdinal<string, string>()
    .domain(unique.map(String))
    .range(theme.colorPalette);
}

/**
 * Train scales from data and spec. Pure (creates new scale objects).
 */
export function trainScales(
  spec: PlotSpec,
  data: DataPoint[],
  layerBindings: BoundPoint[][],
  innerWidth: number,
  innerHeight: number,
  theme: ResolvedTheme,
): ScaleSet {
  const xCfg = parseScaleConfig(spec.scales?.x);
  const yCfg = parseScaleConfig(spec.scales?.y);

  const inferredX = inferScaleType(data, spec.aes.x!);
  const inferredY = inferScaleType(data, spec.aes.y!);

  const xType = normalizeScaleType(xCfg.type, inferredX, 'x');
  const yType = normalizeScaleType(yCfg.type, inferredY, 'y');

  const geoms = spec.layers.map(l => l.geom);
  const geomPad = computeGeomPadding(geoms, layerBindings, spec, xType, yType, innerWidth, innerHeight);

  // Band scale options
  const xBandOpts: BandScaleOptions | undefined =
    (xType === 'ordinal' || xType === 'category')
      ? { paddingInner: xCfg.paddingInner, paddingOuter: xCfg.paddingOuter }
      : undefined;

  if (xBandOpts && geomPad.x > 0) {
    const domainLen = new Set(data.map(d => String((d as any)[spec.aes.x!]))).size;
    const step = domainLen > 0 ? (innerWidth / domainLen) : innerWidth;
    const extraFrac = step > 0 ? Math.min(1, (geomPad.x / step)) : 0;
    const baseOuter = xBandOpts.paddingOuter ?? 0.5;
    xBandOpts.paddingOuter = Math.max(baseOuter, extraFrac);
  }

  // Range aesthetics (segment ends, pointrange bounds) extend the domain
  // of their axis — a segment to xend must stay inside the panel.
  const collectRangeFields = (axis: 'x' | 'y'): string[] => {
    const keys: Array<keyof AesMapping> = axis === 'x'
      ? ['xend', 'xmin', 'xmax']
      : ['yend', 'ymin', 'ymax'];
    const fields: string[] = [];
    const layerAesList = [spec.aes, ...spec.layers.map(l => l.aes ?? l.geom.aes)];
    for (const a of layerAesList) {
      if (!a) continue;
      for (const k of keys) {
        const f = a[k];
        if (typeof f === 'string' && f) fields.push(f);
      }
    }
    return fields;
  };

  // X scale (union domain with range fields on continuous axes)
  const xScale = createScale(data, spec.aes.x!, xType, [0, innerWidth], xBandOpts);
  const xRangeFields = collectRangeFields('x');
  if (xRangeFields.length > 0 && xType !== 'ordinal' && xType !== 'category') {
    let xMin = Infinity;
    let xMax = -Infinity;
    for (const field of [spec.aes.x!, ...xRangeFields]) {
      for (const d of data) {
        const v = Number(d[field]);
        if (!isNaN(v)) {
          if (v < xMin) xMin = v;
          if (v > xMax) xMax = v;
        }
      }
    }
    if (isFinite(xMin) && isFinite(xMax)) {
      (xScale as any).domain([xMin, xMax]);
    }
  }
  applyExpandAndLimits(xScale, xType, xCfg, geomPad.x);

  // Y scale: union domain across all y-fields
  const allYFields = new Set<string>();
  if (spec.aes.y) allYFields.add(spec.aes.y);
  for (const layer of spec.layers) {
    const layerAes = layer.aes ?? layer.geom.aes;
    if (layerAes?.y) allYFields.add(layerAes.y);
  }
  for (const f of collectRangeFields('y')) {
    if (yType !== 'ordinal' && yType !== 'category') allYFields.add(f);
  }

  let yScale: GgpbiScale;
  if (allYFields.size > 1) {
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const field of allYFields) {
      for (const d of data) {
        const v = Number(d[field]);
        if (!isNaN(v)) {
          if (v < yMin) yMin = v;
          if (v > yMax) yMax = v;
        }
      }
    }
    yScale = createScale(data, spec.aes.y!, yType, [innerHeight, 0]);
    if (isFinite(yMin) && isFinite(yMax)) {
      (yScale as any).domain([yMin, yMax]);
    }
  } else {
    yScale = createScale(data, spec.aes.y!, yType, [innerHeight, 0]);
  }
  applyExpandAndLimits(yScale, yType, yCfg, geomPad.y);

  // Baseline semantics (bar/area zero baseline)
  applyBaselineSemantics(spec, xScale, yScale, xType, yType);

  // Expand scale domains to cover stacked position values (_v0, _v1).
  // Without this, stacked bars can exceed the y-axis range because the scale
  // was trained on raw values, not cumulative stacked totals.
  const barLikeGeoms = geoms.filter(g =>
    g.type === 'bar' || g.type === 'col' || g.type === 'histogram',
  );
  if (barLikeGeoms.length > 0) {
    const hasHorizBars = barLikeGeoms.some(g => ('orientation' in g ? g.orientation : undefined) === 'y');
    let stackMin = Infinity;
    let stackMax = -Infinity;
    for (const layer of layerBindings) {
      for (const pt of layer as any[]) {
        if (pt._v0 !== undefined && Number.isFinite(pt._v0)) {
          stackMin = Math.min(stackMin, pt._v0);
          stackMax = Math.max(stackMax, pt._v0);
        }
        if (pt._v1 !== undefined && Number.isFinite(pt._v1)) {
          stackMin = Math.min(stackMin, pt._v1);
          stackMax = Math.max(stackMax, pt._v1);
        }
      }
    }
    if (isFinite(stackMin) && isFinite(stackMax)) {
      // ggplot2-style 5% expansion on the value axis so stacks never
      // touch the panel edge — the zero baseline stays pinned.
      const expand = (lo: number, hi: number): [number, number] => {
        const pad = (hi - lo) * 0.05;
        return [lo === 0 ? 0 : lo - pad, hi === 0 ? 0 : hi + pad];
      };
      if (hasHorizBars && (xType === 'linear' || xType === 'sqrt')) {
        const dom = (xScale as d3.ScaleLinear<number, number>).domain();
        (xScale as d3.ScaleLinear<number, number>).domain(
          expand(Math.min(dom[0], stackMin), Math.max(dom[1], stackMax)),
        );
      } else if (!hasHorizBars && (yType === 'linear' || yType === 'sqrt')) {
        const dom = (yScale as d3.ScaleLinear<number, number>).domain();
        (yScale as d3.ScaleLinear<number, number>).domain(
          expand(Math.min(dom[0], stackMin), Math.max(dom[1], stackMax)),
        );
      }
    }
  }

  // Color scale
  const colorScale = createColorScale(data, spec.aes, theme);

  return { x: xScale, y: yScale, color: colorScale, xType, yType, geomPad };
}

// ---------------------------------------------------------------------------
// Layout computation
// ---------------------------------------------------------------------------

/** Compute legend entries and required width. */
export function computeLegendInfo(
  spec: PlotSpec,
  data: DataPoint[],
  theme: ResolvedTheme,
): LegendInfo {
  const showLegend = spec.showLegend !== false;
  if (!showLegend || !spec.aes.color || data.length === 0) {
    return { entries: [], width: 0 };
  }
  const unique = Array.from(new Set(data.map(d => d[spec.aes.color!])));
  const palette = theme.colorPalette;
  const entries = unique.map((val, i) => ({
    label: String(val),
    color: palette[i % palette.length],
  }));
  const width = estimateLegendWidth(entries, spec.aes.color, theme);
  return { entries, width };
}

/** Approximate rendered text width in px (char count × average glyph width). */
export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.6;
}

/** d3 axis default tickPadding (gap between tick line and label). */
const AXIS_TICK_PADDING = 3;

/**
 * Estimate the widest y-axis tick label in px. Pure — mirrors the labels
 * renderPanel will produce: category values for band scales, formatted
 * Wilkinson breaks for continuous scales.
 */
export function estimateYTickLabelWidth(
  spec: PlotSpec,
  data: DataPoint[],
  theme: ResolvedTheme,
): number {
  const yField = spec.aes.y;
  if (!yField || data.length === 0) return 0;

  const yCfg = parseScaleConfig(spec.scales?.y);
  const inferred = inferScaleType(data, yField);
  const yType = normalizeScaleType(yCfg.type, inferred, 'y', false);

  let labels: string[];
  if (yType === 'ordinal' || yType === 'category') {
    labels = Array.from(new Set(data.map(d => String(d[yField]))));
  } else if (yType === 'time') {
    // d3 time tick labels are short ("March", "12:00", "2024") — assume ~6 chars
    labels = ['MMMMMM'];
  } else {
    let lo = Infinity;
    let hi = -Infinity;
    for (const d of data) {
      const v = Number(d[yField]);
      if (Number.isFinite(v)) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    if (!isFinite(lo) || !isFinite(hi)) return 0;
    if (yCfg.min !== undefined) lo = yCfg.min;
    if (yCfg.max !== undefined) hi = yCfg.max;
    labels = formatBreaksAs(extendedBreaks(lo, hi, theme.nBreaks), yCfg.labels);
  }

  let maxWidth = 0;
  for (const label of labels) {
    maxWidth = Math.max(maxWidth, estimateTextWidth(label, theme.axisTextSize));
  }
  return maxWidth;
}

/** Compute layout dimensions from spec + theme. */
export function computeLayout(
  spec: PlotSpec,
  theme: ResolvedTheme,
  legendWidth: number,
  margin?: { top: number; right: number; bottom: number; left: number },
  /** Whether a subtitle/notice line will be drawn above the panel. */
  hasSubtitle?: boolean,
): PlotLayout {
  const width = spec.width ?? 600;
  const height = spec.height ?? 400;

  let baseMargin = margin ?? theme.margin;
  if (!margin) {
    // The theme's static left margin budgets one font-height for tick labels,
    // which clips wide labels (e.g. category names on a horizontal strip plot).
    // Grow the margin to fit the widest estimated y tick label, capped at 40%
    // of the chart width so extreme labels can't squeeze out the panel.
    const labelWidth = estimateYTickLabelWidth(spec, spec.data ?? [], theme);
    const required = Math.ceil(
      theme.halfLine * 2                             // outer plot margin
      + theme.axisTitleSize + theme.axisTitleMargin  // y-axis title strip
      + labelWidth
      + theme.tickLength + AXIS_TICK_PADDING,
    );
    const cap = Math.floor(width * 0.4);
    const left = Math.max(theme.margin.left, Math.min(required, cap));
    baseMargin = { ...theme.margin, left };
  }

  const effectiveMargin = {
    ...baseMargin,
    right: baseMargin.right + legendWidth,
    // Subtitle sits above the panel — reserve a line plus breathing room.
    top: baseMargin.top
      + (hasSubtitle ?? !!spec.subtitle ? Math.round(theme.plotCaptionSize * 1.9) : 0),
  };
  return {
    width,
    height,
    innerWidth: width - effectiveMargin.left - effectiveMargin.right,
    innerHeight: height - effectiveMargin.top - effectiveMargin.bottom,
    margin: effectiveMargin,
  };
}

// ---------------------------------------------------------------------------
// buildPlot — the main pipeline orchestrator (pure)
// ---------------------------------------------------------------------------

/**
 * Build a plot from a spec — the pure data pipeline.
 *
 * PlotSpec → resolveGeoms → computeStat → validateAes → computeAesthetics
 * → computeSizeScale → trainScales → BuiltPlot
 *
 * No DOM, no D3 selections. Only data in → data out.
 */
/**
 * Resolve the subtitle: an explicit string passes through, 'auto' only
 * speaks up when the plot does something invisible (auto-picked geom,
 * summing, binning, density), 'always' describes unconditionally.
 *
 * `inputSpec` is the pre-resolution spec — it reveals whether the geom
 * was chosen by the user or inferred.
 */
function resolveSubtitle(
  spec: PlotSpec,
  inputSpec: PlotSpec,
  preStatSpec: PlotSpec,
  rawData: DataPoint[],
): string | undefined {
  // Data notices outrank the subtitle setting: the reader has to learn
  // that marks are missing, or that rows were collapsed, even when
  // descriptions are switched off.
  const notes: string[] = [];
  if (spec.truncation) {
    notes.push(`showing a sample of ${spec.truncation.shown.toLocaleString()} rows — the source has more`);
  }
  if (spec.warnAggregated) {
    const descriptions = preStatSpec.layers.map(layer => ({
      geom: layer.geom.type,
      stat: resolveLayerStat(layer, preStatSpec.aes, rawData),
    }));
    if (shouldWarnAggregated(descriptions, preStatSpec.aes, rawData)) {
      notes.push(AGGREGATION_NOTE);
    }
  }
  const noteLine = notes.length > 0 ? notes.join(' · ') : undefined;
  const withNote = (line: string | undefined) =>
    line && noteLine ? `${line} · ${noteLine}` : line ?? noteLine;

  const mode = spec.subtitle;
  if (!mode) return withNote(undefined);
  if (mode !== 'auto' && mode !== 'always') return withNote(mode);

  const autoGeom = inputSpec.layers.length === 0;
  const descriptions: LayerDescription[] = preStatSpec.layers.map(layer => ({
    geom: layer.geom.type,
    stat: resolveLayerStat(layer, preStatSpec.aes, rawData),
    autoGeom,
  }));

  if (mode === 'auto' && !hasHiddenTransform(descriptions)) return withNote(undefined);

  // Labels come from the PRE-stat spec: after a stat the aesthetic points
  // at a synthetic field (__sum, __count), which means nothing to a reader.
  const labels = fieldLabelsFor(preStatSpec, spec.fieldLabels ?? {});
  return withNote(describePlot(descriptions, labels, {
    rowCount: rawData.length,
    showRowCount: false,
  }) ?? undefined);
}

/** Synthetic colour key marking unhighlighted rows (row-level gghighlight). */
export const HIGHLIGHT_UNHL = '__ggpbi_unhighlighted__';

/**
 * Apply gghighlight semantics to bound layer data:
 * - reorder points so unhighlighted marks draw first (underneath),
 * - without a colour aesthetic, tag unhighlighted rows with a synthetic
 *   colour key that the wrapped colour scale maps to grey.
 * Scales and legend stay trained on the FULL data, so highlighted groups
 * keep exactly the colours they would have without highlighting.
 */
export function applyHighlightToBindings(
  bindings: BoundPoint[][],
  spec: PlotSpec,
): BoundPoint[][] {
  const hl = spec.highlight;
  if (!hl) return bindings;
  const colorField = spec.aes.color;

  return bindings.map((points, li) => {
    const geom = spec.layers[li]?.geom;
    // Per-layer opt-out: exempted layers stay completely untouched.
    if (geom?.highlight === false) return points;
    const isHighlighted = (bp: BoundPoint): boolean => {
      if (colorField) {
        // Group semantics: judged via the row itself is not enough — the
        // group verdict was precomputed on spec (any row passes). Recompute
        // cheaply per point group using the filter on the row.
        return groupVerdict(points, bp, colorField, hl.filter);
      }
      return hl.filter(bp.datum);
    };

    // Text layers get gghighlight's direct-label semantics: only the
    // highlighted rows keep their labels — grey labels on grey points are
    // noise, and the repel search gets room to breathe. Exempt a text
    // layer with highlight: false to keep every label.
    if (geom?.type === 'text') {
      return points.filter(isHighlighted);
    }

    const unhl: BoundPoint[] = [];
    const hlPts: BoundPoint[] = [];
    for (const bp of points) {
      if (isHighlighted(bp)) hlPts.push(bp);
      else unhl.push(colorField ? bp : { ...bp, color: HIGHLIGHT_UNHL });
    }
    return [...unhl, ...hlPts];
  });
}

/** Cache of group→highlighted verdicts per bindings array. */
const groupVerdictCache = new WeakMap<BoundPoint[], Map<string, boolean>>();
function groupVerdict(
  points: BoundPoint[],
  bp: BoundPoint,
  colorField: string,
  filter: (d: DataPoint) => boolean,
): boolean {
  let cache = groupVerdictCache.get(points);
  if (!cache) {
    cache = new Map<string, boolean>();
    for (const p of points) {
      const key = String(p.datum[colorField]);
      if (!cache.get(key) && filter(p.datum)) cache.set(key, true);
      else if (!cache.has(key)) cache.set(key, false);
    }
    groupVerdictCache.set(points, cache);
  }
  return cache.get(String(bp.datum[colorField])) ?? false;
}

/**
 * Synthetic x field injected when a spec maps only y — every row gets the
 * empty-string category, producing one unlabelled band.
 */
export const X_PSEUDO_FIELD = '__x_all';

export function buildPlot(
  inputSpec: PlotSpec,
  externalMargin?: { top: number; right: number; bottom: number; left: number },
): BuiltPlot {
  const data = inputSpec.data ?? [];
  const theme = resolveTheme(inputSpec.theme);

  // Early exit for empty data
  if (data.length === 0) {
    const legend = computeLegendInfo(inputSpec, data, theme);
    const layout = computeLayout(inputSpec, theme, legend.width, externalMargin);
    return {
      spec: inputSpec,
      data,
      layers: [],
      scales: {
        x: null as any,
        y: null as any,
        xType: 'linear',
        yType: 'linear',
        geomPad: { x: 0, y: 0 },
      },
      theme,
      layout,
      legend,
      geomPadPx: { x: 0, y: 0 },
    };
  }

  // 1. Resolve auto-geom
  let spec = resolveGeoms(inputSpec);

  // 1.5 geom_col-style orientation inference for bar layers
  spec = inferBarOrientation(spec, data);

  // Snapshot before stats: resolveLayerStat must see the user's own
  // aesthetics — after a stat, aes.y points at __count/__sum and would
  // re-resolve to a different stat.
  const preStatSpec = spec;

  // 2. Compute stats (stat_count for bars)
  const statResult = computeStat(spec, data);
  spec = statResult.spec;
  let statData = statResult.data;

  // 2.5 Missing x → constant pseudo category. A y-only mapping (e.g. a
  // single measure) still needs an x position for every geom; a single
  // unlabelled band is the Grammar of Graphics equivalent of ggplot2's
  // implicit single group (one boxplot, one strip, …). The pseudo field
  // never appears in labels — its only value is the empty string.
  if (!spec.aes.x && spec.aes.y) {
    statData = statData.map(d => ({ ...d, [X_PSEUDO_FIELD]: '' }));
    spec = { ...spec, data: statData, aes: { ...spec.aes, x: X_PSEUDO_FIELD } };
  }

  // 3. Validate aesthetics
  validateAes(statData, spec.aes);

  // 4. Compute legend (needs data + theme for width estimation).
  // gghighlight: entries are computed from the FULL data first (stable
  // palette assignment), then filtered to highlighted groups only.
  const legend = computeLegendInfo(spec, statData, theme);
  if (spec.highlight && spec.aes.color) {
    const colorField = spec.aes.color;
    const hlGroups = new Set(
      statData.filter(spec.highlight.filter).map(d => String(d[colorField])),
    );
    legend.entries = legend.entries.filter(e => hlGroups.has(e.label));
    legend.width = legend.entries.length > 0
      ? estimateLegendWidth(legend.entries, colorField, theme)
      : 0;
  }

  // 5. Compute layout. The subtitle has to be resolved first: a data
  // notice can appear with descriptions switched off, and the line needs
  // its space reserved either way.
  const subtitleText = resolveSubtitle(spec, inputSpec, preStatSpec, data);
  // Code is generated from the spec as the user built it: after a stat the
  // aesthetics point at __sum / __count, which is precisely what the code
  // below would compute for them.
  const codeText = spec.showCode
    ? specToCode(preStatSpec, fieldLabelsFor(preStatSpec, spec.fieldLabels ?? {}))
    : undefined;
  const layout = computeLayout(spec, theme, legend.width, externalMargin, !!subtitleText);

  // 6. Bind data to aesthetics per layer
  let layerBindings = computeLayerBindings(statData, spec.aes, spec.layers, spec.scales);

  // 7. Apply size scale (returns new arrays, no mutation)
  layerBindings = computeSizeScale(layerBindings, statData, spec.aes.size);

  // 8. Position adjustments (dodge, stack, fill — pure data transforms)
  const positionedBindings: BoundPoint[][] = spec.layers.map((layer, i) => {
    const geom = layer.geom;
    const needsPosition = geom.type === 'bar' || geom.type === 'col' || geom.type === 'histogram';
    if (needsPosition) {
      return computePosition(layerBindings[i], geom);
    }
    return layerBindings[i];
  });

  // 8.5 gghighlight: unhighlighted marks draw first (underneath) and, in
  // row mode, carry a synthetic colour key the wrapped scale maps to grey.
  const finalBindings = applyHighlightToBindings(positionedBindings, spec);

  // 9. Train scales (also computes geom padding internally)
  const scales = trainScales(
    spec, statData, finalBindings,
    layout.innerWidth, layout.innerHeight, theme,
  );

  // 9.5 gghighlight: wrap the colour scale — unhighlighted groups/rows in
  // grey, everything highlighted keeps its trained colour.
  if (spec.highlight) {
    const grey = spec.highlight.color ?? '#BEBEBE';
    scales.colorBase = scales.color;
    if (spec.aes.color && scales.color) {
      const colorField = spec.aes.color;
      const hlGroups = new Set(
        statData.filter(spec.highlight.filter).map(d => String(d[colorField])),
      );
      const orig = scales.color;
      scales.color = Object.assign(
        ((v: string) => (hlGroups.has(String(v)) ? orig(v) : grey)) as any,
        orig,
      );
    } else {
      // Row mode: only unhighlighted points carry a colour (the synthetic
      // key) — highlighted points fall back to the layer's own colour.
      scales.color = Object.assign(
        ((_v: string) => grey) as any,
        d3.scaleOrdinal<string, string>().domain([HIGHLIGHT_UNHL]).range([grey]),
      );
    }
  }

  // 10. Build layers
  const builtLayers: BuiltLayer[] = spec.layers.map((layer, i) => {
    const layerAes = layer.aes ?? layer.geom.aes;
    return {
      geom: layer.geom,
      data: finalBindings[i],
      aes: layerAes ? mergeAes(spec.aes, layerAes) : spec.aes,
    };
  });

  return {
    spec,
    data: statData,
    layers: builtLayers,
    subtitleText,
    codeText,
    scales,
    theme,
    layout,
    legend,
    geomPadPx: scales.geomPad,
  };
}
