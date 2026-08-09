import * as d3 from 'd3';
import { BarGeomConfig, PositionType } from '../types';
import { BoundPoint } from '../bind-data';
import type { PositionedPoint } from '../position';
import type { RectNode, NodeStyle } from '../scene-types';
import { linetypeToDasharray, GEOM_DEFAULT_COLOR, filterNA, continuousBandPx } from './util';


// ---------------------------------------------------------------------------
// Bar Scene Builder — pure geometry computation, no DOM
// ---------------------------------------------------------------------------

/** Compute bar base style (shared across all position types). */
function computeBarStyle(
  d: BoundPoint,
  config: BarGeomConfig,
  colorScale?: any,
): NodeStyle {
  const defaultAlpha = config.alpha ?? 0.85;
  const defaultColor = config.color ?? GEOM_DEFAULT_COLOR;
  const stroke = config.stroke ?? null;
  const strokeWidth = config.strokeWidth ?? 0;
  const dasharray = linetypeToDasharray(config.linetype);

  const fill = (d.color && colorScale) ? colorScale(d.color) : defaultColor;
  const opacity = d.alpha ?? defaultAlpha;

  const style: NodeStyle = { fill, opacity };

  if (stroke) {
    style.stroke = stroke;
  }
  if (strokeWidth > 0) {
    style.strokeWidth = strokeWidth;
    if (!stroke) style.stroke = '#333333';
  }
  if (dasharray) {
    style.strokeDasharray = dasharray;
  }
  if (strokeWidth > 0 || stroke) {
    style.strokeLinecap = config.lineend ?? 'butt';
    style.strokeLinejoin = config.linejoin ?? 'miter';
    if ((config.linejoin ?? 'miter') === 'miter') {
      style.strokeMiterlimit = config.linemitre ?? 10;
    }
  }

  return style;
}

/** Compute aria label for a bar. */
function barAriaLabel(d: BoundPoint, isHorizontal: boolean): string {
  const xVal = typeof d.x === 'number' ? d.x.toLocaleString() : String(d.x);
  const yVal = typeof d.y === 'number' ? d.y.toLocaleString() : String(d.y);
  return isHorizontal ? `${yVal}: ${xVal}` : `${xVal}: ${yVal}`;
}

/**
 * Compute bar geometry as SceneNodes.
 *
 * Pure function: BoundPoint[] + scales + config → RectNode[].
 * No DOM, no D3 selections. Testable without JSDOM.
 *
 * Position adjustments (dodge, stack, fill) must be pre-computed on the points.
 */
export function barsToScene(
  points: BoundPoint[],
  xScale: any,
  yScale: any,
  config: BarGeomConfig,
  colorScale?: any,
  innerWidth?: number,
): RectNode[] {
  const isHorizontal = config.orientation === 'y';
  // The value aesthetic is x for horizontal bars, y for vertical ones
  const barPoints = filterNA(
    points, config.naRm, 'geom_bar', isHorizontal ? ['x'] : ['y'],
  ) as PositionedPoint[];
  if (barPoints.length === 0) return [];

  const position: PositionType = config.position ?? 'stack';
  const widthFraction = config.width ?? 0.9;
  const just = config.just ?? 0.5;

  const catScale = isHorizontal ? yScale : xScale;
  const valScale = isHorizontal ? xScale : yScale;
  const isBand = typeof catScale.bandwidth === 'function';

  // Bar thickness. On a continuous axis the width follows ggplot2's
  // resolution(): the smallest gap between adjacent distinct positions,
  // so bars at irregular x values can touch but never overlap.
  const catGroups = d3.group(barPoints, d => String(isHorizontal ? d.y : d.x));
  const nCategories = catGroups.size || barPoints.length;
  const catPositions = [...catGroups.values()]
    .map(g => Number(catScale(isHorizontal ? g[0].y : g[0].x)));
  const baseBandWidth = isBand
    ? catScale.bandwidth() * widthFraction
    : innerWidth
      ? Math.max(1, continuousBandPx(catPositions, (innerWidth / nCategories) * 0.8) * widthFraction)
      : 20;

  // Justification
  const bandSpace = isBand ? catScale.bandwidth() : baseBandWidth;
  const justOffset = (bandSpace - baseBandWidth) * just;

  const barCatPos = (d: BoundPoint) => {
    const catVal = isHorizontal ? d.y : d.x;
    const pos = catScale(catVal);
    return isBand ? pos + justOffset : pos - baseBandWidth * just;
  };

  const valZero = (() => {
    try { return valScale(0); }
    catch { return isHorizontal ? 0 : valScale.range()[0]; }
  })();

  const nodes: RectNode[] = [];

  // Dodge params (computed once from first point)
  let dodgeWidth = baseBandWidth;
  let dodgePadding = 0;
  if (position === 'dodge' || position === 'dodge2') {
    const sample = barPoints[0];
    const nColors = sample._dodgeN ?? 1;
    const padded = sample._dodgePadded ?? false;
    dodgePadding = padded ? baseBandWidth / nColors * 0.1 : 0;
    dodgeWidth = (baseBandWidth - dodgePadding * (nColors - 1)) / nColors;
  }

  for (const d of barPoints) {
    const style = computeBarStyle(d, config, colorScale);
    const aria = { role: 'listitem', tabindex: '0', label: barAriaLabel(d, isHorizontal) };
    let x: number, y: number, width: number, height: number;

    if (position === 'dodge' || position === 'dodge2') {
      const catPos = barCatPos(d) + (d._dodgeIndex ?? 0) * (dodgeWidth + dodgePadding);

      if (isHorizontal) {
        x = Math.min(valScale(d.x), valZero);
        y = catPos;
        width = Math.abs(valScale(d.x) - valZero);
        height = dodgeWidth;
      } else {
        x = catPos;
        y = Math.min(valScale(d.y), valZero);
        width = dodgeWidth;
        height = Math.abs(valScale(d.y) - valZero);
      }

    } else if (position === 'stack' || position === 'fill') {
      const v0 = (d as PositionedPoint)._v0 ?? 0;
      const v1 = (d as PositionedPoint)._v1 ?? 0;

      if (isHorizontal) {
        x = Math.min(valScale(v0), valScale(v1));
        y = barCatPos(d);
        width = Math.abs(valScale(v0) - valScale(v1));
        height = baseBandWidth;
      } else {
        x = barCatPos(d);
        y = valScale(v1);
        width = baseBandWidth;
        height = Math.abs(valScale(v0) - valScale(v1));
      }

    } else {
      // Identity
      if (isHorizontal) {
        x = Math.min(valScale(d.x), valZero);
        y = barCatPos(d);
        width = Math.abs(valScale(d.x) - valZero);
        height = baseBandWidth;
      } else {
        const yVal = valScale(d.y);
        x = barCatPos(d);
        y = Math.min(yVal, valZero);
        width = baseBandWidth;
        height = Math.abs(yVal - valZero);
      }
    }

    nodes.push({ type: 'rect', class: 'ggpbi-bar', x, y, width, height, style, aria, data: d });
  }

  return nodes;
}

