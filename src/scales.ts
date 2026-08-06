import * as d3 from 'd3';
import { ScaleType, DataPoint } from './types';

/** Union of all D3 scale types returned by createScale. */
export type GgpbiScale =
  | d3.ScaleLinear<number, number>
  | d3.ScaleLogarithmic<number, number>
  | d3.ScalePower<number, number>
  | d3.ScaleTime<number, number>
  | d3.ScaleOrdinal<string, number>
  | d3.ScaleBand<string>;

/** Options for band scale layout (ordinal/category). */
export interface BandScaleOptions {
  /** Gap between bars as fraction of step (default 0.1 → 90% bar, 10% gap, like ggplot2 width=0.9). */
  paddingInner?: number;
  /** Outer padding as fraction of step (default 0.5 → ggplot2-style expansion). */
  paddingOuter?: number;
}

/**
 * Create a D3 scale from data domain to visual range
 */
export function createScale(
  data: DataPoint[],
  field: string,
  type: ScaleType,
  range: [number, number],
  bandOptions?: BandScaleOptions
): GgpbiScale {

  const values = data.map(d => d[field]);

  const asNumber = (v: any): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const s = v.trim();
      if (s !== '' && Number.isFinite(Number(s))) return Number(s);
    }
    return null;
  };

  // An empty field and a field of the wrong type fail the same checks below,
  // but they need opposite advice: "swap the field" is wrong for a measure
  // that is simply BLANK under the current slicer — the everyday case in a
  // filtered report. Separate the two before the type-specific errors.
  // Only null/undefined/NaN count as absent: the empty string is a real
  // category value, and the y-only pseudo-x band is built from it.
  const isBlank = (v: any) => v == null || (typeof v === 'number' && Number.isNaN(v));
  if (values.length === 0 || values.every(isBlank)) {
    throw new Error(`ggpbi: field "${field}" has no values in the current filter context`);
  }

  switch (type) {
    case 'linear': {
      const numeric = values.map(asNumber).filter((v): v is number => v != null);
      if (numeric.length === 0) throw new Error(`ggpbi: no numeric values in field "${field}" for linear scale`);
      const extent = d3.extent(numeric) as [number, number];
      return d3.scaleLinear()
        .domain(extent)
        .range(range);
    }

    case 'log': {
      const positive = values.map(asNumber).filter((v): v is number => v != null && v > 0);
      if (positive.length === 0) throw new Error(`ggpbi: no positive values in field "${field}" for log scale`);
      const extent = d3.extent(positive) as [number, number];
      return d3.scaleLog()
        .domain(extent)
        .range(range);
    }

    case 'sqrt': {
      const nonNeg = values.map(asNumber).filter((v): v is number => v != null && v >= 0);
      if (nonNeg.length === 0) throw new Error(`ggpbi: no non-negative values in field "${field}" for sqrt scale`);
      const extent = d3.extent(nonNeg) as [number, number];
      return d3.scaleSqrt()
        .domain(extent)
        .range(range);
    }

    case 'time': {
      const dates = values.filter(v => v instanceof Date);
      if (dates.length === 0) throw new Error(`ggpbi: no Date values in field "${field}" for time scale`);
      const extent = d3.extent(dates) as [Date, Date];
      return d3.scaleTime()
        .domain(extent)
        .range(range);
    }

    case 'ordinal':
    case 'category': {
      const unique = Array.from(new Set(values.map(String)));
      if (unique.length === 0) throw new Error(`ggpbi: no values in field "${field}" for ordinal scale`);
      const band = d3.scaleBand<string>()
        .domain(unique)
        .range(range)
        .paddingInner(bandOptions?.paddingInner ?? 0.1)
        .paddingOuter(bandOptions?.paddingOuter ?? 0.5);
      // The domain is stringified, so lookups must be too — otherwise numeric
      // values (e.g. dose 0.5 with an explicit category scale) miss the band
      // and every mark lands at NaN. Wrap the scale to normalise its argument;
      // Object.assign carries over domain/range/bandwidth/… accessors.
      return Object.assign(
        ((v: unknown) => band(String(v))) as unknown as d3.ScaleBand<string>,
        band
      );
    }
    
    default:
      throw new Error(`Unknown scale type: ${type}`);
  }
}

/**
 * Infer scale type from data
 */
export function inferScaleType(data: DataPoint[], field: string): ScaleType {
  const sample = data.find(d => d[field] !== null && d[field] !== undefined);
  if (!sample) return 'linear';

  const value = sample[field];

  if (value instanceof Date) return 'time';
  if (typeof value === 'number') return 'linear';

  // Power BI sometimes delivers numeric grouping fields as strings.
  if (typeof value === 'string') {
    const s = value.trim();
    if (s !== '' && Number.isFinite(Number(s))) return 'linear';
  }

  return 'ordinal';
}

/**
 * Create a size scale like ggplot2's `scale_size()` — area-proportional.
 * Maps continuous data values to pixel radii.
 *
 * The radius range is wider than ggplot2's `c(1, 6)` because those are
 * millimetres on a 7-inch device while these are pixels: with a default
 * point radius of 4, a bubble range topping out at 6 made the largest
 * bubble barely bigger than an ordinary point.
 *
 * @param data - Data points
 * @param field - Field name for the size aesthetic
 * @param range - Output radius range in pixels
 */
export function createSizeScale(
  data: DataPoint[],
  field: string,
  range: [number, number] = [2, 12],
): d3.ScaleLinear<number, number> {
  const values = data
    .map(d => {
      const v = d[field];
      return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
    })
    .filter(v => !Number.isNaN(v));

  if (values.length === 0) {
    return d3.scaleLinear().domain([0, 1]).range(range);
  }

  const extent = d3.extent(values) as [number, number];
  // When all values are equal, map to midpoint of range
  if (extent[0] === extent[1]) {
    const mid = (range[0] + range[1]) / 2;
    return d3.scaleLinear().domain(extent).range([mid, mid]);
  }

  // ggplot2's scale_size() is AREA-proportional (`area_pal`): normalise to
  // [0, 1], take the square root, then map into the radius range. A linear
  // radius map looks wrong twice over — the drawn area grows with r², so
  // large values scream, and small ones collapse together: with mtcars hp
  // it put 17 of 32 cars below r = 2.5, which reads as "all the same size".
  const [lo, hi] = extent;
  const [rMin, rMax] = range;
  const scale = ((value: number) => {
    const v = Number(value);
    if (!Number.isFinite(v)) return rMin;
    const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
    return rMin + (rMax - rMin) * Math.sqrt(t);
  }) as unknown as d3.ScaleLinear<number, number>;
  // Keep the d3 scale surface callers may inspect.
  scale.domain = (() => extent) as never;
  scale.range = (() => range) as never;
  return scale;
}
