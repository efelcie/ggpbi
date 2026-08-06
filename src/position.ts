/**
 * Position adjustments — pure data transforms, no DOM, no scales.
 *
 * Like ggplot2's position_dodge(), position_stack(), position_fill():
 * all adjustments happen in DATA space before scales are applied.
 *
 * Each function returns NEW arrays (no mutation).
 */

import type { BoundPoint } from './bind-data';
import type { GeomConfig, PositionType } from './types';

// ---------------------------------------------------------------------------
// Positioned point — BoundPoint enriched with position metadata
// ---------------------------------------------------------------------------

export interface PositionedPoint extends BoundPoint {
  /** Stack/fill: lower edge in data coordinates. */
  _v0?: number;
  /** Stack/fill: upper edge in data coordinates. */
  _v1?: number;
  /** Dodge: which color group (0-based index). */
  _dodgeIndex?: number;
  /** Dodge: total number of color groups. */
  _dodgeN?: number;
  /** Dodge: use padding between sub-bars (dodge2). */
  _dodgePadded?: boolean;
}

// ---------------------------------------------------------------------------
// position_dodge / position_dodge2
// ---------------------------------------------------------------------------

/**
 * Annotate points with dodge group info.
 * The renderer uses _dodgeIndex and _dodgeN to compute pixel offsets.
 *
 * Like ggplot2's position_dodge(): each color group gets its own sub-bar
 * within the category bandwidth.
 */
export function applyDodge(
  points: BoundPoint[],
  padded: boolean = false,
): PositionedPoint[] {
  const colorGroups = Array.from(
    new Set(points.map(d => String(d.color ?? '__none__'))),
  );
  const nColors = colorGroups.length;

  return points.map(d => ({
    ...d,
    _dodgeIndex: colorGroups.indexOf(String(d.color ?? '__none__')),
    _dodgeN: nColors,
    _dodgePadded: padded,
  }));
}

// ---------------------------------------------------------------------------
// position_stack
// ---------------------------------------------------------------------------

/**
 * Compute cumulative stack positions in DATA coordinates.
 * Each point gets _v0 (bottom edge) and _v1 (top edge).
 *
 * Like ggplot2's position_stack(): positive values stack upward,
 * negative values stack downward (diverging stacks).
 */
export function applyStack(
  points: BoundPoint[],
  orientation: 'x' | 'y' = 'x',
): PositionedPoint[] {
  const isHorizontal = orientation === 'y';
  const catKey = (d: BoundPoint) => String(isHorizontal ? d.y : d.x);
  const seriesKey = (d: BoundPoint) => `${String(d.group ?? '')}|${String(d.color ?? '')}`;

  // Group by category
  const groups = new Map<string, BoundPoint[]>();
  for (const d of points) {
    const key = catKey(d);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }

  // Within a category, stack by colour/group like ggplot2's
  // position_stack — all rows of one group form ONE contiguous block.
  // Stacking in raw data order interleaves the groups and turns a
  // two-colour bar into stripes.
  const seriesOrder = new Map<string, number>();
  for (const d of points) {
    const key = seriesKey(d);
    if (!seriesOrder.has(key)) seriesOrder.set(key, seriesOrder.size);
  }
  if (seriesOrder.size > 1) {
    for (const group of groups.values()) {
      group.sort((a, b) => seriesOrder.get(seriesKey(a))! - seriesOrder.get(seriesKey(b))!);
    }
  }

  // Build index for fast lookup (preserves original order)
  const result: PositionedPoint[] = new Array(points.length);
  const pointIndex = new Map<BoundPoint, number>();
  for (let i = 0; i < points.length; i++) {
    pointIndex.set(points[i], i);
  }

  for (const [, group] of groups) {
    let cumPos = 0;
    let cumNeg = 0;

    for (const d of group) {
      const val = Number(isHorizontal ? d.x : d.y);
      const idx = pointIndex.get(d)!;

      // Non-finite values must not poison the cumulative sums — one NaN
      // would make every later segment in the category NaN. Emit a
      // zero-height segment and let the geom's NA filter drop/warn it.
      if (!Number.isFinite(val)) {
        result[idx] = { ...d, _v0: cumPos, _v1: cumPos };
        continue;
      }

      if (val >= 0) {
        result[idx] = { ...d, _v0: cumPos, _v1: cumPos + val };
        cumPos += val;
      } else {
        result[idx] = { ...d, _v0: cumNeg + val, _v1: cumNeg };
        cumNeg += val;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// position_fill
// ---------------------------------------------------------------------------

/**
 * Like position_stack but normalised to [0, 1] per category.
 *
 * Like ggplot2's position_fill(): each stack sums to 1.0 (100%).
 */
export function applyFill(
  points: BoundPoint[],
  orientation: 'x' | 'y' = 'x',
): PositionedPoint[] {
  // First stack normally
  const stacked = applyStack(points, orientation);

  const isHorizontal = orientation === 'y';
  const catKey = (d: BoundPoint) => String(isHorizontal ? d.y : d.x);

  // Compute positive and negative totals per category separately.
  // ggplot2 normalizes each direction independently:
  // positive values → [0, 1], negative values → [-1, 0].
  const posTotal = new Map<string, number>();
  const negTotal = new Map<string, number>();
  for (const d of stacked) {
    const key = catKey(d);
    const v1 = d._v1!;
    const v0 = d._v0!;
    if (v1 > 0) posTotal.set(key, Math.max(posTotal.get(key) ?? 0, v1));
    if (v0 < 0) negTotal.set(key, Math.min(negTotal.get(key) ?? 0, v0));
  }

  // Normalize
  return stacked.map(d => {
    const key = catKey(d);
    const v0 = d._v0!;
    const v1 = d._v1!;
    // Determine which total to use based on whether this bar is positive or negative
    if (v1 > 0 && v0 >= 0) {
      // Fully positive segment
      const total = posTotal.get(key) ?? 1;
      if (total === 0) return d;
      return { ...d, _v0: v0 / total, _v1: v1 / total };
    } else if (v0 < 0 && v1 <= 0) {
      // Fully negative segment
      const total = Math.abs(negTotal.get(key) ?? -1);
      if (total === 0) return d;
      return { ...d, _v0: v0 / total, _v1: v1 / total };
    }
    // Zero or mixed — leave as-is (shouldn't happen with standard stacking)
    return d;
  });
}

// ---------------------------------------------------------------------------
// computePosition — dispatcher
// ---------------------------------------------------------------------------

/**
 * Apply position adjustments for a layer.
 * Pure function: BoundPoint[] → PositionedPoint[].
 *
 * Pipeline stage 5: between computeStat and trainScales.
 */
export function computePosition(
  points: BoundPoint[],
  geom: GeomConfig,
): PositionedPoint[] {
  const position: PositionType = geom.position ?? 'stack';
  const orientation = ('orientation' in geom ? geom.orientation : undefined) ?? 'x';

  switch (position) {
    case 'dodge':
      return applyDodge(points);
    case 'dodge2':
      return applyDodge(points, true);
    case 'stack':
      return applyStack(points, orientation);
    case 'fill':
      return applyFill(points, orientation);
    case 'identity':
    case 'jitter':
      // Identity: no adjustment. Jitter: computed later in renderer (scale-dependent).
      return points.map(d => ({ ...d }));
  }
}
