import * as d3 from 'd3';
import { PointrangeGeomConfig } from '../types';
import { BoundPoint } from '../bind-data';
import type { LineNode, PathNode, NodeStyle } from '../scene-types';
import { bandOffset, getShapeInfo, GEOM_DEFAULT_COLOR } from './util';

// ---------------------------------------------------------------------------
// Pointrange Scene Builder — pure geometry computation, no DOM
// ---------------------------------------------------------------------------

/**
 * Compute pointrange geometry as SceneNodes (ggplot2 geom_pointrange).
 *
 * Per row: a range line plus a midpoint dot. Vertical when ymin/ymax are
 * bound, horizontal when xmin/xmax are (ggplot2 orientation rules). A row
 * missing both range ends draws only the dot; rows with NA midpoints are
 * skipped. `size` is the line width, the dot radius is `size * fatten`.
 */
export function pointrangeToScene(
  points: BoundPoint[],
  xScale: any,
  yScale: any,
  config: PointrangeGeomConfig,
  colorScale?: any,
): Array<LineNode | PathNode> {
  if (points.length === 0) return [];

  const defaultAlpha = config.alpha ?? 1;
  const defaultColor = config.color ?? GEOM_DEFAULT_COLOR;
  const lineWidth = config.size ?? 1;
  const fatten = config.fatten ?? 4;
  const shape = config.shape ?? 'circle';
  const defaultFill = config.fill ?? '#FFFFFF';

  const xOff = bandOffset(xScale);
  const yOff = bandOffset(yScale);

  const symbolGen = d3.symbol<BoundPoint>()
    .type(() => getShapeInfo(shape).symbol)
    .size(() => {
      const r = Math.max(1, lineWidth * fatten);
      return Math.PI * r * r;
    });

  const nodes: Array<LineNode | PathNode> = [];

  for (const d of points) {
    const cx = xScale(d.x) + xOff;
    const cy = yScale(d.y) + yOff;
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;

    const color = d.color !== undefined && colorScale
      ? colorScale(String(d.color))
      : defaultColor;
    const opacity = d.alpha ?? defaultAlpha;

    // Range line: vertical (ymin/ymax) or horizontal (xmin/xmax).
    const hasYRange = d.ymin != null || d.ymax != null;
    const hasXRange = d.xmin != null || d.xmax != null;
    let x1 = cx, y1 = cy, x2 = cx, y2 = cy;
    if (hasYRange) {
      y1 = yScale(d.ymin ?? d.y) + yOff;
      y2 = yScale(d.ymax ?? d.y) + yOff;
    } else if (hasXRange) {
      x1 = xScale(d.xmin ?? d.x) + xOff;
      x2 = xScale(d.xmax ?? d.x) + xOff;
    }

    if ((hasYRange || hasXRange) && [x1, y1, x2, y2].every(Number.isFinite)) {
      const lineStyle: NodeStyle = {
        stroke: color,
        strokeWidth: lineWidth,
        opacity,
      };
      nodes.push({
        type: 'line',
        class: 'ggpbi-pointrange-line',
        x1, y1, x2, y2,
        style: lineStyle,
        data: d,
      });
    }

    const shapeCat = getShapeInfo(shape).category;
    const dotStyle: NodeStyle = {
      fill: shapeCat === 'open' || shapeCat === 'line' ? 'none'
        : shapeCat === 'fillBorder' ? (d.fill ?? defaultFill)
        : color,
      opacity,
    };
    if (shapeCat !== 'filled') {
      dotStyle.stroke = color;
      dotStyle.strokeWidth = 1.5;
    }

    const xVal = typeof d.x === 'number' ? d.x.toLocaleString() : String(d.x);
    const yVal = typeof d.y === 'number' ? d.y.toLocaleString() : String(d.y);
    nodes.push({
      type: 'path',
      class: 'ggpbi-pointrange-dot',
      d: symbolGen(d) ?? '',
      transform: `translate(${cx},${cy})`,
      style: dotStyle,
      aria: { role: 'listitem', tabindex: '0', label: `${xVal}: ${yVal}` },
      data: d,
    });
  }

  return nodes;
}
