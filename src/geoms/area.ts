import * as d3 from 'd3';
import { AreaGeomConfig } from '../types';
import { BoundPoint } from '../bind-data';
import type { PathNode, NodeStyle } from '../scene-types';
import { sortByX, groupByColor, bandOffset, filterNA, GEOM_DEFAULT_COLOR } from './util';

// ---------------------------------------------------------------------------
// Area Scene Builder — pure geometry computation, no DOM
// ---------------------------------------------------------------------------

/**
 * Compute area geometry as SceneNodes.
 *
 * Pure function: BoundPoint[] + scales + config → PathNode[].
 * One PathNode per color group. No DOM. Testable without JSDOM.
 */
export function areaToScene(
  points: BoundPoint[],
  xScale: any,
  yScale: any,
  config: AreaGeomConfig,
  colorScale?: any,
): PathNode[] {
  // One NaN coordinate makes the browser drop the entire <path>, so the
  // whole area would silently vanish — filter like the other geoms do.
  const areaPoints = filterNA(points, config.naRm, 'geom_area');
  if (areaPoints.length === 0) return [];

  const defaultAlpha = config.alpha ?? 0.3;
  const defaultColor = config.color ?? GEOM_DEFAULT_COLOR;

  const bw = bandOffset(xScale);

  const area = d3.area<BoundPoint>()
    .x(d => xScale(d.x) + bw)
    .y0(yScale(0))
    .y1(d => yScale(d.y));

  const buildNode = (pts: BoundPoint[], color: string): PathNode | null => {
    const sorted = sortByX(pts);
    const pathD = area(sorted) ?? '';
    if (!pathD) return null;

    const style: NodeStyle = {
      fill: color,
      opacity: defaultAlpha,
    };

    return {
      type: 'path',
      class: 'ggpbi-area',
      d: pathD,
      style,
      data: sorted[0], // first point as representative
    };
  };

  const result: PathNode[] = [];
  const groups = groupByColor(areaPoints);
  if (groups) {
    groups.forEach((groupPoints, key) => {
      const color = colorScale ? colorScale(String(key)) : defaultColor;
      const node = buildNode(groupPoints, color);
      if (node) result.push(node);
    });
  } else {
    const node = buildNode(areaPoints, defaultColor);
    if (node) result.push(node);
  }

  return result;
}

