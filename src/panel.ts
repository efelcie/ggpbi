/**
 * Panel rendering — like ggplot2's draw_panel().
 *
 * A panel is the rectangular data area inside a chart (or one cell in a faceted chart).
 * This module renders: background, clip-path, grid lines, axes, and geom layers.
 * Axis labels, legend, and interactivity are handled by the caller (render.ts).
 */

import * as d3 from 'd3';
import type { BoundPoint } from './bind-data';
import type { GeomConfig } from './types';
import { type ResolvedTheme, axisLabelPriority } from './theme';
import { sceneBuilders } from './geoms';
import { bandOffset } from './geoms/util';
import type { PanelSharedState } from './scene-types';
import { renderSceneNodes } from './scene-renderer';
import type { LabelFormat } from './types';
import { extendedBreaks, formatBreaksAs, minorBreaks } from './breaks';
import { formatDates, type FormatOptions, type DateFormat } from './format';

// Shared clip-path counter (monotonic, no Math.random for Power BI compat)
let clipCounter = 0;
function nextClipId(suffix: string): string {
  clipCounter += 1;
  return `ggpbi-clip-${suffix}-${clipCounter}`;
}

/** Reset clip counter (for testing) */
export function resetClipCounter(): void {
  clipCounter = 0;
}

/** Compute ggplot2-style breaks (Wilkinson Extended algorithm) for a scale. */
function ggBreaks(
  scale: any,
  nBreaks: number,
  labelFormat?: LabelFormat,
  fmt: FormatOptions & { dateFormat?: DateFormat } = {},
): { ticks: Array<number | Date>; labels: string[] } | undefined {
  // Band/ordinal scales should use their domain values directly.
  // Running the continuous break algorithm on band domains can produce
  // incorrect intermediate ticks (e.g. 3.25, 3.50) when categories are numeric.
  if (typeof scale.bandwidth === 'function') return undefined;
  if (typeof scale.domain !== 'function') return undefined;
  const dom = scale.domain();
  if (dom.length < 2) return undefined;

  // Time scales: d3 picks the ticks (calendar-aware — months, quarters,
  // years; Wilkinson breaks on epoch milliseconds would label raw
  // numbers), but the LABELS go through Intl so month names follow the
  // locale. d3's own default is English whatever the report language is.
  if (dom[0] instanceof Date || dom[1] instanceof Date) {
    if (typeof scale.ticks !== 'function') return undefined;
    const dateTicks = scale.ticks(nBreaks) as Date[];
    if (dateTicks.length === 0) return undefined;
    return { ticks: dateTicks, labels: formatDates(dateTicks, fmt.dateFormat, fmt) };
  }

  const lo = Number(dom[0]);
  const hi = Number(dom[1]);
  if (!isFinite(lo) || !isFinite(hi) || lo === hi) return undefined;

  const allTicks = extendedBreaks(lo, hi, nBreaks);
  const ticks = allTicks.filter(t => t >= lo && t <= hi);
  const labels = formatBreaksAs(ticks, labelFormat, fmt);
  return { ticks, labels };
}


/** Hide overlapping axis labels using priority-based visibility. */
function applyOverlapCheck(
  axisGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  direction: 'x' | 'y'
): void {
  const texts = axisGroup.selectAll<SVGTextElement, unknown>('text');
  const nodes = texts.nodes();
  if (nodes.length <= 1) return;

  const priority = axisLabelPriority(nodes.length);
  const occupied: Array<[number, number]> = [];

  nodes.forEach(n => (n.style.display = ''));

  for (const idx of priority) {
    const node = nodes[idx];
    if (!node) continue;

    if (typeof (node as any).getBoundingClientRect !== 'function') continue;
    const rect = (node as any as SVGGraphicsElement).getBoundingClientRect();

    // No layout information (SSR/jsdom render): every rect is 0×0 at the
    // origin, which would falsely mark all labels as overlapping. Keep them.
    if (rect.width === 0 && rect.height === 0) continue;

    let lo: number, hi: number;
    if (direction === 'x') {
      lo = rect.left;
      hi = rect.right;
    } else {
      lo = rect.top;
      hi = rect.bottom;
    }

    const pad = 2;
    const overlaps = occupied.some(([oLo, oHi]) => (lo - pad) < oHi && (hi + pad) > oLo);
    if (overlaps) {
      node.style.display = 'none';
    } else {
      occupied.push([lo, hi]);
    }
  }
}

