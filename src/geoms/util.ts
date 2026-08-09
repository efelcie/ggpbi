import * as d3 from 'd3';
import type { BoundPoint } from '../bind-data';
import type { LinetypeType, ShapeType } from '../types';

/** Default geom colour — ggplot2 Steel Blue (pch 19 default). */
export const GEOM_DEFAULT_COLOR = '#4682B4';

/** Default reference-line colour — near-black ink, like ggplot2 geom_hline/vline/abline. */
export const REFLINE_DEFAULT_COLOR = '#333333';

/** Sort points by x value (Dates by timestamp, numbers by value). */
export function sortByX(points: BoundPoint[]): BoundPoint[] {
  return [...points].sort((a, b) => {
    if (a.x instanceof Date && b.x instanceof Date) return a.x.getTime() - b.x.getTime();
    return Number(a.x) - Number(b.x);
  });
}

/** Group points by color aesthetic. Returns null if no color mapping. */
export function groupByColor(points: BoundPoint[]): Map<any, BoundPoint[]> | null {
  if (!points.some(p => p.color !== undefined)) return null;
  return d3.group(points, d => d.color);
}

// ---------------------------------------------------------------------------
// NA handling — centralized for all geoms
// ---------------------------------------------------------------------------

/**
 * Filter out NA/null/NaN values from bound points.
 *
 * Matches ggplot2 behaviour:
 * - naRm=true: silently remove NA values
 * - naRm=false (default): remove and warn once per call
 *
 * @param points  Input bound points
 * @param naRm    If true, suppress warning
 * @param geomName  Geom name for the warning message (e.g., 'point', 'bar')
 * @param fields  Which fields to check (default: ['x', 'y'])
 */
export function filterNA(
  points: BoundPoint[],
  naRm: boolean = false,
  geomName: string = 'geom',
  fields: Array<'x' | 'y'> = ['x', 'y'],
): BoundPoint[] {
  const isNA = (p: BoundPoint): boolean => {
    for (const f of fields) {
      const v = p[f];
      if (v == null) return true;
      if (typeof v === 'number' && isNaN(v)) return true;
      if (v instanceof Date && isNaN(v.getTime())) return true;
    }
    return false;
  };

  let naCount = 0;
  const filtered: BoundPoint[] = [];

  for (const p of points) {
    if (isNA(p)) {
      naCount++;
    } else {
      filtered.push(p);
    }
  }

  if (naCount > 0 && !naRm) {
    console.warn(
      `ggpbi: removed ${naCount} rows containing non-finite values (${geomName}).`,
    );
  }
  return filtered;
}

/** Convert linetype name to SVG stroke-dasharray value. */
export function linetypeToDasharray(linetype?: LinetypeType): string | null {
  switch (linetype) {
    case 'dashed':   return '6 4';
    case 'dotted':   return '2 3';
    case 'dashdot':  return '6 3 2 3';
    case 'longdash': return '10 4';
    case 'twodash':  return '2 2 8 2';
    default:         return null; // 'solid' or undefined
  }
}

/** Return band center offset (half bandwidth) for band scales, 0 for others. */
export function bandOffset(scale: any): number {
  return typeof scale.bandwidth === 'function' ? scale.bandwidth() / 2 : 0;
}

// --- Custom D3 symbol types for line-based shapes ---

/** Plus sign (+) — ggplot2 pch 3 */
const symbolPlus: d3.SymbolType = {
  draw(context: any, size: number) {
    const r = Math.sqrt(size / Math.PI);
    context.moveTo(0, -r);
    context.lineTo(0, r);
    context.moveTo(-r, 0);
    context.lineTo(r, 0);
  },
};

/** X cross — ggplot2 pch 4 */
const symbolXCross: d3.SymbolType = {
  draw(context: any, size: number) {
    const r = Math.sqrt(size / Math.PI) * 0.707;
    context.moveTo(-r, -r);
    context.lineTo(r, r);
    context.moveTo(r, -r);
    context.lineTo(-r, r);
  },
};

