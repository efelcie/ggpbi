import * as d3 from 'd3';
import { LineGeomConfig } from '../types';
import { BoundPoint } from '../bind-data';
import type { PathNode, MarkerSpec, NodeStyle } from '../scene-types';
import { sortByX, bandOffset, linetypeToDasharray, GEOM_DEFAULT_COLOR, filterNA } from './util';

/**
 * Split an array of points into segments at NA/null boundaries.
 * NAs in the middle create gaps; NAs at edges are trimmed.
 */
function splitAtNA(points: BoundPoint[]): BoundPoint[][] {
  const segments: BoundPoint[][] = [];
  let current: BoundPoint[] = [];

  for (const p of points) {
    const isNA = p.x == null || p.y == null
      || (typeof p.x === 'number' && isNaN(p.x))
      || (typeof p.y === 'number' && isNaN(p.y));

    if (isNA) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
    } else {
      current.push(p);
    }
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

// ---------------------------------------------------------------------------
// Line Scene Builder — pure geometry computation, no DOM
// ---------------------------------------------------------------------------

/**
 * Compute line geometry as SceneNodes.
 *
 * Pure function: BoundPoint[] + scales + config → PathNode[].
 * One PathNode per line segment (color group × NA gap).
 * No DOM, no D3 selections. Testable without JSDOM.
 */
export function linesToScene(
  points: BoundPoint[],
  xScale: any,
  yScale: any,
  config: LineGeomConfig,
  colorScale?: any,
): PathNode[] {
  if (points.length === 0) return [];

  const defaultAlpha = config.alpha ?? 1;
  const defaultColor = config.color ?? GEOM_DEFAULT_COLOR;
  const strokeWidth = config.size ?? 2;
  const dasharray = linetypeToDasharray(config.linetype);
  const lineend = config.lineend ?? 'butt';
  const linejoin = config.linejoin ?? 'round';
  const linemitre = config.linemitre ?? 10;

  const xBandOffset = bandOffset(xScale);
  const yBandOffset = bandOffset(yScale);
  const isBandY = typeof yScale.bandwidth === 'function';

  const line = d3.line<BoundPoint>()
    .x(d => xScale(d.x) + xBandOffset)
    .y(d => yScale(d.y) + yBandOffset);

  const buildStyle = (color: string): NodeStyle => {
    const style: NodeStyle = {
      fill: 'none',
      stroke: color,
      strokeWidth,
      opacity: defaultAlpha,
      strokeLinecap: lineend,
      strokeLinejoin: linejoin,
    };
    if (linejoin === 'miter') {
      style.strokeMiterlimit = linemitre;
    }
    if (dasharray) {
      style.strokeDasharray = dasharray;
    }
    return style;
  };

  // Arrow config
  const showArrow = config.arrowShow ?? false;
  const arrowEnds = config.arrowEnds ?? 'last';
  const arrowAngle = config.arrowAngle ?? 30;
  const arrowLength = config.arrowLength ?? 8;
  const arrowType = config.arrowType ?? 'open';
  let arrowCounter = 0;

  const buildMarker = (color: string, end: 'start' | 'end'): MarkerSpec => {
    const safeColor = color.replace(/[^a-zA-Z0-9]/g, '');
    const fillColor = config.arrowFill ?? (arrowType === 'closed' ? color : 'none');
    return {
      id: `ggpbi-arrow-${end}-${safeColor}-${arrowCounter}`,
      angle: arrowAngle,
      length: arrowLength,
      color,
      fill: fillColor,
      type: arrowType,
    };
  };

  const buildSegments = (pts: BoundPoint[], color: string): PathNode[] => {
    const sorted = sortByX(pts);
    const segments = config.naRm
      ? [filterNA(sorted, true, 'geom_line')]
      : splitAtNA(sorted);

    const nodes: PathNode[] = [];
    for (const segment of segments) {
      if (segment.length < 2) continue;
      const pathD = line(segment) ?? '';
      if (!pathD) continue;

      const pathNode: PathNode = {
        type: 'path',
        class: 'ggpbi-line',
        d: pathD,
        style: buildStyle(color),
        data: segment[0], // first point as representative
      };

      nodes.push(pathNode);
    }

    // Apply arrow markers to first/last segments of this color group
    if (showArrow && nodes.length > 0) {
      if (arrowEnds === 'last' || arrowEnds === 'both') {
        nodes[nodes.length - 1].markerEnd = buildMarker(color, 'end');
      }
      if (arrowEnds === 'first' || arrowEnds === 'both') {
        nodes[0].markerStart = buildMarker(color, 'start');
      }
      arrowCounter++;
    }

    return nodes;
  };

  const hasColor = points.some(p => p.color !== undefined);
  const hasGroup = points.some(p => p.group !== undefined);
  const groupKey = (p: BoundPoint): string => {
    const parts: string[] = [];
    if (hasGroup) parts.push(`group:${String(p.group)}`);
    if (hasColor) parts.push(`color:${String(p.color)}`);
    if (isBandY) parts.push(`y:${String(p.y)}`);
    return parts.join('|') || '__all';
  };

  const result: PathNode[] = [];
  const groups = d3.group(points, groupKey);
  for (const groupPoints of groups.values()) {
    const first = groupPoints[0];
    const color = hasColor && first.color !== undefined && colorScale
      ? colorScale(String(first.color))
      : defaultColor;
    result.push(...buildSegments(groupPoints, color));
  }

  return result;
}
