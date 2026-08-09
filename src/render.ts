import * as d3 from 'd3';
import { PlotSpec, DataPoint, AesMapping, GeomConfig, PlotOptions } from './types';
import { bindData } from './bind-data';
import { createScale, createSizeScale } from './scales';
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
    .style('pointer-events', 'none');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  return { svg, g };
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

  // Facet levels are sorted like ggplot2 factor levels: numerically when all
  // values are numbers (4, 6, 8 — not data order), alphabetically otherwise.
  const levelSort = (a: string, b: string): number => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  };
  // facet_wrap: one variable wrapped row-major into a roughly square grid.
  // Takes precedence over row/col.
  const wrapField = facet.wrap;
  const wrapLevels = wrapField
    ? Array.from(new Set(data.map(d => String((d as any)[wrapField])))).sort(levelSort)
    : [];

  const rowLevels = !wrapField && rowField
    ? Array.from(new Set(data.map(d => String((d as any)[rowField])))).sort(levelSort)
    : [''];
  const colLevels = !wrapField && colField
    ? Array.from(new Set(data.map(d => String((d as any)[colField])))).sort(levelSort)
    : [''];

  let nRows: number;
  let nCols: number;
  if (wrapField) {
    // ggplot2 wrap_dims: ncol wins, else derive from nrow, else ceil(sqrt(n)).
    const n = wrapLevels.length;
    nCols = facet.ncol ?? (facet.nrow ? Math.ceil(n / facet.nrow) : Math.ceil(Math.sqrt(n)));
    nCols = Math.max(1, Math.min(nCols, n));
    nRows = Math.ceil(n / nCols);
  } else {
    nRows = Math.max(1, rowLevels.length);
    nCols = Math.max(1, colLevels.length);
  }
  const panelOuterWidth = innerWidth / nCols;
  const panelOuterHeight = innerHeight / nRows;

  const panelMargin: Margin = { top: 22, right: 12, bottom: 34, left: 44 };

  // Parse scale configs for per-cell scale creation
  const xCfg = parseScaleConfig(spec.scales?.x);
  const yCfg = parseScaleConfig(spec.scales?.y);
  const { xType, yType } = scales;

  // Band scale options (reuse from global scale training)
  const xBandOpts = (xType === 'ordinal' || xType === 'category')
    ? { paddingInner: xCfg.paddingInner, paddingOuter: xCfg.paddingOuter }
    : undefined;

  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      const wrapVal = wrapField ? wrapLevels[r * nCols + c] : undefined;
      if (wrapField && wrapVal === undefined) continue; // trailing empty cell

      const rowVal = rowLevels[r];
      const colVal = colLevels[c];

      const dataCell = data.filter(d => {
        if (wrapField) return String((d as any)[wrapField]) === wrapVal;
        const okRow = !rowField || String((d as any)[rowField]) === rowVal;
        const okCol = !colField || String((d as any)[colField]) === colVal;
        return okRow && okCol;
      });

      const facetG = g.append('g')
        .attr('class', 'ggpbi-facet')
        .attr('transform', `translate(${c * panelOuterWidth},${r * panelOuterHeight})`);

      // Strip labels
      if (wrapField) {
        facetG.append('text')
          .attr('class', 'ggpbi-facet-strip-wrap')
          .attr('x', panelOuterWidth / 2)
          .attr('y', 14)
          .attr('text-anchor', 'middle')
          .style('font-size', `${theme.axisTextSize}px`)
          .style('fill', theme.axisTextColor)
          .text(wrapVal!);
      }
      if (!wrapField && colField && r === 0) {
        facetG.append('text')
          .attr('class', 'ggpbi-facet-strip-col')
          .attr('x', panelOuterWidth / 2)
          .attr('y', 14)
          .attr('text-anchor', 'middle')
          .style('font-size', `${theme.axisTextSize}px`)
          .style('fill', theme.axisTextColor)
          .text(colVal);
      }
      if (!wrapField && rowField && c === 0) {
        facetG.append('text')
          .attr('class', 'ggpbi-facet-strip-row')
          .attr('x', 4)
          .attr('y', 14)
          .attr('text-anchor', 'start')
          .style('font-size', `${theme.axisTextSize}px`)
          .style('fill', theme.axisTextColor)
          .text(rowVal);
      }

      const panelInnerWidth = panelOuterWidth - panelMargin.left - panelMargin.right;
      const panelInnerHeight = panelOuterHeight - panelMargin.top - panelMargin.bottom;

      const panelG = facetG.append('g')
        .attr('transform', `translate(${panelMargin.left},${panelMargin.top})`);

      // Per-cell scales (shared or free)
      const xScale = facet.freeX
        ? createScale(dataCell, spec.aes.x!, xType, [0, panelInnerWidth], xBandOpts)
        : createScale(data, spec.aes.x!, xType, [0, panelInnerWidth], xBandOpts);
      applyExpandAndLimits(xScale, xType, xCfg, built.geomPadPx.x);

      const yScale = facet.freeY
        ? createScale(dataCell, spec.aes.y!, yType, [panelInnerHeight, 0])
        : createScale(data, spec.aes.y!, yType, [panelInnerHeight, 0]);
      applyExpandAndLimits(yScale, yType, yCfg, built.geomPadPx.y);

      // Per-cell layer bindings
      let cellLayerData = spec.layers.map(layer => {
        if (dataCell.length === 0) return [];
        const layerAes = layer.aes ?? layer.geom.aes;
        const mergedAes = mergeAes(spec.aes, layerAes);
        const cellRows = applyLayerFilter(dataCell, layer.geom, mergedAes, spec.scales);
        const layerBoundCell = bindData(cellRows, mergedAes);
        if (spec.aes.size) {
          const facetSizeScale = createSizeScale(data, spec.aes.size);
          for (const bp of layerBoundCell) {
            if (bp.size != null) bp.size = facetSizeScale(Number(bp.size));
          }
        }
        return layerBoundCell;
      });
      cellLayerData = applyHighlightToBindings(cellLayerData, spec);

      renderPanel({
        panelG, svg, innerWidth: panelInnerWidth, innerHeight: panelInnerHeight,
        xScale, yScale, theme, colorScale: scales.color, colorScaleBase: scales.colorBase,
        geoms: spec.layers.map(l => l.geom), layerData: cellLayerData,
        clipSuffix: `facet-${r}-${c}`,
        xLabelFormat: xCfg.labels,
        yLabelFormat: yCfg.labels,
        format: spec.format,
        xDateFormat: xCfg.dateLabels,
        yDateFormat: yCfg.dateLabels,
      });
    }
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

  if (spec.xLabel) {
    g.append('text')
      .attr('class', 'ggpbi-axis-label-x')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + theme.margin.bottom - theme.axisTitleMargin)
      .attr('text-anchor', 'middle')
      .attr('font-size', `${theme.axisTitleSize}px`)
      .attr('fill', theme.ink)
      .text(spec.xLabel);
  }

  if (spec.yLabel) {
    g.append('text')
      .attr('class', 'ggpbi-axis-label-y')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -layout.margin.left + theme.axisTitleSize + theme.axisTitleMargin)
      .attr('text-anchor', 'middle')
      .attr('font-size', `${theme.axisTitleSize}px`)
      .attr('fill', theme.ink)
      .text(spec.yLabel);
  }

  const showLegend = spec.showLegend !== false;
  if (showLegend && legend.entries.length > 0 && spec.aes.color) {
    renderLegend(g, legend.entries, spec.aes.color, spec.layers.map(l => l.geom), theme, innerWidth);
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
