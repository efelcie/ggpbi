import * as d3 from 'd3';
import { PlotSpec, DataPoint, AesMapping, GeomConfig, PlotOptions, ScaleType, AxisScaleConfig } from './types';
import { bindData, type BoundPoint } from './bind-data';
import { createScale, createSizeScale } from './scales';
import { computePosition } from './position';
import { extendedBreaks, formatBreaksAs } from './breaks';
import { layoutFacetGrid, facetDims, parseRowAxes } from './facet-layout';
import { Tooltip, attachTooltip, attachPbiTooltip } from './tooltip';
import { Selection } from './selection';
import { inferScaleLevel } from './auto-geom';
import { renderLegend } from './legend';
import { renderPanel } from './panel';
import { renderCodeView } from './code-view';
import {
  buildPlot,
  mergeAes,
  parseScaleConfig,
  applyExpandAndLimits,
  applyHighlightToBindings,
  applyLayerFilter,
  boundExtent,
  standsOnZero,
  isMissingValue,
  estimateTextWidth,
  AXIS_TICK_PADDING,
  isBlankLabel,
  type BuiltPlot,
} from './pipeline';

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ---------------------------------------------------------------------------
// Interactivity (DOM-only — stays in render.ts)
// ---------------------------------------------------------------------------

/**
 * Make legend entries and categorical axis labels clickable: a click
 * toggle-selects every row of that group (shift-click adds it), a
 * re-click stably clears. Continuous/time axes stay non-interactive —
 * a numeric tick is a scale position, not a data group.
 */
function wireGroupToggles(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  spec: PlotSpec,
  data: DataPoint[],
  selection: Selection,
): void {
  const wire = (
    sel: d3.Selection<d3.BaseType, unknown, d3.BaseType, unknown>,
    rowsFor: (el: Element) => DataPoint[],
  ) => {
    sel
      .style('pointer-events', 'all')
      .style('cursor', 'pointer')
      .on('click.ggpbi-group', function (event: MouseEvent) {
        const rows = rowsFor(this as Element);
        if (rows.length === 0) return;
        event.stopPropagation();
        selection.toggleValueGroup(rows, event.shiftKey);
      });
  };

  // Legend entries → all rows of that colour group
  if (spec.aes.color) {
    const colorField = spec.aes.color;
    wire(svg.selectAll('.ggpbi-legend-entry'), (el) => {
      const label = el.getAttribute('data-label');
      return label == null ? [] : data.filter(d => String(d[colorField]) === label);
    });
  }

  // Categorical axis tick labels → all rows of that category
  for (const [axisClass, field] of [
    ['.ggpbi-axis-x', spec.aes.x],
    ['.ggpbi-axis-y', spec.aes.y],
  ] as const) {
    if (!field) continue;
    if (inferScaleLevel(data, field) !== 'categorical') continue;
    wire(svg.selectAll(`${axisClass} .tick text`), (el) => {
      const label = (el.textContent ?? '').trim();
      return label === '' ? [] : data.filter(d => String(d[field]) === label);
    });
  }
}

/** Wire up tooltips, selection, and drill-down handlers. */
function wireInteractivity(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  container: HTMLElement,
  spec: PlotSpec,
  data: DataPoint[],
): { tooltip?: Tooltip; selection?: Selection } {
  let tooltip: Tooltip | undefined;
  let selection: Selection | undefined;

  if (spec.tooltip?.enabled !== false) {
    const interactive = svg.selectAll(
      '.ggpbi-point, .ggpbi-bar, .ggpbi-layer-text text'
    ).style('pointer-events', 'all');

    if (spec.tooltipService) {
      attachPbiTooltip(interactive as any, spec.tooltipService, spec.aes);
    } else {
      tooltip = new Tooltip(container, spec.tooltip, spec.aes);
      attachTooltip(interactive as any, data, tooltip);
    }
  }

  if (spec.selection?.enabled !== false) {
    selection = new Selection(spec.selection);
    const interactiveElements = svg.selectAll(
      '.ggpbi-point, .ggpbi-bar, .ggpbi-layer-text text'
    ).style('pointer-events', 'all');
    selection.attach(interactiveElements as any);
    selection.attachKeyboard(svg as any);
    selection.attachBackgroundClear(container);
    // Right-clicking empty plot area opens the host menu for the visual.
    selection.attachBackgroundContextMenu(svg as any);
    wireGroupToggles(svg, spec, data, selection);
  }

  if (spec.drilldown?.enabled !== false && spec.drilldown?.onDrill) {
    svg.selectAll('.ggpbi-point, .ggpbi-bar, .ggpbi-layer-text text')
      .on('dblclick', (event: MouseEvent, d: unknown) => {
        event.stopPropagation();
        const datum = (d && typeof d === 'object' && 'datum' in d) ? (d as { datum: DataPoint }).datum : d;
        spec.drilldown!.onDrill!(datum as DataPoint);
      });
  }

  return { tooltip, selection };
}

