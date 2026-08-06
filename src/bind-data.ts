import { DataPoint, AesMapping } from './types';

/**
 * A resolved aesthetic value for a single data point.
 * Raw values extracted from data based on aesthetic mappings.
 */
export interface BoundPoint {
  x: any;
  y: any;
  color?: any;
  size?: any;
  shape?: any;
  alpha?: any;
  fill?: any;
  label?: any;
  weight?: any;
  group?: any;
  /** Segment end position (geom_segment). */
  xend?: any;
  yend?: any;
  /** Range bounds (geom_pointrange). */
  xmin?: any;
  xmax?: any;
  ymin?: any;
  ymax?: any;
  /** Original data point for tooltips etc. */
  datum: DataPoint;
}

/**
 * Validate that required aesthetic mappings are set and that
 * the mapped field names actually exist in the data.
 * Throws with a specific message on failure.
 */
export function validateAes(data: DataPoint[], aes: AesMapping, geomTypes?: string[]): void {
  const isBoxplotOnly = geomTypes != null && geomTypes.length > 0 && geomTypes.every(t => t === 'boxplot');

  // Boxplot-only plots only require y (x is optional for a single boxplot without grouping).
  if (!isBoxplotOnly) {
    if (!aes.x) throw new Error('ggpbi: aes.x is not set — which column should map to the x-axis?');
  }
  if (!aes.y) throw new Error('ggpbi: aes.y is not set — which column should map to the y-axis?');

  const sample = data[0];
  if (!sample) return; // empty data is handled elsewhere

  if (aes.x && !(aes.x in sample)) {
    const available = Object.keys(sample).join(', ');
    throw new Error(`ggpbi: field "${aes.x}" not found in data. Available: ${available}`);
  }
  if (!(aes.y in sample)) {
    const available = Object.keys(sample).join(', ');
    throw new Error(`ggpbi: field "${aes.y}" not found in data. Available: ${available}`);
  }
}

/**
 * Bind data to aesthetic mappings.
 * Extracts the raw values from each data point based on aes config.
 */
export function bindData(data: DataPoint[], aes: AesMapping): BoundPoint[] {
  return data.map(datum => {
    const bound: BoundPoint = {
      x: aes.x ? datum[aes.x] : undefined,
      y: aes.y ? datum[aes.y] : undefined,
      datum,
    };

    if (aes.color) bound.color = datum[aes.color];
    if (aes.size) bound.size = datum[aes.size];
    if (aes.shape) bound.shape = datum[aes.shape];
    if (aes.alpha) bound.alpha = datum[aes.alpha];
    if (aes.fill) bound.fill = datum[aes.fill];
    if (aes.label) bound.label = datum[aes.label];
    if (aes.weight) bound.weight = datum[aes.weight];
    if (aes.group) bound.group = datum[aes.group];
    if (aes.xend) bound.xend = datum[aes.xend];
    if (aes.yend) bound.yend = datum[aes.yend];
    if (aes.xmin) bound.xmin = datum[aes.xmin];
    if (aes.xmax) bound.xmax = datum[aes.xmax];
    if (aes.ymin) bound.ymin = datum[aes.ymin];
    if (aes.ymax) bound.ymax = datum[aes.ymax];

    return bound;
  });
}
