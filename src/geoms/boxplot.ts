import * as d3 from 'd3';
import { BoxplotGeomConfig } from '../types';
import { BoundPoint } from '../bind-data';
import type { SceneNode, GroupNode } from '../scene-types';
import { linetypeToDasharray, getShapeInfo, continuousBandPx } from './util';
import { computeBoxplotStats } from '../stats';
import type { BoxplotStats } from '../stats';

// Re-export for backwards compatibility
export { computeBoxplotStats, type BoxplotStats } from '../stats';

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

/** Position info for a single boxplot within its x-band. */
interface BoxPosition {
  left: number;
  width: number;
  center: number;
}

/**
 * Build a notched box path (ggplot2 GeomCrossbar with notch=TRUE).
 *
 * Vertices (clockwise from top-left):
 *   TL → notch-upper-left → notch-left (median) → notch-lower-left → BL
 *   BR → notch-lower-right → notch-right (median) → notch-upper-right → TR
 */
function notchPath(
  pos: BoxPosition,
  q1y: number,
  q3y: number,
  medianY: number,
  notchUpperY: number,
  notchLowerY: number,
  notchWidthFrac: number,
): string {
  const indent = pos.width * (1 - notchWidthFrac) / 2;

  const lx = pos.left;
  const rx = pos.left + pos.width;
  const nlx = lx + indent;  // notch indent left
  const nrx = rx - indent;  // notch indent right

  // Clamp notch to box bounds — ggplot2 warns and renders clamped.
  // Screen y is inverted (smaller y = higher value): the notch's upper vertex
  // must not rise above the box top (q3y), so clamp with max; the lower
  // vertex must not drop below the box bottom (q1y), so clamp with min.
  const nuY = Math.max(notchUpperY, q3y);
  const nlY = Math.min(notchLowerY, q1y);

  if (notchUpperY < q3y || notchLowerY > q1y) {
    // Screen coords are inverted: smaller y = higher data value
    console.warn(
      'ggpbi: notch went outside hinges. Try setting notch=false.',
    );
  }

  return [
    `M${lx},${q3y}`,
    `L${lx},${nuY}`,
    `L${nlx},${medianY}`,
    `L${lx},${nlY}`,
    `L${lx},${q1y}`,
    `L${rx},${q1y}`,
    `L${rx},${nlY}`,
    `L${nrx},${medianY}`,
    `L${rx},${nuY}`,
    `L${rx},${q3y}`,
    'Z',
  ].join(' ');
}

// ---------------------------------------------------------------------------
// Boxplot Scene Builder — pure geometry computation, no DOM
// ---------------------------------------------------------------------------

/**
 * Compute boxplot geometry as SceneNodes.
 *
 * Pure function: BoundPoint[] + scales + config → GroupNode[].
 * One GroupNode per boxplot, containing whiskers, box, median, outliers.
 * No DOM, no D3 selections. Testable without JSDOM.
 */