// ---------------------------------------------------------------------------
// SVG creation (DOM-only)
// ---------------------------------------------------------------------------

function createSvg(
  container: HTMLElement,
  built: BuiltPlot,
) {
  container.replaceChildren();

  const computedPos = container.ownerDocument?.defaultView?.getComputedStyle(container).position;
  if (!computedPos || computedPos === 'static') {
    container.style.position = 'relative';
  }

  const { width, height, margin } = built.layout;
  const chartLabel = [built.spec.xLabel, built.spec.yLabel].filter(Boolean).join(' vs ') || 'Chart';

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'ggpbi-visual')
    .attr('role', 'img')
    .attr('aria-label', chartLabel)
    .style('pointer-events', 'none')
    // Every text inherits the theme's family (ggplot2 base_family).
    .style('font-family', built.theme.fontFamily);

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  return { svg, g };
}

/** The axis options a panel takes from the scale configs. */
function axisOptions(xCfg: AxisScaleConfig, yCfg: AxisScaleConfig) {
  return {
    yPosition: yCfg.position,
    xLabelUnit: xCfg.labelUnit,
    yLabelUnit: yCfg.labelUnit,
    xLabelColor: xCfg.labelColor,
    yLabelColor: yCfg.labelColor,
    xDateBreaks: xCfg.dateBreaks,
    yDateBreaks: yCfg.dateBreaks,
  };
}

// ---------------------------------------------------------------------------
// Faceting (DOM layout + per-cell scales)
// ---------------------------------------------------------------------------

