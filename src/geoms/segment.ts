import { SegmentGeomConfig } from '../types';
import { BoundPoint } from '../bind-data';
import type { LineNode, MarkerSpec, NodeStyle } from '../scene-types';
import { bandOffset, linetypeToDasharray, GEOM_DEFAULT_COLOR } from './util';

// ---------------------------------------------------------------------------
// Segment Scene Builder — pure geometry computation, no DOM
// ---------------------------------------------------------------------------

/**
 * Compute segment geometry as SceneNodes (ggplot2 geom_segment).
 *
 * One LineNode per data point, from (x, y) to (xend, yend). A missing
 * end coordinate falls back to its start value, so mapping only `xend`
 * draws horizontal segments (the dumbbell connector) and only `yend`
 * vertical ones. Rows where any needed coordinate is NA are skipped.
 */
export function segmentsToScene(
  points: BoundPoint[],
  xScale: any,
  yScale: any,
  config: SegmentGeomConfig,
  colorScale?: any,
): LineNode[] {
  if (points.length === 0) return [];

  const defaultAlpha = config.alpha ?? 1;
  const defaultColor = config.color ?? GEOM_DEFAULT_COLOR;
  const strokeWidth = config.size ?? 2;
  const dasharray = linetypeToDasharray(config.linetype);
  const lineend = config.lineend ?? 'butt';

  const xOff = bandOffset(xScale);
  const yOff = bandOffset(yScale);

  const showArrow = config.arrowShow ?? false;
  const arrowEnds = config.arrowEnds ?? 'last';
  const arrowType = config.arrowType ?? 'open';
  let arrowCounter = 0;

  const buildMarker = (color: string, end: 'start' | 'end'): MarkerSpec => ({
    id: `ggpbi-segment-arrow-${end}-${color.replace(/[^a-zA-Z0-9]/g, '')}-${arrowCounter++}`,
    angle: config.arrowAngle ?? 30,
    length: config.arrowLength ?? 8,
    color,
    fill: config.arrowFill ?? (arrowType === 'closed' ? color : 'none'),
    type: arrowType,
  });

  const nodes: LineNode[] = [];

  for (const d of points) {
    const x1 = xScale(d.x) + xOff;
    const y1 = yScale(d.y) + yOff;
    const x2 = xScale(d.xend ?? d.x) + xOff;
    const y2 = yScale(d.yend ?? d.y) + yOff;
    if (![x1, y1, x2, y2].every(Number.isFinite)) continue;

    const color = d.color !== undefined && colorScale
      ? colorScale(String(d.color))
      : defaultColor;

    const style: NodeStyle = {
      stroke: color,
      strokeWidth,
      opacity: d.alpha ?? defaultAlpha,
      strokeLinecap: lineend,
    };
    if (dasharray) style.strokeDasharray = dasharray;

    const node: LineNode = {
      type: 'line',
      class: 'ggpbi-segment',
      x1, y1, x2, y2,
      style,
      aria: { role: 'listitem', tabindex: '0', label: `${String(d.x)} → ${String(d.xend ?? d.x)}` },
      data: d,
    };
    if (showArrow) {
      if (arrowEnds === 'last' || arrowEnds === 'both') node.markerEnd = buildMarker(color, 'end');
      if (arrowEnds === 'first' || arrowEnds === 'both') node.markerStart = buildMarker(color, 'start');
    }
    nodes.push(node);
  }

  return nodes;
}
