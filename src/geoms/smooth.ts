import * as d3 from 'd3';
import type { SmoothGeomConfig } from '../types';
import type { BoundPoint } from '../bind-data';
import type { PathNode, NodeStyle, SceneNode } from '../scene-types';
import { sortByX, groupByColor, bandOffset, linetypeToDasharray, filterNA } from './util';
import { STAT_SMOOTH_YMIN, STAT_SMOOTH_YMAX } from '../stats';

// ---------------------------------------------------------------------------
// Smooth Scene Builder — line + confidence ribbon, no DOM
// ---------------------------------------------------------------------------

/**
 * Compute smooth geometry as SceneNodes.
 *
 * Pure function: BoundPoint[] + scales + config → SceneNode[].
 * Produces two layers per group (like ggplot2 draw_group):
 *   1. Ribbon (PathNode) — confidence band with fill, no stroke
 *   2. Line (PathNode) — smooth line, fully opaque
 *
 * Data must already have been processed by stat_smooth.
 */
export function smoothToScene(
  points: BoundPoint[],
  xScale: any,
  yScale: any,
  config: SmoothGeomConfig,
  colorScale?: any,
): SceneNode[] {
  // stat_smooth output is normally finite, but a NaN fit point would make
  // the browser drop the whole line/ribbon <path> — filter defensively.
  const smoothPoints = filterNA(points, config.naRm ?? true, 'geom_smooth');
  if (smoothPoints.length === 0) return [];

  const showSE = config.se !== false;
  const defaultColor = config.color ?? '#3366FF'; // ggplot2 default smooth colour
  const fillAlpha = config.fillAlpha ?? 0.4;
  const lineWidth = config.lineWidth ?? config.size ?? 2;
  const dasharray = linetypeToDasharray(config.linetype);
  const lineend = config.lineend ?? 'butt';
  const linejoin = config.linejoin ?? 'round';

  const bw = bandOffset(xScale);

  // D3 line generator for the smooth curve
  const line = d3.line<BoundPoint>()
    .x(d => xScale(d.x) + bw)
    .y(d => yScale(d.y));

  // D3 area generator for the confidence band
  const ribbon = d3.area<BoundPoint>()
    .x(d => xScale(d.x) + bw)
    .y0(d => {
      const ymin = (d.datum as any)?.[STAT_SMOOTH_YMIN];
      return ymin != null ? yScale(ymin) : yScale(d.y);
    })
    .y1(d => {
      const ymax = (d.datum as any)?.[STAT_SMOOTH_YMAX];
      return ymax != null ? yScale(ymax) : yScale(d.y);
    });

  const buildGroup = (pts: BoundPoint[], color: string): SceneNode[] => {
    const sorted = sortByX(pts);
    const nodes: SceneNode[] = [];

    // 1. Confidence ribbon (drawn first = behind line)
    if (showSE) {
      const hasCI = sorted.some(p =>
        (p.datum as any)?.[STAT_SMOOTH_YMIN] != null &&
        (p.datum as any)?.[STAT_SMOOTH_YMAX] != null,
      );

      if (hasCI) {
        const ribbonD = ribbon(sorted) ?? '';
        if (ribbonD) {
          // ggplot2 default fill: col_mix(ink, paper, 0.6) ≈ grey
          // We use #999999 as the default (60% mix of black/white)
          const fillColor = config.fill ?? '#999999';
          const ribbonStyle: NodeStyle = {
            fill: fillColor,
            stroke: 'none',
            opacity: fillAlpha,
          };

          nodes.push({
            type: 'path',
            class: 'ggpbi-smooth-ribbon',
            d: ribbonD,
            style: ribbonStyle,
            data: sorted[0],
          } as PathNode);
        }
      }
    }

    // 2. Smooth line (drawn on top)
    const lineD = line(sorted) ?? '';
    if (lineD) {
      const lineStyle: NodeStyle = {
        fill: 'none',
        stroke: color,
        strokeWidth: lineWidth,
        opacity: 1, // ggplot2: line is always fully opaque
        strokeLinecap: lineend,
        strokeLinejoin: linejoin,
      };
      if (dasharray) {
        lineStyle.strokeDasharray = dasharray;
      }

      nodes.push({
        type: 'path',
        class: 'ggpbi-smooth-line',
        d: lineD,
        style: lineStyle,
        data: sorted[0],
      } as PathNode);
    }

    return nodes;
  };

  const result: SceneNode[] = [];
  const groups = groupByColor(smoothPoints);
  if (groups) {
    groups.forEach((groupPoints, key) => {
      const color = colorScale ? colorScale(String(key)) : defaultColor;
      result.push(...buildGroup(groupPoints, color));
    });
  } else {
    result.push(...buildGroup(smoothPoints, defaultColor));
  }

  return result;
}