/** Everything needed to render a single panel. */
export interface PanelInput {
  /** The <g> element for this panel (already translated to position). */
  panelG: d3.Selection<SVGGElement, unknown, null, undefined>;
  /** The parent <svg> (for clip-path defs). */
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  /** Panel dimensions (excluding margins). */
  innerWidth: number;
  innerHeight: number;
  /** Scales for this panel. */
  xScale: any;
  yScale: any;
  /** Resolved theme. */
  theme: ResolvedTheme;
  /** Color scale (ordinal). */
  colorScale?: any;
  /** Unwrapped colour scale for layers exempted from highlighting. */
  colorScaleBase?: any;
  /** Geom configurations. */
  geoms: GeomConfig[];
  /** Pre-bound data per layer (same length as geoms). */
  layerData: BoundPoint[][];
  /** Clip-path suffix for unique IDs. */
  clipSuffix?: string;
  /** Tick label format for the x axis (continuous scales only). */
  xLabelFormat?: LabelFormat;
  /** Tick label format for the y axis (continuous scales only). */
  yLabelFormat?: LabelFormat;
  /** Locale and currency for tick labels (Power BI host locale). */
  format?: FormatOptions;
  /** Date granularity for time axes; 'auto' follows the tick spacing. */
  xDateFormat?: DateFormat;
  /** Date granularity for a time y axis. */
  yDateFormat?: DateFormat;
}

/**
 * Render a single panel: background, clip-path, grid lines, axes, and geom layers.
 *
 * Like ggplot2's draw_panel: handles one rectangular data area.
 * Axis labels, legend, and interactivity are NOT rendered here.
 */