function renderFaceted(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  built: BuiltPlot,
): void {
  const { spec, data, theme, scales } = built;
  const { innerWidth, innerHeight } = built.layout;
  const facet = spec.facet!;
  const rowField = facet.row;
  const colField = facet.col;

  // facet_wrap: one variable wrapped row-major into a roughly square grid;
  // takes precedence over row/col. Levels sort like ggplot2 factor levels
  // and come from every row, so a level only one layer has values for
  // still gets its panel.
  const wrapField = facet.wrap;
  const { wrapLevels, rowLevels, colLevels, nRows, nCols } =
    facetDims(facet, data as Array<Record<string, unknown>>);
  const showStrips = facet.strips !== false;
  const yRight = parseScaleConfig(spec.scales?.y).position === 'right';

  // Parse scale configs for per-cell scale creation
  const xCfg = parseScaleConfig(spec.scales?.x);
  const yCfg = parseScaleConfig(spec.scales?.y);
  const { xType, yType } = scales;
  const geoms = spec.layers.map(l => l.geom);

  // Band scale options (reuse from global scale training)
  const xBandOpts = (xType === 'ordinal' || xType === 'category')
    ? { paddingInner: xCfg.paddingInner, paddingOuter: xCfg.paddingOuter }
    : undefined;

  // --- 1. Cells: the rows and per-layer bindings of every panel ------------
  interface Cell {
    r: number;
    c: number;
    label: { wrap?: string; row: string; col: string };
    rows: DataPoint[];
    layerData: BoundPoint[][];
  }
  const cells: Cell[] = [];
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      const wrapVal = wrapField ? wrapLevels[r * nCols + c] : undefined;
      if (wrapField && wrapVal === undefined) continue; // trailing empty cell
      const rowVal = rowLevels[r];
      const colVal = colLevels[c];
      const rows = data.filter(d => {
        if (wrapField) return String((d as any)[wrapField]) === wrapVal;
        const okRow = !rowField || String((d as any)[rowField]) === rowVal;
        const okCol = !colField || String((d as any)[colField]) === colVal;
        return okRow && okCol;
      });
      // Each layer with its own aesthetics, row filter and position
      // adjustment — the same steps as the unfaceted pipeline.
      let layerData = spec.layers.map(layer => {
        if (rows.length === 0) return [];
        const mergedAes = mergeAes(spec.aes, layer.aes ?? layer.geom.aes);
        const cellRows = applyLayerFilter(rows, layer.geom, mergedAes, spec.scales);
        const bound = bindData(cellRows, mergedAes);
        if (spec.aes.size) {
          const facetSizeScale = createSizeScale(data, spec.aes.size);
          for (const bp of bound) {
            if (bp.size != null) bp.size = facetSizeScale(Number(bp.size));
          }
        }
        const t = layer.geom.type;
        return t === 'bar' || t === 'col' || t === 'histogram'
          ? computePosition(bound, layer.geom)
          : bound;
      });
      layerData = applyHighlightToBindings(layerData, spec);
      cells.push({ r, c, label: { wrap: wrapVal, row: rowVal, col: colVal }, rows, layerData });
    }
  }

  // --- 2. Scales ---------------------------------------------------------------
  // A continuous value axis trains on every layer's own values: the bars of
  // layer 2 and the dashed reference of layer 3 count, not just the global
  // y — and a panel where layer 1 is blank still gets a scale.
  const isContinuous = (t: ScaleType) => t === 'linear' || t === 'log' || t === 'sqrt';
  const freshContinuous = (t: ScaleType): any =>
    t === 'log' ? d3.scaleLog() : t === 'sqrt' ? d3.scaleSqrt() : d3.scaleLinear();

  const trainValueScale = (
    axis: 'x' | 'y',
    type: ScaleType,
    scope: Cell[],
    range: [number, number],
    cfg: ReturnType<typeof parseScaleConfig>,
    padPx: number,
  ): any => {
    const bindings = scope.flatMap(cell => cell.layerData);
    const layerGeoms = scope.flatMap(() => geoms);
    const ext = boundExtent(bindings, layerGeoms, axis, false)
      ?? boundExtent(cells.flatMap(cell => cell.layerData), cells.flatMap(() => geoms), axis, false)
      ?? [0, 1];
    // A single value has no extent; widen it so the panel still has an axis.
    const domain: [number, number] = ext[0] === ext[1]
      ? [ext[0] - (Math.abs(ext[0]) || 1) * 0.5, ext[1] + (Math.abs(ext[1]) || 1) * 0.5]
      : ext;
    const scale = freshContinuous(type).domain(domain).range(range);
    applyExpandAndLimits(scale, type, cfg, padPx);
    // Bars and areas stand on zero: the baseline joins the domain without
    // expansion below it, as in the unfaceted pipeline.
    const onZero = bindings.some((pts, i) => standsOnZero(layerGeoms[i], axis)
      && pts.some(p => !isMissingValue(p[axis]) && Number.isFinite(Number(p[axis]))));
    if (onZero && type !== 'log') {
      const [d0, d1] = scale.domain() as [number, number];
      scale.domain([
        cfg.min !== undefined ? d0 : ext[0] >= 0 ? 0 : Math.min(d0, 0),
        cfg.max !== undefined ? d1 : ext[1] <= 0 ? 0 : Math.max(d1, 0),
      ]);
    }
    return scale;
  };

  const hasHorizontalBars = geoms.some(gm => standsOnZero(gm, 'x'));

  const makeXScale = (cell: Cell, range: [number, number]): any => {
    if (hasHorizontalBars && isContinuous(xType)) {
      return trainValueScale('x', xType, facet.freeX ? [cell] : cells, range, xCfg, built.geomPadPx.x);
    }
    const scale = createScale(facet.freeX ? cell.rows : data, spec.aes.x!, xType, range, xBandOpts);
    applyExpandAndLimits(scale, xType, xCfg, built.geomPadPx.x);
    return scale;
  };
  const makeYScale = (cell: Cell, range: [number, number]): any => {
    if (isContinuous(yType)) {
      return trainValueScale('y', yType, facet.freeY ? [cell] : cells, range, yCfg, built.geomPadPx.y);
    }
    const scale = createScale(facet.freeY ? cell.rows : data, spec.aes.y!, yType, range);
    applyExpandAndLimits(scale, yType, yCfg, built.geomPadPx.y);
    return scale;
  };

  // --- 3. Layout -------------------------------------------------------------
  // The y-axis room of a column is its widest tick label, estimated from
  // the same breaks and formatter the panel will draw.
  const yLabelWidth = (cell: Cell): number => {
    const scale = makeYScale(cell, [100, 0]);
    let labels: string[];
    if (typeof scale.bandwidth === 'function') {
      labels = (scale.domain() as unknown[]).map(String);
    } else if (yType === 'time') {
      labels = ['MMMMMM'];
    } else {
      const [lo, hi] = (scale.domain() as unknown[]).map(Number);
      const ticks = Number.isFinite(lo) && Number.isFinite(hi) && lo !== hi
        ? extendedBreaks(lo, hi, theme.nBreaks).filter(t => t >= lo && t <= hi)
        : [];
      labels = formatBreaksAs(ticks, yCfg.labels, { ...spec.format, unit: yCfg.labelUnit });
    }
    return labels.reduce((w, l) => Math.max(w, estimateTextWidth(l, theme.axisTextSize)), 0);
  };
  const outerCol = yRight ? nCols - 1 : 0;
  const rowAxes = (facet.rowAxes ?? []).map(parseRowAxes);
  const colLabelWidth: number[] = Array.from({ length: nCols }, () => 0);
  for (const cell of cells) {
    if (cell.c === outerCol || facet.freeY || rowAxes[cell.r]?.y) {
      colLabelWidth[cell.c] = Math.max(colLabelWidth[cell.c], yLabelWidth(cell));
    }
  }
  const tickRoom = theme.tickLength + AXIS_TICK_PADDING;
  // What the outer margin already holds for column 0's tick labels: all of
  // it except the plot margin and the y-axis title strip.
  const reservedLeft = built.layout.yAxisRoom ?? 0;
  const present = new Set(cells.map(cell => `${cell.r},${cell.c}`));
  // ggplot2 strip: the strip text (rel(0.8)) with 0.8 × half_line above and below.
  const stripH = Math.round(theme.axisTextSize + 1.6 * theme.halfLine);
  const grid = layoutFacetGrid({
    nRows,
    nCols,
    present: (r, c) => present.has(`${r},${c}`),
    innerWidth,
    innerHeight,
    freeX: !!facet.freeX,
    freeY: !!facet.freeY,
    stripAbove: r => showStrips && (!!wrapField || (!!colField && r === 0)),
    stripRight: showStrips && !wrapField && !!rowField,
    yAxisSide: yRight ? 'right' : 'left',
    rowAxes,
    heights: facet.heights,
    yAxisWidth: c => colLabelWidth[c] + tickRoom,
    reservedLeft,
    metrics: {
      strip: stripH,
      xAxis: Math.round(tickRoom + theme.axisTextSize * 1.2),
      spacing: theme.halfLine,
      // Free x scales label both edges of every panel: leave room so the
      // last tick of one panel and the first of the next do not collide.
      ...(facet.freeX && { colSpacing: theme.halfLine + theme.axisTextSize * 2 }),
    },
  });
  const cellAt = new Map(cells.map(cell => [`${cell.r},${cell.c}`, cell]));

  // --- 4. Draw ---------------------------------------------------------------
  const stripText = (
    parent: d3.Selection<SVGGElement, unknown, null, undefined>,
    cls: string,
    x: number,
    y: number,
    text: string,
    rotate = false,
  ): void => {
    const t = parent.append('text')
      .attr('class', cls)
      .attr('x', x)
      .attr('y', y)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .style('font-size', `${theme.axisTextSize}px`)
      .style('fill', theme.axisTextColor)
      .text(text);
    if (rotate) t.attr('transform', `rotate(90,${x},${y})`);
  };

  for (const pos of grid) {
    const cell = cellAt.get(`${pos.r},${pos.c}`)!;
    const facetG = g.append('g')
      .attr('class', 'ggpbi-facet')
      .attr('transform', `translate(${pos.x},${pos.y})`);

    // Strips: above the panel for wrap and grid columns, right of the last
    // column for grid rows — where ggplot2 puts them.
    if (showStrips && wrapField) {
      stripText(facetG, 'ggpbi-facet-strip-wrap', pos.width / 2, -stripH / 2, cell.label.wrap!);
    }
    if (showStrips && !wrapField && colField && pos.r === 0) {
      stripText(facetG, 'ggpbi-facet-strip-col', pos.width / 2, -stripH / 2, cell.label.col);
    }
    if (showStrips && !wrapField && rowField && pos.c === nCols - 1) {
      stripText(facetG, 'ggpbi-facet-strip-row', pos.width + stripH / 2, pos.height / 2, cell.label.row, true);
    }

    const panelG = facetG.append('g').attr('class', 'ggpbi-facet-panel');
    renderPanel({
      panelG, svg, innerWidth: pos.width, innerHeight: pos.height,
      xScale: makeXScale(cell, [0, pos.width]),
      yScale: makeYScale(cell, [pos.height, 0]),
      theme, colorScale: scales.color, colorScaleBase: scales.colorBase,
      geoms, layerData: cell.layerData,
      clipSuffix: `facet-${pos.r}-${pos.c}`,
      xLabelFormat: xCfg.labels,
      yLabelFormat: yCfg.labels,
      format: spec.format,
      xDateFormat: xCfg.dateLabels,
      yDateFormat: yCfg.dateLabels,
      ...axisOptions(xCfg, yCfg),
      showXAxis: pos.showXAxis,
      showYAxis: pos.showYAxis,
    });
  }
}

