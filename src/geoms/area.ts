import * as d3 from 'd3';
import { AreaGeomConfig } from '../types';
import { BoundPoint } from '../bind-data';
import type { PathNode, NodeStyle } from '../scene-types';
import { sortByX, groupByColor, bandOffset, filterNA, GEOM_DEFAULT_COLOR, linetypeToDasharray } from './util';

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

  // An outline along the top edge — ggplot2's geom_area(colour =,
  // linewidth =, outline.type = "upper"). It appears when the layer has a
  // size, in the layer's colour at full opacity: alpha thins the fill
  // only, as in ggplot2. A filled LTM line is one layer, not two.
  const outlineWidth = config.size;
  const upper = d3.line<BoundPoint>()
    .x(d => xScale(d.x) + bw)
    .y(d => yScale(d.y));
  const dasharray = linetypeToDasharray(config.linetype, outlineWidth);

  const buildNodes = (pts: BoundPoint[], color: string): PathNode[] => {
    const sorted = sortByX(pts);
    const pathD = area(sorted) ?? '';
    if (!pathD) return [];

    const style: NodeStyle = {
      fill: color,
      opacity: defaultAlpha,
    };

    const nodes: PathNode[] = [{
      type: 'path',
      class: 'ggpbi-area',
      d: pathD,
      style,
      data: sorted[0], // first point as representative
    }];
    if (outlineWidth !== undefined && outlineWidth > 0) {
      nodes.push({
        type: 'path',
        class: 'ggpbi-area-outline',
        d: upper(sorted) ?? '',
        style: {
          fill: 'none',
          stroke: color,
          strokeWidth: outlineWidth,
          strokeLinejoin: 'round',
          ...(dasharray && { strokeDasharray: dasharray }),
        },
        data: sorted[0],
      });
    }
    return nodes;
  };

  const result: PathNode[] = [];
  const groups = groupByColor(areaPoints);
  if (groups) {
    groups.forEach((groupPoints, key) => {
      const color = colorScale ? colorScale(String(key)) : defaultColor;
      result.push(...buildNodes(groupPoints, color));
    });
  } else {
    result.push(...buildNodes(areaPoints, defaultColor));
  }

  return result;
}