/** Asterisk (*) — ggplot2 pch 8 (plus + X combined) */
const symbolAsterisk: d3.SymbolType = {
  draw(context: any, size: number) {
    const r = Math.sqrt(size / Math.PI);
    const r2 = r * 0.707;
    context.moveTo(0, -r);
    context.lineTo(0, r);
    context.moveTo(-r, 0);
    context.lineTo(r, 0);
    context.moveTo(-r2, -r2);
    context.lineTo(r2, r2);
    context.moveTo(r2, -r2);
    context.lineTo(-r2, r2);
  },
};

// --- Shape info system ---

/**
 * Shape categories determine how fill/stroke are applied:
 * - filled:     fill = colour, no separate border
 * - open:       fill = none, stroke = colour (border only)
 * - fillBorder: fill = fill aesthetic, stroke = colour (two-tone)
 * - line:       fill = none, stroke = colour (line marks)
 */
export type ShapeCategory = 'filled' | 'open' | 'fillBorder' | 'line';

export interface ShapeInfo {
  symbol: d3.SymbolType;
  category: ShapeCategory;
}

const SHAPE_MAP: Record<ShapeType, ShapeInfo> = {
  // Filled (colour only — pch 19, 15, 17, 18)
  circle:   { symbol: d3.symbolCircle,   category: 'filled' },
  square:   { symbol: d3.symbolSquare,   category: 'filled' },
  triangle: { symbol: d3.symbolTriangle, category: 'filled' },
  diamond:  { symbol: d3.symbolDiamond,  category: 'filled' },
  // Open (border only — pch 1, 0, 2, 5)
  circleOpen:   { symbol: d3.symbolCircle,   category: 'open' },
  squareOpen:   { symbol: d3.symbolSquare,   category: 'open' },
  triangleOpen: { symbol: d3.symbolTriangle, category: 'open' },
  diamondOpen:  { symbol: d3.symbolDiamond,  category: 'open' },
  // Fill + Border (two-tone — pch 21, 22, 24, 23)
  circleFilled:   { symbol: d3.symbolCircle,   category: 'fillBorder' },
  squareFilled:   { symbol: d3.symbolSquare,   category: 'fillBorder' },
  triangleFilled: { symbol: d3.symbolTriangle, category: 'fillBorder' },
  diamondFilled:  { symbol: d3.symbolDiamond,  category: 'fillBorder' },
  // Line shapes (stroke only — pch 3, 4, 8, 11)
  plus:     { symbol: symbolPlus,     category: 'line' },
  cross:    { symbol: symbolXCross,   category: 'line' },
  asterisk: { symbol: symbolAsterisk, category: 'line' },
  star:     { symbol: d3.symbolStar,  category: 'line' },
};

/** Get shape info (symbol type + category) for a ShapeType. Defaults to circle. */
export function getShapeInfo(shape?: ShapeType): ShapeInfo {
  if (!shape) return SHAPE_MAP.circle;
  return SHAPE_MAP[shape] ?? SHAPE_MAP.circle;
}

/** Convert shape name to d3 symbol type (backwards-compatible). */
export function shapeToSymbol(shape?: ShapeType): d3.SymbolType {
  return getShapeInfo(shape).symbol;
}

/**
 * Mark thickness on a continuous axis, ggplot2-style.
 *
 * ggplot2 sizes bars and boxes by `resolution(x)` — the smallest gap
 * between adjacent distinct positions — so marks can touch but never
 * overlap. Dividing the panel evenly (`innerWidth / nCategories`) assumes
 * regular spacing; with irregular values (mtcars weights, say) the marks
 * are wider than their nearest neighbour is away, and overlap.
 *
 * @param positions scaled centres of the distinct category values, in px
 * @param evenShare fallback when fewer than two finite positions exist
 * @returns the smallest adjacent gap in px, or `evenShare`
 */
export function continuousBandPx(positions: number[], evenShare: number): number {
  const distinct = [...new Set(positions.filter(p => Number.isFinite(p)))].sort((a, b) => a - b);
  if (distinct.length < 2) return evenShare;
  let min = Infinity;
  for (let i = 1; i < distinct.length; i++) min = Math.min(min, distinct[i] - distinct[i - 1]);
  return min;
}