// ---------------------------------------------------------------------------
// Axis labels + legend (DOM-only)
// ---------------------------------------------------------------------------

function renderLabelsAndLegend(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  built: BuiltPlot,
): void {
  const { spec, theme, layout, legend } = built;
  const { innerWidth, innerHeight } = layout;

  // Subtitle: what the plot actually does, above the panel. Resolved in
  // buildPlot (explicit string, or generated for 'auto'/'always').
  const subtitle = built.subtitleText;
  if (subtitle) {
    g.append('text')
      .attr('class', 'ggpbi-subtitle')
      .attr('x', 0)
      .attr('y', -theme.halfLine)
      .attr('text-anchor', 'start')
      .attr('font-size', `${theme.plotCaptionSize}px`)
      .attr('fill', theme.axisTextColor)
      .text(subtitle);
  }

  if (spec.xLabel && !isBlankLabel(spec.xLabel)) {
    g.append('text')
      .attr('class', 'ggpbi-axis-label-x')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + layout.margin.bottom - theme.axisTitleMargin)
      .attr('text-anchor', 'middle')
      .attr('font-size', `${theme.axisTitleSize}px`)
      .attr('fill', theme.ink)
      .text(spec.xLabel);
  }

  // A right-hand y axis (ggplot2 position = "right") puts its title on the
  // right, reading top to bottom like axis.title.y.right.
  const yRight = parseScaleConfig(spec.scales?.y).position === 'right';
  const rightAxisRoom = yRight ? layout.margin.right - legend.width - theme.halfLine * 2 : 0;
  if (spec.yLabel && !isBlankLabel(spec.yLabel)) {
    const title = g.append('text')
      .attr('class', 'ggpbi-axis-label-y')
      .attr('text-anchor', 'middle')
      .attr('font-size', `${theme.axisTitleSize}px`)
      .attr('fill', theme.ink)
      .text(spec.yLabel);
    if (yRight) {
      const x = innerWidth + rightAxisRoom - theme.axisTitleSize * 0.2;
      title.attr('transform', `translate(${x},${innerHeight / 2}) rotate(90)`)
        .attr('x', 0)
        .attr('y', 0);
    } else {
      title.attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -layout.margin.left + theme.axisTitleSize + theme.axisTitleMargin);
    }
  }

  const showLegend = spec.showLegend !== false;
  if (showLegend && legend.entries.length > 0 && spec.aes.color) {
    // Past the right-hand axis when there is one.
    renderLegend(g, legend.entries, spec.aes.color, spec.layers.map(l => l.geom), theme, innerWidth + rightAxisRoom);
  }
}

