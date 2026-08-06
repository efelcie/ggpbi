import * as d3 from 'd3';
import { DensityGeomConfig } from '../types';
import { BoundPoint } from '../bind-data';
import type { PathNode, NodeStyle } from '../scene-types';
import { sortByX, groupByColor, linetypeToDasharray, GEOM_DEFAULT_COLOR } from './util';

// ---------------------------------------------------------------------------
// Density Scene Builder — pure geometry computation, no DOM
// ---------------------------------------------------------------------------

/**
 * Compute density curve geometry as SceneNodes (ggplot2 geom_density).
 *
 * Consumes the output of stat_density (x = evaluation grid, y = density).
 * One stroke PathNode per colour group; with `fill` enabled, an area
 * PathNode closed to the y = 0 baseline is drawn underneath the stroke.
 */
export function densityToScene(
  points: BoundPoint[],
  xScale: any,
  yScale: any,
  config: DensityGeomConfig,
  colorScale?: any,
): PathNode[] {
  if (points.length === 0) return [];

  const defaultColor = config.color ?? GEOM_DEFAULT_COLOR;
  const strokeWidth = config.size ?? 2;
  const dasharray = linetypeToDasharray(config.linetype) ?? undefined;
  const lineAlpha = config.alpha ?? 1;
  const fillAlpha = config.fillAlpha ?? 0.3;

  const line = d3.line<BoundPoint>()
    .x(d => xScale(d.x))
    .y(d => yScale(d.y));

  const area = d3.area<BoundPoint>()
    .x(d => xScale(d.x))
    .y0(yScale(0))
    .y1(d => yScale(d.y));

  const buildNodes = (pts: BoundPoint[], color: string): PathNode[] => {
    const sorted = sortByX(pts);
    const nodes: PathNode[] = [];

    if (config.fill) {
      const fillColor = config.fill === true ? color : config.fill;
      const areaD = area(sorted) ?? '';
      if (areaD) {
        nodes.push({
          type: 'path',
          class: 'ggpbi-density-area',
          d: areaD,
          style: { fill: fillColor, opacity: fillAlpha },
          data: sorted[0],
        });
      }
    }

    const lineD = line(sorted) ?? '';
    if (lineD) {
      const style: NodeStyle = {
        fill: 'none',
        stroke: color,
        strokeWidth,
        strokeDasharray: dasharray,
        strokeLinejoin: 'round',
        opacity: lineAlpha,
      };
      nodes.push({
        type: 'path',
        class: 'ggpbi-density',
        d: lineD,
        style,
        data: sorted[0],
      });
    }
    return nodes;
  };

  const result: PathNode[] = [];
  const groups = groupByColor(points);
  if (groups) {
    groups.forEach((groupPoints, key) => {
      const color = colorScale ? colorScale(String(key)) : defaultColor;
      result.push(...buildNodes(groupPoints, color));
    });
  } else {
    result.push(...buildNodes(points, defaultColor));
  }

  return result;
}
