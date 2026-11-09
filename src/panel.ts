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
import { bandOffset, GEOM_DEFAULT_COLOR } from './geoms/util';
import { renderLabelTemplate } from './geoms/text';
import type { PanelSharedState } from './scene-types';
import { renderSceneNodes } from './scene-renderer';
import type { LabelFormat } from './types';
import { extendedBreaks, formatBreaksAs, minorBreaks } from './breaks';
import { formatDates, type FormatOptions, type DateFormat, type LabelUnit, type UnitSuffix } from './format';

/**
 * ggplot2's `date_breaks` ("6 months", "1 year", "2 weeks") as a d3
 * interval. Undefined for anything it cannot read — d3 picks then.
 */
export function parseDateBreaks(text: string | undefined): d3.TimeInterval | undefined {
  if (!text) return undefined;
  const m = /^\s*(\d+)?\s*(day|week|month|quarter|year)s?\s*$/i.exec(text);
  if (!m) return undefined;
  const n = Math.max(1, Number(m[1] ?? 1));
  switch (m[2].toLowerCase()) {
    case 'day': return d3.timeDay.every(n) ?? undefined;
    case 'week': return d3.timeWeek.every(n) ?? undefined;
    case 'month': return d3.timeMonth.every(n) ?? undefined;
    case 'quarter': return d3.timeMonth.every(3 * n) ?? undefined;
    case 'year': return d3.timeYear.every(n) ?? undefined;
  }
  return undefined;
}

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
  fmt: FormatOptions & { dateFormat?: DateFormat; dateBreaks?: string; unit?: LabelUnit } = {},
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
    const interval = parseDateBreaks(fmt.dateBreaks);
    const dateTicks = (interval ? scale.ticks(interval) : scale.ticks(nBreaks)) as Date[];
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

/**
 * A value as the y axis would print it, one digit finer than the axis: an
 * end label must not round the very number it is there to show. On an axis
 * of 4M … 7M (whole millions) the line ending at 7.62M reads "7.6M", on an
 * axis of 95 % … 100 % an end at 96.5 % reads "96.5 %". Same format, unit
 * and suffix as the axis labels.
 */
export function formatLikeAxis(
  value: number,
  ticks: number[],
  labelFormat: LabelFormat | undefined,
  fmt: FormatOptions & { unit?: LabelUnit },
): string {
  const finite = [...new Set(ticks.filter(Number.isFinite))].sort((a, b) => a - b);
  let rounded = value;
  if (finite.length >= 2) {
    let diff = Infinity;
    for (let i = 1; i < finite.length; i++) diff = Math.min(diff, finite[i] - finite[i - 1]);
    if (diff > 0 && Number.isFinite(diff)) {
      // The axis precision (scales::precision on the breaks), then one
      // digit finer.
      let p = Math.pow(10, Math.floor(Math.log10(diff) + 1e-9) - 1);
      if (finite.every(t => Math.round(t / p) % 10 === 0)) p *= 10;
      p /= 10;
      rounded = Math.round(value / p) * p;
    }
  }
  const labels = formatBreaksAs([...finite, rounded], labelFormat, fmt);
  return labels[labels.length - 1];
}

interface Box { x0: number; x1: number; y0: number; y1: number }

/** Does the segment (ax, ay)–(bx, by) cross the box? Liang–Barsky clipping. */
function segmentHitsBox(ax: number, ay: number, bx: number, by: number, b: Box): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const edges: Array<[number, number]> = [
    [-dx, ax - b.x0], [dx, b.x1 - ax], [-dy, ay - b.y0], [dy, b.y1 - ay],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
  }
  return t0 <= t1;
}