// ---------------------------------------------------------------------------
// Main render — thin orchestrator
// ---------------------------------------------------------------------------

export interface PlotResult {
  svg: SVGSVGElement;
  tooltip?: Tooltip;
  selection?: Selection;
}

/**
 * Render a chart from a PlotSpec.
 *
 * Pipeline: PlotSpec → buildPlot() → DOM rendering
 */
export function renderWithState(
  container: HTMLElement,
  spec: PlotSpec,
  margin?: Margin
): PlotResult {
  // 1. Pure data pipeline (no DOM)
  const built = buildPlot(spec, margin);

  // 2. Create SVG
  const { svg, g } = createSvg(container, built);

  // 3. Empty data → return empty SVG
  if (built.data.length === 0) {
    return { svg: svg.node()! };
  }

  // 4. Render panels
  const facet = built.spec.facet;
  if (facet?.row || facet?.col || facet?.wrap) {
    renderFaceted(g, svg, built);
  } else {
    renderPanel({
      panelG: g, svg,
      innerWidth: built.layout.innerWidth,
      innerHeight: built.layout.innerHeight,
      xScale: built.scales.x,
      yScale: built.scales.y,
      theme: built.theme,
      colorScale: built.scales.color,
      colorScaleBase: built.scales.colorBase,
      geoms: built.spec.layers.map(l => l.geom),
      layerData: built.layers.map(l => l.data),
      xLabelFormat: parseScaleConfig(built.spec.scales?.x).labels,
      yLabelFormat: parseScaleConfig(built.spec.scales?.y).labels,
      format: built.spec.format,
      xDateFormat: parseScaleConfig(built.spec.scales?.x).dateLabels,
      yDateFormat: parseScaleConfig(built.spec.scales?.y).dateLabels,
      ...axisOptions(parseScaleConfig(built.spec.scales?.x), parseScaleConfig(built.spec.scales?.y)),
    });
  }

  // 5. Labels + Legend
  renderLabelsAndLegend(g, built);

  // 6. Interactivity
  const { tooltip, selection } = wireInteractivity(svg, container, built.spec, built.data);

  // 7. Debug view: the code behind the chart, overlaid so the plot keeps
  // its size. Last, so it sits above the marks.
  if (built.codeText) {
    const dock = spec.codeEdit?.dockHost;
    if (dock) {
      // Advanced edit: the editor is a docked pane beside the chart, not
      // an overlay on top of it.
      dock.replaceChildren();
      renderCodeView(dock, built.codeText, built.theme, {
        ...(spec.codeEdit ?? {}),
        syntax: spec.codeSyntax ?? 'ggpbi',
        docked: true,
      });
    } else {
      renderCodeView(container, built.codeText, built.theme, {
        ...(spec.codeEdit ?? {}),
        syntax: spec.codeSyntax ?? 'ggpbi',
      });
    }
  }

  return { svg: svg.node()!, tooltip, selection };
}

// ---------------------------------------------------------------------------
// Public API overloads
// ---------------------------------------------------------------------------

/** Render with flat parameters (geoms auto-wrapped as layers) */
export function render(
  container: HTMLElement,
  data: DataPoint[],
  aes: AesMapping,
  geoms: GeomConfig[],
  options?: PlotOptions,
): SVGSVGElement;
/** Render with PlotSpec */
export function render(
  container: HTMLElement,
  spec: PlotSpec,
  margin?: Margin,
): SVGSVGElement;
export function render(
  container: HTMLElement,
  dataOrSpec: DataPoint[] | PlotSpec,
  aesOrMargin?: AesMapping | Margin,
  geoms?: GeomConfig[],
  options?: PlotOptions,
): SVGSVGElement {
  if (Array.isArray(dataOrSpec)) {
    const spec: PlotSpec = {
      data: dataOrSpec,
      aes: aesOrMargin as AesMapping,
      layers: geoms!.map(g => ({ geom: g })),
      ...options,
    };
    return renderWithState(container, spec).svg;
  }
  return renderWithState(container, dataOrSpec, aesOrMargin as Margin).svg;
}
