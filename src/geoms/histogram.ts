import { HistogramGeomConfig, PositionType } from '../types';
import { BoundPoint } from '../bind-data';
import type { PositionedPoint } from '../position';
import type { RectNode, NodeStyle } from '../scene-types';
import { linetypeToDasharray, GEOM_DEFAULT_COLOR, filterNA } from './util';
import { STAT_BIN_XMIN, STAT_BIN_XMAX } from '../stats';

// ---------------------------------------------------------------------------
// Histogram Scene Builder — pure geometry computation, no DOM
// ---------------------------------------------------------------------------

/** Compute histogram bar style (ggplot2 defaults: grey fill, white border). */
function computeHistStyle(
  d: BoundPoint,
  config: HistogramGeomConfig,
  colorScale?: any,
): NodeStyle {
  const defaultAlpha = config.alpha ?? 0.85;
  const defaultColor = config.color ?? GEOM_DEFAULT_COLOR;
  const stroke = config.stroke ?? '#333333';
  const strokeWidth = config.strokeWidth ?? 0.5;
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

/** Compute aria label for a histogram bar. */
function histAriaLabel(d: BoundPoint): string {
  const datum = d.datum ?? {};
  const xmin = datum[STAT_BIN_XMIN];
  const xmax = datum[STAT_BIN_XMAX];
  const count = typeof d.y === 'number' ? d.y.toLocaleString() : String(d.y);
  if (xmin != null && xmax != null) {
    return `${Number(xmin).toLocaleString()}–${Number(xmax).toLocaleString()}: ${count}`;
  }
  const xVal = typeof d.x === 'number' ? d.x.toLocaleString() : String(d.x);
  return `${xVal}: ${count}`;
}

/**
 * Compute histogram geometry as SceneNodes.
 *
 * Pure function: BoundPoint[] + scales + config → RectNode[].
 * Uses stat_bin computed variables (xmin, xmax) for bin edges.
 *
 * Like ggplot2: bars span [xmin, xmax] with height = count/density.
 * Position adjustments (stack, dodge, fill) are pre-computed on the points.
 */
export function histogramToScene(
  points: BoundPoint[],
  xScale: any,
  yScale: any,
  config: HistogramGeomConfig,
  colorScale?: any,
  _innerWidth?: number,
): RectNode[] {
  const isHorizontal = config.orientation === 'y';
  // The value aesthetic is x for horizontal bars, y for vertical ones
  const histPoints = filterNA(
    points, config.naRm, 'geom_histogram', isHorizontal ? ['x'] : ['y'],
  ) as PositionedPoint[];
  if (histPoints.length === 0) return [];

  const position: PositionType = config.position ?? 'stack';

  const valScale = isHorizontal ? xScale : yScale;
  const catScale = isHorizontal ? yScale : xScale;

  const valZero = (() => {
    try { return valScale(0); }
    catch { return isHorizontal ? 0 : valScale.range()[0]; }
  })();

  const nodes: RectNode[] = [];

  for (const d of histPoints) {
    const style = computeHistStyle(d, config, colorScale);
    const aria = { role: 'listitem', tabindex: '0', label: histAriaLabel(d) };

    // Get bin edges from stat_bin computed variables
    const datum = d.datum ?? {};
    const binXmin = datum[STAT_BIN_XMIN] as number | undefined;
    const binXmax = datum[STAT_BIN_XMAX] as number | undefined;

    let x: number, y: number, width: number, height: number;

    if (position === 'stack' || position === 'fill') {
      const v0 = (d as PositionedPoint)._v0 ?? 0;
      const v1 = (d as PositionedPoint)._v1 ?? 0;

      if (isHorizontal) {
        x = Math.min(valScale(v0), valScale(v1));
        width = Math.abs(valScale(v0) - valScale(v1));
        if (binXmin != null && binXmax != null) {
          y = catScale(binXmin);
          height = Math.abs(catScale(binXmax) - catScale(binXmin));
        } else {
          y = catScale(d.y);
          height = 20;
        }
      } else {
        if (binXmin != null && binXmax != null) {
          x = catScale(binXmin);
          width = Math.abs(catScale(binXmax) - catScale(binXmin));
        } else {
          x = catScale(d.x) - 10;
          width = 20;
        }
        y = valScale(v1);
        height = Math.abs(valScale(v0) - valScale(v1));
      }
    } else if (position === 'dodge' || position === 'dodge2') {
      // Dodge: subdivide bin width by number of color groups
      const dodgeN = (d as PositionedPoint)._dodgeN ?? 1;
      const dodgeIdx = (d as PositionedPoint)._dodgeIndex ?? 0;
      const padded = (d as PositionedPoint)._dodgePadded ?? false;

      if (binXmin != null && binXmax != null) {
        const totalWidth = Math.abs(catScale(binXmax) - catScale(binXmin));
        const dodgePad = padded ? totalWidth / dodgeN * 0.1 : 0;
        const dodgeW = (totalWidth - dodgePad * (dodgeN - 1)) / dodgeN;

        if (isHorizontal) {
          x = Math.min(valScale(Number(d.x)), valZero);
          width = Math.abs(valScale(Number(d.x)) - valZero);
          y = catScale(binXmin) + dodgeIdx * (dodgeW + dodgePad);
          height = dodgeW;
        } else {
          x = catScale(binXmin) + dodgeIdx * (dodgeW + dodgePad);
          width = dodgeW;
          y = Math.min(valScale(Number(d.y)), valZero);
          height = Math.abs(valScale(Number(d.y)) - valZero);
        }
      } else {
        // Fallback when no bin edges
        if (isHorizontal) {
          x = Math.min(valScale(Number(d.x)), valZero);
          y = catScale(d.y);
          width = Math.abs(valScale(Number(d.x)) - valZero);
          height = 20 / dodgeN;
        } else {
          x = catScale(d.x) - 10;
          y = Math.min(valScale(Number(d.y)), valZero);
          width = 20 / dodgeN;
          height = Math.abs(valScale(Number(d.y)) - valZero);
        }
      }
    } else {
      // Identity position
      if (isHorizontal) {
        x = Math.min(valScale(Number(d.x)), valZero);
        width = Math.abs(valScale(Number(d.x)) - valZero);
        if (binXmin != null && binXmax != null) {
          y = catScale(binXmin);
          height = Math.abs(catScale(binXmax) - catScale(binXmin));
        } else {
          y = catScale(d.y);
          height = 20;
        }
      } else {
        if (binXmin != null && binXmax != null) {
          x = catScale(binXmin);
          width = Math.abs(catScale(binXmax) - catScale(binXmin));
        } else {
          x = catScale(d.x) - 10;
          width = 20;
        }
        const yVal = valScale(Number(d.y));
        y = Math.min(yVal, valZero);
        height = Math.abs(yVal - valZero);
      }
    }

    nodes.push({ type: 'rect', class: 'ggpbi-bar', x, y, width, height, style, aria, data: d });
  }

  return nodes;
}