export function renderPanel(ctx: PanelInput): void {
  const { panelG, svg, innerWidth, innerHeight, xScale, yScale, theme, colorScale, geoms, layerData } = ctx;

  // Panel background (ggplot2 grey rect behind data area)
  panelG.insert('rect', ':first-child')
    .attr('class', 'ggpbi-panel')
    .attr('width', innerWidth)
    .attr('height', innerHeight)
    .attr('fill', theme.panelFill);

  // Breaks via Wilkinson Extended algorithm (like ggplot2)
  const xBreaks = ggBreaks(xScale, theme.nBreaks, ctx.xLabelFormat,
    { ...ctx.format, dateFormat: ctx.xDateFormat });
  const yBreaks = ggBreaks(yScale, theme.nBreaks, ctx.yLabelFormat,
    { ...ctx.format, dateFormat: ctx.yDateFormat });

  const isBandX = typeof (xScale as any).bandwidth === 'function';
  const xTicks = isBandX ? [] : (xBreaks?.ticks ?? ((xScale as any).ticks ? (xScale as any).ticks(theme.nBreaks) : []));
  const yTicks = yBreaks?.ticks ?? ((yScale as any).ticks ? (yScale as any).ticks(theme.nBreaks) : []);

  // Minor grid lines (ggplot2 panel.grid.minor: rel(0.5) linewidth)
  const yDom = (yScale as any).domain?.() as [number, number] | undefined;
  const xDom = (xScale as any).domain?.() as [number, number] | undefined;
  const yMinor = yDom ? minorBreaks(yTicks, yDom[0], yDom[1]) : [];
  const xMinor = isBandX ? [] : (xDom ? minorBreaks(xTicks, xDom[0], xDom[1]) : []);

  for (const tick of yMinor) {
    panelG.append('line')
      .attr('class', 'ggpbi-grid-minor')
      .attr('x1', 0).attr('x2', innerWidth)
      .attr('y1', (yScale as any)(tick)).attr('y2', (yScale as any)(tick))
      .attr('stroke', theme.gridColor).attr('stroke-width', theme.baseLineSize * 0.5);
  }
  for (const tick of xMinor) {
    panelG.append('line')
      .attr('class', 'ggpbi-grid-minor')
      .attr('y1', 0).attr('y2', innerHeight)
      .attr('x1', (xScale as any)(tick)).attr('x2', (xScale as any)(tick))
      .attr('stroke', theme.gridColor).attr('stroke-width', theme.baseLineSize * 0.5);
  }

  // Major grid lines (ggplot2 panel.grid.major)
  for (const tick of yTicks) {
    panelG.append('line')
      .attr('class', 'ggpbi-grid')
      .attr('x1', 0).attr('x2', innerWidth)
      .attr('y1', (yScale as any)(tick)).attr('y2', (yScale as any)(tick))
      .attr('stroke', theme.gridColor).attr('stroke-width', theme.baseLineSize);
  }
  for (const tick of xTicks) {
    panelG.append('line')
      .attr('class', 'ggpbi-grid')
      .attr('y1', 0).attr('y2', innerHeight)
      .attr('x1', (xScale as any)(tick)).attr('x2', (xScale as any)(tick))
      .attr('stroke', theme.gridColor).attr('stroke-width', theme.baseLineSize);
  }

  // Panel clipping (ggplot2: panel.clip = TRUE — geoms don't overflow the panel)
  const clipId = nextClipId(ctx.clipSuffix ?? 'panel');
  svg.insert('defs', ':first-child').append('clipPath')
    .attr('id', clipId)
    .append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', innerWidth)
    .attr('height', innerHeight);

  const geomClipGroup = panelG.append('g')
    .attr('class', 'ggpbi-geom-clip')
    .attr('clip-path', `url(#${clipId})`);

  // Axes (ggplot2 style: no axis line, outward ticks)
  const xAxis = d3.axisBottom(xScale as d3.AxisScale<d3.AxisDomain>)
    .tickSize(theme.tickLength)
    .tickSizeOuter(0);
  if (xBreaks) {
    xAxis.tickValues(xBreaks.ticks as any)
      .tickFormat((_d: any, i: number) => xBreaks.labels[i] ?? '');
  } else {
    xAxis.ticks(theme.nBreaks);
  }

  const yAxis = d3.axisLeft(yScale as d3.AxisScale<d3.AxisDomain>)
    .tickSize(theme.tickLength)
    .tickSizeOuter(0);
  if (yBreaks) {
    yAxis.tickValues(yBreaks.ticks as any)
      .tickFormat((_d: any, i: number) => yBreaks.labels[i] ?? '');
  } else {
    yAxis.ticks(theme.nBreaks);
  }

  const xAxisGroup = panelG.append('g')
    .attr('class', 'ggpbi-axis-x')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(xAxis);

  xAxisGroup.selectAll('text')
    .style('font-size', `${theme.axisTextSize}px`)
    .style('fill', theme.axisTextColor);
  xAxisGroup.selectAll('.tick line')
    .style('stroke', theme.axisTickColor);
  xAxisGroup.select('.domain').style('display', 'none');

  const yAxisGroup = panelG.append('g')
    .attr('class', 'ggpbi-axis-y')
    .call(yAxis);

  yAxisGroup.selectAll('text')
    .style('font-size', `${theme.axisTextSize}px`)
    .style('fill', theme.axisTextColor);
  yAxisGroup.selectAll('.tick line')
    .style('stroke', theme.axisTickColor);
  yAxisGroup.select('.domain').style('display', 'none');

  // Label overlap handling (ggplot2 strategy)
  if (theme.axisTextOverlap === 'hide') {
    applyOverlapCheck(xAxisGroup, 'x');
    applyOverlapCheck(yAxisGroup, 'y');
  } else if (theme.axisTextOverlap === 'rotate') {
    xAxisGroup.selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.25em');
  }

  // Render each geom layer inside clipped group (via scene builders)
  // Layer-level error recovery: a failing layer is skipped instead of crashing the whole chart
  // Repel text layers coordinate through shared per-panel state: labels
  // avoid earlier layers' labels and the positions of point-layer marks.
  const repelShared: PanelSharedState = { repelPlaced: [], repelAnchors: [] };
  for (let li = 0; li < geoms.length; li++) {
    const geom = geoms[li];
    const layerBound = layerData[li] ?? [];
    const layerGroup = geomClipGroup.append('g')
      .attr('class', `ggpbi-layer-${geom.type}`)
      .attr('role', 'list')
      .attr('aria-label', 'Data points');

    try {
      const sceneBuilder = sceneBuilders[geom.type];
      // Layers exempted from highlighting use the unwrapped colour scale.
      const layerColorScale = (geom as any).highlight === false
        ? (ctx.colorScaleBase ?? colorScale)
        : colorScale;
      if (geom.type === 'point') {
        const xo = bandOffset(xScale);
        const yo = bandOffset(yScale);
        for (const bp of layerBound) {
          const px = xScale(bp.x) + xo;
          const py = yScale(bp.y) + yo;
          if (Number.isFinite(px) && Number.isFinite(py)) {
            repelShared.repelAnchors.push({ x: px, y: py });
          }
        }
      }
      const nodes = sceneBuilder(layerBound, xScale, yScale, geom, layerColorScale, innerWidth, innerHeight, repelShared);
      renderSceneNodes(layerGroup, nodes);
    } catch (err) {
      console.warn(`ggpbi: layer ${li} (${geom.type}) failed to render, skipping.`, err);
      layerGroup.append('text')
        .attr('class', 'ggpbi-layer-error')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', theme.axisTextColor)
        .attr('font-size', `${theme.axisTextSize}px`)
        .attr('opacity', 0.6)
        .text(`Layer "${geom.type}" failed`);
    }
  }

  // High contrast: add visible strokes on bars and points
  if (theme.isHighContrast) {
    panelG.selectAll('.ggpbi-bar')
      .attr('stroke', theme.ink)
      .attr('stroke-width', theme.highContrastStrokeWidth);
    panelG.selectAll('.ggpbi-point')
      .attr('stroke', theme.ink)
      .attr('stroke-width', theme.highContrastStrokeWidth);
  }
}