export function boxplotToScene(
  points: BoundPoint[],
  xScale: any,
  yScale: any,
  config: BoxplotGeomConfig,
  colorScale?: any,
  innerWidth?: number,
): GroupNode[] {
  if (points.length === 0) return [];

  // --- Config with ggplot2 defaults ---
  const coef = config.boxCoef ?? 1.5;
  const notch = config.boxNotch ?? false;
  const notchWidthFrac = config.boxNotchWidth ?? 0.5;
  const varwidth = config.boxVarWidth ?? false;
  const stapleWidth = config.boxStapleWidth ?? 0;
  const fatten = config.boxFatten ?? 2;
  const naRm = config.naRm ?? false;
  const showOutliers = config.boxOutlierShow ?? true;

  const defaultFill = config.color ?? '#FFFFFF';
  const defaultAlpha = config.alpha ?? 1.0;
  const baseStroke = config.stroke ?? '#333333';
  const baseStrokeWidth = config.strokeWidth ?? 0.5;
  const baseLinetype = config.linetype;
  const widthFraction = config.width ?? 0.9;

  // Per-component styling
  const boxBorderColor = config.boxBorderColor ?? baseStroke;
  const boxBorderLineStyle = config.boxBorderLineStyle ?? baseLinetype;
  const boxBorderLineWidth = config.boxBorderLineWidth ?? baseStrokeWidth;
  const whiskerColor = config.boxWhiskerColor ?? baseStroke;
  const whiskerLineStyle = config.boxWhiskerLineStyle ?? baseLinetype;
  const whiskerLineWidth = config.boxWhiskerLineWidth ?? baseStrokeWidth;
  const stapleColor = config.boxStapleColor ?? baseStroke;
  const stapleLineStyle = config.boxStapleLineStyle ?? baseLinetype;
  const stapleLineWidth = config.boxStapleLineWidth ?? baseStrokeWidth;
  const medianColor = config.boxMedianColor ?? baseStroke;
  const medianLineStyle = config.boxMedianLineStyle ?? baseLinetype;
  const medianLineWidth = (config.boxMedianLineWidth ?? baseStrokeWidth) * fatten;
  const outlierColor = config.boxOutlierColor ?? baseStroke;
  const outlierFill = config.boxOutlierFill;
  const outlierShape = config.boxOutlierShape ?? 'circle';
  const outlierSize = config.boxOutlierSize ?? 1.5;
  const outlierStrokeW = config.boxOutlierStroke ?? 0.5;
  const outlierAlpha = config.boxOutlierAlpha ?? defaultAlpha;

  // --- Compute stats ---
  const stats = computeBoxplotStats(points, coef, naRm);
  if (stats.length === 0) return [];

  // --- Sizing ---
  const isBand = typeof xScale.bandwidth === 'function';
  const byX = d3.group(stats, d => String(d.x));
  const nCategories = byX.size || stats.length;

  // Continuous axis: box width from the smallest gap between distinct
  // positions (ggplot2's resolution()), so boxes never overlap.
  const baseWidth = isBand
    ? xScale.bandwidth() * widthFraction
    : innerWidth
      ? Math.max(6, continuousBandPx(
          [...byX.values()].map(g => Number(xScale(g[0].x))),
          (innerWidth / nCategories) * 0.6,
        ) * widthFraction)
      : 24;

  const maxN = varwidth ? Math.max(...stats.map(s => s.n)) : 0;

  const positionFor = (d: BoxplotStats): BoxPosition => {
    const x0 = xScale(d.x);
    const group = byX.get(String(d.x)) ?? [d];
    const n = group.length;
    const idx = group.findIndex(
      s => String(s.color ?? '__none__') === String(d.color ?? '__none__'),
    );

    let effectiveBaseWidth = baseWidth;
    if (varwidth && maxN > 0) {
      effectiveBaseWidth = baseWidth * Math.sqrt(d.n) / Math.sqrt(maxN);
    }

    if (n <= 1) {
      const left = isBand
        ? x0 + (xScale.bandwidth() - effectiveBaseWidth) / 2
        : x0 - effectiveBaseWidth / 2;
      return { left, width: effectiveBaseWidth, center: left + effectiveBaseWidth / 2 };
    }

    const dodgePadding = 0.1;
    const totalAvail = isBand ? xScale.bandwidth() : baseWidth;
    const paddingPx = totalAvail * dodgePadding / (n - 1 || 1);
    const groupWidth = (totalAvail - paddingPx * Math.max(0, n - 1)) / n;

    const dodgeWidth = varwidth && maxN > 0
      ? groupWidth * Math.sqrt(d.n) / Math.sqrt(maxN)
      : groupWidth;

    const leftBase = isBand ? x0 : x0 - totalAvail / 2;
    const groupCenter = leftBase + idx * (groupWidth + paddingPx) + groupWidth / 2;
    const left = groupCenter - dodgeWidth / 2;

    return { left, width: dodgeWidth, center: groupCenter };
  };

  const fillFor = (d: BoxplotStats): string => {
    if (d.color != null && colorScale) return colorScale(String(d.color));
    return defaultFill;
  };

  const outlierFillFor = (): string => {
    if (outlierFill) return outlierFill;
    const shapeInfo = getShapeInfo(outlierShape);
    if (shapeInfo.category === 'filled') return outlierColor;
    return 'none';
  };

  const outlierStrokeFor = (): string => {
    const shapeInfo = getShapeInfo(outlierShape);
    if (shapeInfo.category === 'filled') return 'none';
    return outlierColor;
  };

  const dashFor = (linestyle: typeof baseLinetype): string | undefined => {
    const d = linetypeToDasharray(linestyle);
    return d ?? undefined;
  };

  // Outlier symbol generator
  const shapeInfo = getShapeInfo(outlierShape);
  const symbolSize = Math.PI * Math.pow(outlierSize * 2, 2);
  const symbolGen = d3.symbol().type(shapeInfo.symbol).size(symbolSize);

  const result: GroupNode[] = [];

  for (const stat of stats) {
    const pos = positionFor(stat);
    const children: SceneNode[] = [];

    // --- Outliers ---
    if (showOutliers) {
      for (const p of stat.outliers) {
        const cx = pos.center;
        const cy = yScale(Number(p.y));
        children.push({
          type: 'path',
          class: 'ggpbi-boxplot-outlier',
          d: symbolGen() ?? '',
          transform: `translate(${cx},${cy})`,
          style: {
            fill: outlierFillFor(),
            stroke: outlierStrokeFor(),
            strokeWidth: outlierStrokeW,
            opacity: outlierAlpha,
          },
          data: p,
        });
      }
    }

    // --- Staples ---
    if (stapleWidth > 0) {
      const capHalfW = pos.width * stapleWidth / 2;
      for (const wy of [stat.whiskerLow, stat.whiskerHigh]) {
        children.push({
          type: 'line',
          class: 'ggpbi-boxplot-staple',
          x1: pos.center - capHalfW,
          x2: pos.center + capHalfW,
          y1: yScale(wy),
          y2: yScale(wy),
          style: {
            stroke: stapleColor,
            strokeWidth: stapleLineWidth,
            strokeLinecap: 'butt',
            opacity: 1,
            strokeDasharray: dashFor(stapleLineStyle),
          },
        });
      }
    }

    // --- Whiskers ---
    for (const [wy1, wy2] of [[stat.q1, stat.whiskerLow], [stat.q3, stat.whiskerHigh]]) {
      children.push({
        type: 'line',
        class: 'ggpbi-boxplot-whisker',
        x1: pos.center,
        x2: pos.center,
        y1: yScale(wy1),
        y2: yScale(wy2),
        style: {
          stroke: whiskerColor,
          strokeWidth: whiskerLineWidth,
          strokeLinecap: 'butt',
          opacity: 1,
          strokeDasharray: dashFor(whiskerLineStyle),
        },
      });
    }

    // --- Box ---
    if (notch) {
      children.push({
        type: 'path',
        class: 'ggpbi-boxplot-box',
        d: notchPath(
          pos,
          yScale(stat.q1),
          yScale(stat.q3),
          yScale(stat.median),
          yScale(stat.notchUpper),
          yScale(stat.notchLower),
          notchWidthFrac,
        ),
        style: {
          fill: fillFor(stat),
          opacity: defaultAlpha,
          stroke: boxBorderColor,
          strokeWidth: boxBorderLineWidth,
          strokeLinejoin: 'miter',
          strokeLinecap: 'butt',
          strokeDasharray: dashFor(boxBorderLineStyle),
        },
      });
    } else {
      const q1y = yScale(stat.q1);
      const q3y = yScale(stat.q3);
      children.push({
        type: 'rect',
        class: 'ggpbi-boxplot-box',
        x: pos.left,
        y: Math.min(q3y, q1y),
        width: pos.width,
        height: Math.abs(q3y - q1y),
        style: {
          fill: fillFor(stat),
          opacity: defaultAlpha,
          stroke: boxBorderColor,
          strokeWidth: boxBorderLineWidth,
          strokeLinejoin: 'miter',
          strokeLinecap: 'butt',
          strokeDasharray: dashFor(boxBorderLineStyle),
        },
      });
    }

    // --- Median ---
    children.push({
      type: 'line',
      class: 'ggpbi-boxplot-median',
      x1: pos.left,
      x2: pos.left + pos.width,
      y1: yScale(stat.median),
      y2: yScale(stat.median),
      style: {
        stroke: medianColor,
        strokeWidth: medianLineWidth,
        strokeLinecap: 'butt',
        strokeDasharray: dashFor(medianLineStyle),
      },
    });

    result.push({
      type: 'group',
      class: 'ggpbi-boxplot',
      children,
      style: {},
      aria: {
        role: 'listitem',
        tabindex: '0',
        label: `${String(stat.x)}: median ${stat.median.toLocaleString()}, Q1 ${stat.q1.toLocaleString()}, Q3 ${stat.q3.toLocaleString()}, n=${stat.n}`,
      },
    });
  }

  return result;
}

