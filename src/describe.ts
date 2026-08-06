/**
 * Plain-language description of what a plot actually does.
 *
 * Auto-geom and auto-stat are convenient but invisible: a bar chart over
 * row-level data silently sums, a histogram silently bins, "Auto" silently
 * picks a geom. This module turns the resolved spec back into a sentence
 * ("Sum of len by dose, coloured by supp") so the chart can state its own
 * transformation instead of leaving the reader to guess.
 *
 * Pure — no DOM, no side effects.
 */

import type { PlotSpec, DataPoint, GeomType, StatType, AesMapping } from './types';

/** Display names per aesthetic, overriding the raw field names. */
export type FieldLabels = Partial<Record<keyof AesMapping, string>>;

/** What the description generator needs to know about one layer. */
export interface LayerDescription {
  geom: GeomType;
  stat: StatType;
  /** True when the geom came from auto-detection rather than an explicit choice. */
  autoGeom?: boolean;
}

/** Human-readable geom names (used when no stat dominates the sentence). */
const GEOM_NOUN: Partial<Record<GeomType, string>> = {
  point: 'Values',
  line: 'Values',
  area: 'Values',
  bar: 'Values',
  col: 'Values',
  boxplot: 'Boxplot',
  violin: 'Violin',
  density: 'Density',
  histogram: 'Histogram',
  smooth: 'Trend',
  segment: 'Segments',
  pointrange: 'Ranges',
  text: 'Labels',
};

/**
 * Build the leading phrase — what is shown, including any computation the
 * visual performed on its own.
 */
function leadPhrase(layer: LayerDescription, labels: FieldLabels): string {
  const y = labels.y;
  const x = labels.x;

  switch (layer.stat) {
    case 'sum':
      return y ? `Sum of ${y}` : 'Sum';
    case 'count':
      return 'Count of rows';
    case 'bin':
      return x ? `Histogram of ${x}` : 'Histogram';
    case 'density':
      return x ? `Density of ${x}` : 'Density';
    case 'boxplot':
      return y ? `Boxplot of ${y}` : 'Boxplot';
    case 'smooth':
      return y ? `Trend of ${y}` : 'Trend';
    default: {
      const noun = GEOM_NOUN[layer.geom] ?? 'Values';
      if (noun === 'Values') return y ? y : x ?? 'Values';
      return y ? `${noun} of ${y}` : noun;
    }
  }
}

/**
 * Describe a plot in one sentence.
 *
 * Returns null when there is nothing meaningful to say (no layers, no
 * aesthetics).
 */
export function describePlot(
  layers: LayerDescription[],
  labels: FieldLabels,
  options: { rowCount?: number; showRowCount?: boolean } = {},
): string | null {
  if (layers.length === 0) return null;
  if (!labels.x && !labels.y) return null;

  const primary = layers[0];
  const parts: string[] = [leadPhrase(primary, labels)];

  // "by <x>" — the grouping/positional axis, unless the stat already
  // consumed x (histogram/density are ABOUT x, not grouped by it).
  const statOwnsX = primary.stat === 'bin' || primary.stat === 'density';
  if (labels.x && !statOwnsX && labels.x !== labels.y) {
    parts.push(`by ${labels.x}`);
  }

  let sentence = parts.join(' ');

  if (labels.color) sentence += `, coloured by ${labels.color}`;
  if (labels.size) sentence += `, sized by ${labels.size}`;
  if (labels.facetCol || labels.facetRow) {
    sentence += `, split by ${labels.facetCol ?? labels.facetRow}`;
  }

  // Additional layers worth naming (a trend line over points, labels, …).
  const extras = layers
    .slice(1)
    .map(l => (l.stat === 'smooth' ? 'trend line' : GEOM_NOUN[l.geom]?.toLowerCase()))
    .filter((n): n is string => !!n && n !== 'values');
  const uniqueExtras = [...new Set(extras)];
  if (uniqueExtras.length > 0) sentence += ` · with ${uniqueExtras.join(', ')}`;

  if (options.showRowCount && options.rowCount != null) {
    sentence += ` · ${options.rowCount.toLocaleString()} rows`;
  }

  return sentence;
}

/**
 * Does this plot perform something the reader cannot see from the marks —
 * an aggregation, a binning, an auto-picked geom? Used for the "auto"
 * description mode, which stays quiet when everything is explicit.
 */
export function hasHiddenTransform(layers: LayerDescription[]): boolean {
  return layers.some(
    l => l.autoGeom
      || l.stat === 'sum'
      || l.stat === 'count'
      || l.stat === 'bin'
      || l.stat === 'density',
  );
}

/** Collect the labels for a spec, preferring explicit display names. */
export function fieldLabelsFor(spec: PlotSpec, overrides: FieldLabels = {}): FieldLabels {
  const aes = spec.aes;
  const pick = (key: keyof AesMapping): string | undefined => {
    if (overrides[key]) return overrides[key];
    const field = aes[key];
    if (typeof field !== 'string') return undefined;
    // Internal synthetic fields carry no meaning for a reader.
    if (field.startsWith('__')) return undefined;
    return field;
  };
  return {
    x: pick('x'),
    y: pick('y'),
    color: pick('color'),
    size: pick('size'),
    facetCol: pick('facetCol'),
    facetRow: pick('facetRow'),
  };
}

/** Row count of the data behind a plot (post-stat rows are not meaningful). */
export function describedRowCount(data: DataPoint[]): number {
  return data.length;
}