/**
 * Direct labels at the end of line and area layers: a dot at the last
 * point and/or its value (or a template text such as "Prior year") in the
 * layer colour — ggplot2's geom_point()/geom_text() on slice_max(.x, x).
 *
 * The label takes the first free spot around its point — above or below,
 * beside it on the left, or one line further out — where "free" means no
 * line of the panel runs through it and no other end label sits there,
 * like ggrepel's search for a spot that keeps the label off the data. The
 * order follows the line: a rising line looks above first, a falling one
 * below, a steep drop finds the room beside it. When another line crosses
 * every spot at the end, the label slides left along its line. Labels stay
 * inside the panel (they may reach into the plot margin above it).
 */
function drawEndMarks(ctx: PanelInput, yTicks: Array<number | Date>): void {
  const { panelG, xScale, yScale, theme, geoms, layerData, colorScale, innerHeight } = ctx;
  const xo = bandOffset(xScale);
  const yo = bandOffset(yScale);
  const fontSize = theme.axisTextSize;
  const numericTicks = yTicks.filter((t): t is number => typeof t === 'number');
  const px = (p: BoundPoint) => Number(xScale(p.x)) + xo;
  const py = (p: BoundPoint) => Number(yScale(p.y)) + yo;
  const isLineLike = (t: string) => t === 'line' || t === 'area' || t === 'smooth';

  // Obstacles: every line of the panel, as pixel polylines per colour group.
  const polylines: Array<Array<[number, number]>> = [];
  const groupsOf = (li: number) => {
    const pts = (layerData[li] ?? []).filter(p =>
      p.x != null && p.y != null && Number.isFinite(px(p)) && Number.isFinite(py(p)));
    return d3.group(pts, p => (p.color === undefined ? '' : String(p.color)));
  };
  geoms.forEach((geom, li) => {
    if (!isLineLike(geom.type)) return;
    for (const groupPts of groupsOf(li).values()) {
      polylines.push([...groupPts].sort((a, b) => px(a) - px(b)).map(p => [px(p), py(p)]));
    }
  });
  const placed: Box[] = [];
  const collisions = (b: Box): number => {
    const pad = { x0: b.x0 - 1, x1: b.x1 + 1, y0: b.y0 - 1, y1: b.y1 + 1 };
    let n = 0;
    for (const line of polylines) {
      for (let i = 1; i < line.length; i++) {
        const [ax, ay] = line[i - 1];
        const [bx, by] = line[i];
        if (segmentHitsBox(ax, ay, bx, by, pad)) n++;
      }
    }
    for (const q of placed) {
      if (b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0) n += 10;
    }
    return n;
  };

  let group: d3.Selection<SVGGElement, unknown, null, undefined> | undefined;
  geoms.forEach((geom, li) => {
    if (geom.type !== 'line' && geom.type !== 'area') return;
    if (!geom.endPoint && !geom.endLabel) return;

    for (const [key, groupPts] of groupsOf(li)) {
      const sorted = [...groupPts].sort((a, b) => px(a) - px(b));
      const last = sorted[sorted.length - 1];
      const prev = sorted[sorted.length - 2];
      if (!last) continue;
      const color = key !== '' && colorScale ? colorScale(key) : (geom.color ?? GEOM_DEFAULT_COLOR);
      const x = px(last);
      const y = py(last);
      group ??= panelG.append('g').attr('class', 'ggpbi-end-marks');

      const lineWidth = geom.size ?? 2;
      const r = Math.max(2.5, lineWidth * 1.4);
      if (geom.endPoint) {
        group.append('circle')
          .attr('class', 'ggpbi-end-point')
          .attr('cx', x).attr('cy', y).attr('r', r)
          .attr('fill', color);
        // A dot is an obstacle for the labels that follow.
        placed.push({ x0: x - r, x1: x + r, y0: y - r, y1: y + r });
      }
      if (!geom.endLabel) continue;

      const text = geom.labelTemplate
        ? renderLabelTemplate(geom.labelTemplate, last)
        : typeof last.y === 'number'
          ? formatLikeAxis(last.y, numericTicks, ctx.yLabelFormat,
            { ...ctx.format, unit: ctx.yLabelUnit, unitSuffix: ctx.yUnitSuffix })
          : String(last.y);
      if (!text) continue;

      const w = text.length * fontSize * (geom.labelTemplate ? 0.58 : 0.62);
      const h = fontSize;
      const gap = (geom.endPoint ? r : lineWidth / 2) + fontSize * 0.35;
      const spots: Record<string, Box> = {
        above: { x0: x - w, x1: x, y0: y - gap - h, y1: y - gap },
        below: { x0: x - w, x1: x, y0: y + gap, y1: y + gap + h },
        beside: { x0: x - gap - w, x1: x - gap, y0: y - h / 2, y1: y + h / 2 },
        higher: { x0: x - w, x1: x, y0: y - gap - 2 * h, y1: y - gap - h },
        lower: { x0: x - w, x1: x, y0: y + gap + h, y1: y + gap + 2 * h },
      };
      // Screen y grows downwards: dy < 0 means the line rises into the point.
      const dy = prev ? y - py(prev) : 0;
      const order = !prev || Math.abs(dy) < 0.5
        ? ['above', 'below', 'beside', 'higher', 'lower']
        : dy < 0
          ? ['above', 'beside', 'below', 'higher', 'lower']
          : ['below', 'beside', 'above', 'lower', 'higher'];
      // When every spot at the end is taken (another line crosses there),
      // slide along the line to the left, above and below it — a label
      // on a reference line can stand wherever the line is free.
      const candidates: Box[] = order.map(name => spots[name]);
      for (const k of [0.5, 1, 1.5, 2, 3]) {
        const s = w * k;
        for (const name of [order[0], order[2]]) {
          const b = spots[name];
          candidates.push({ x0: b.x0 - s, x1: b.x1 - s, y0: b.y0, y1: b.y1 });
        }
      }
      const inside = (b: Box) => b.x0 >= 0 && b.y0 >= -theme.halfLine * 2 && b.y1 <= innerHeight;
      let best: Box | undefined;
      let bestScore = Infinity;
      for (const b of candidates) {
        if (!inside(b)) continue;
        const score = collisions(b);
        if (score < bestScore) {
          best = b;
          bestScore = score;
          if (score === 0) break;
        }
      }
      const b = best ?? candidates[0];
      placed.push(b);

      group.append('text')
        .attr('class', 'ggpbi-end-label')
        .attr('x', b.x1)
        .attr('y', b.y1 - fontSize * 0.2)
        .attr('text-anchor', 'end')
        .attr('font-size', `${fontSize}px`)
        // A value reads as the number of the chart; a name stays quiet.
        .attr('font-weight', geom.labelTemplate ? 400 : 600)
        .attr('fill', color)
        .text(text);
    }
  });
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
  /**
   * Draw the x axis (ticks and labels). Facets draw it only on the outer
   * panels unless the x scale is free, like ggplot2. Default true.
   */
  showXAxis?: boolean;
  /** Draw the y axis. Default true. */
  showYAxis?: boolean;
  /** Which side the y axis sits on (ggplot2 position = "right"). */
  yPosition?: 'left' | 'right';
  /** Fixed display units for the tick labels (Power BI display units). */
  xLabelUnit?: LabelUnit;
  yLabelUnit?: LabelUnit;
  /** Unit naming for compact labels and display units (K/M, "7,6 M", "Mio."). */
  xUnitSuffix?: UnitSuffix;
  yUnitSuffix?: UnitSuffix;
  /** Tick label colours; default the theme's axis text colour. */
  xLabelColor?: string;
  yLabelColor?: string;
  /** Fixed spacing of time-axis breaks, ggplot2's date_breaks ("6 months"). */
  xDateBreaks?: string;
  yDateBreaks?: string;
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
    { ...ctx.format, dateFormat: ctx.xDateFormat, dateBreaks: ctx.xDateBreaks, unit: ctx.xLabelUnit, unitSuffix: ctx.xUnitSuffix });
  const yBreaks = ggBreaks(yScale, theme.nBreaks, ctx.yLabelFormat,
    { ...ctx.format, dateFormat: ctx.yDateFormat, dateBreaks: ctx.yDateBreaks, unit: ctx.yLabelUnit, unitSuffix: ctx.yUnitSuffix });

  const isBandX = typeof (xScale as any).bandwidth === 'function';
  const xTicks = isBandX ? [] : (xBreaks?.ticks ?? ((xScale as any).ticks ? (xScale as any).ticks(theme.nBreaks) : []));
  const yTicks = yBreaks?.ticks ?? ((yScale as any).ticks ? (yScale as any).ticks(theme.nBreaks) : []);

  // Minor grid lines (ggplot2 panel.grid.minor: rel(0.5) linewidth)
  const yDom = (yScale as any).domain?.() as [number, number] | undefined;
  const xDom = (xScale as any).domain?.() as [number, number] | undefined;
  // Grid switches (ggplot2 panel.grid.major.x / .y, panel.grid.minor):
  // a direction switched off loses its major and minor lines.
  const yMinor = theme.gridY && theme.gridMinor && yDom ? minorBreaks(yTicks, yDom[0], yDom[1]) : [];
  const xMinor = isBandX || !theme.gridX || !theme.gridMinor
    ? [] : (xDom ? minorBreaks(xTicks, xDom[0], xDom[1]) : []);

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
  for (const tick of theme.gridY ? yTicks : []) {
    panelG.append('line')
      .attr('class', 'ggpbi-grid')
      .attr('x1', 0).attr('x2', innerWidth)
      .attr('y1', (yScale as any)(tick)).attr('y2', (yScale as any)(tick))
      .attr('stroke', theme.gridColor).attr('stroke-width', theme.baseLineSize);
  }
  for (const tick of theme.gridX ? xTicks : []) {
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

  const yRight = ctx.yPosition === 'right';
  const yAxis = (yRight ? d3.axisRight : d3.axisLeft)(yScale as d3.AxisScale<d3.AxisDomain>)
    .tickSize(theme.tickLength)
    .tickSizeOuter(0);
  if (yBreaks) {
    yAxis.tickValues(yBreaks.ticks as any)
      .tickFormat((_d: any, i: number) => yBreaks.labels[i] ?? '');
  } else {
    yAxis.ticks(theme.nBreaks);
  }

  // A hidden axis still contributes its breaks to the grid above; only
  // the ticks and labels stay off (facet panels that share the axis).
  const xAxisGroup = panelG.append('g')
    .attr('class', 'ggpbi-axis-x')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(xAxis);
  if (ctx.showXAxis === false) xAxisGroup.remove();

  // d3 stamps font-family="sans-serif" on every axis; the theme's family wins.
  xAxisGroup.attr('font-family', theme.fontFamily);
  xAxisGroup.selectAll('text')
    .style('font-size', `${theme.axisTextSize}px`)
    .style('fill', ctx.xLabelColor ?? theme.axisTextColor);
  xAxisGroup.selectAll('.tick line')
    .style('stroke', theme.axisTickColor);
  xAxisGroup.select('.domain').style('display', 'none');

  const yAxisGroup = panelG.append('g')
    .attr('class', 'ggpbi-axis-y')
    .attr('font-family', theme.fontFamily)
    .call(yAxis);
  if (yRight) yAxisGroup.attr('transform', `translate(${innerWidth},0)`);
  if (ctx.showYAxis === false) yAxisGroup.remove();

  yAxisGroup.selectAll('text')
    .style('font-size', `${theme.axisTextSize}px`)
    .style('fill', ctx.yLabelColor ?? theme.axisTextColor);
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

  drawEndMarks(ctx, yTicks);

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
