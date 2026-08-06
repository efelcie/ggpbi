/**
 * ggpbi - Grammar of Graphics for Power BI
 *
 * A layered graphics system inspired by ggplot2,
 * built with TypeScript and D3.js.
 */

export {
  DataPoint,
  AesMapping,
  ScaleType,
  ScaleConfig,
  AxisScaleConfig,
  LabelFormat,
  GeomType,
  GeomConfig,
  GeomConfigFor,
  BaseGeomConfig,
  PointGeomConfig,
  LineGeomConfig,
  BarGeomConfig,
  ColGeomConfig,
  AreaGeomConfig,
  TextGeomConfig,
  BoxplotGeomConfig,
  HistogramGeomConfig,
  SmoothGeomConfig,
  DensityGeomConfig,
  ViolinGeomConfig,
  HlineGeomConfig,
  VlineGeomConfig,
  AblineGeomConfig,
  SmoothMethod,
  Layer,
  StatType,
  PositionType,
  LinetypeType,
  ShapeType,
  PlotSpec,
  PlotOptions,
  TooltipConfig,
  SelectionConfig,
  DrilldownConfig,
  FacetConfig,
  HighlightConfig,
} from './types';
export { createScale, inferScaleType } from './scales';
export { extendedBreaks, formatBreaks, formatBreaksAs, precision, minorBreaks } from './breaks';
export {
  formatPlain, formatThousands, formatCompact, formatCurrency, formatPercent,
  formatDates, autoDateFormat, breakDecimals,
  type FormatOptions, type DateFormat,
} from './format';
export { bindData, validateAes, BoundPoint } from './bind-data';
export { computeBoxplotStats, type BoxplotStats } from './geoms';
export { render, renderWithState, type PlotResult, Margin } from './render';
export { fromDataView, getFields, getObjects, DEFAULT_ROLE_MAPPING, type DataView, type ConversionOptions, type GgpbiObjects } from './powerbi';
export { Tooltip } from './tooltip';
export { Selection } from './selection';
export { ThemeConfig, ResolvedTheme, resolveTheme, axisLabelPriority, themeGrey, themeMinimal, themeDark, PBI_DEFAULT_PALETTE } from './theme';
export { renderLegend, estimateLegendWidth, type LegendEntry } from './legend';
export { specToCode, highlight, type CodeToken, type TokenKind } from './codegen';
export { renderCodeView } from './code-view';
export { inferGeom, inferScaleLevel, type ScaleLevel } from './auto-geom';
export { buildPlot, resolveLayerStat, type BuiltPlot, type BuiltLayer, type ScaleSet, type PlotLayout, type LegendInfo } from './pipeline';
export { stats, statCount, statBin, statSmooth, statDensity, DEFAULT_GEOM_STAT, STAT_COUNT_FIELD, STAT_BIN_COUNT, STAT_BIN_DENSITY, STAT_BIN_NCOUNT, STAT_BIN_NDENSITY, STAT_BIN_WIDTH, STAT_BIN_X, STAT_BIN_XMIN, STAT_BIN_XMAX, STAT_SMOOTH_X, STAT_SMOOTH_Y, STAT_SMOOTH_YMIN, STAT_SMOOTH_YMAX, STAT_SMOOTH_SE, STAT_DENSITY_X, STAT_DENSITY_Y, type StatFn, type StatResult, type StatBinParams, type StatSmoothParams, type StatDensityParams } from './stats';
export { computePosition, applyDodge, applyStack, applyFill, type PositionedPoint } from './position';
export { type SceneNode, type RectNode, type PathNode, type LineNode, type TextNode, type GroupNode, type NodeStyle, type AriaAttrs, type MarkerSpec } from './scene-types';
export { renderSceneNodes, applyNodeStyle, applyAria } from './scene-renderer';
export { barsToScene } from './geoms/bar';
export { pointsToScene } from './geoms/point';
export { linesToScene } from './geoms/line';
export { areaToScene } from './geoms/area';
export { textToScene } from './geoms/text';
export { boxplotToScene } from './geoms/boxplot';
export { histogramToScene } from './geoms/histogram';
export { smoothToScene } from './geoms/smooth';
export { densityToScene } from './geoms/density';
export { violinToScene } from './geoms/violin';
export { hlineToScene } from './geoms/hline';
export { vlineToScene } from './geoms/vline';
export { ablineToScene } from './geoms/abline';
export { segmentsToScene } from './geoms/segment';
export { pointrangeToScene } from './geoms/pointrange';
export { sceneBuilders, type SceneBuilder } from './geoms/registry';

import { DataPoint, AesMapping, GeomConfig, GeomType, GeomConfigFor, Layer, PlotOptions, TooltipConfig, SelectionConfig, DrilldownConfig, FacetConfig, HighlightConfig, PlotSpec } from './types';
import { ThemeConfig } from './theme';
import { renderWithState } from './render';

/**
 * Fluent API for building and rendering a chart.
 *
 *   ggpbi()
 *     .data(myData)
 *     .aes({ x: 'date', y: 'sales', color: 'region' })
 *     .geom('point')
 *     .geom('line')
 *     .size(800, 500)
 *     .render(container)
 */
export function ggpbi() {
  return new GGBIBuilder();
}

class GGBIBuilder {
  private _data: DataPoint[] = [];
  private _aes: AesMapping = {};
  private _layers: Layer[] = [];
  private _opts: PlotOptions = {};

  data(d: DataPoint[]): this { this._data = d; return this; }
  aes(m: AesMapping): this { this._aes = { ...this._aes, ...m }; return this; }

  /** Add a layer with a specific geom type and optional visual config. */
  geom<T extends GeomType>(type: T, config?: Partial<Omit<GeomConfigFor<T>, 'type'>>): this {
    this._layers.push({ geom: { type, ...config } as GeomConfig });
    return this;
  }

  /** Add a full layer (GoG: geom + stat + per-layer aes). */
  layer(layer: Layer): this {
    this._layers.push(layer);
    return this;
  }

  scale(c: any): this { this._opts.scales = { ...this._opts.scales, ...c }; return this; }
  tooltip(c: TooltipConfig): this { this._opts.tooltip = { ...this._opts.tooltip, ...c }; return this; }
  selection(c: SelectionConfig): this { this._opts.selection = { ...this._opts.selection, ...c }; return this; }
  drilldown(c: DrilldownConfig): this { this._opts.drilldown = { ...this._opts.drilldown, ...c }; return this; }
  facet(c: FacetConfig): this { this._opts.facet = { ...this._opts.facet, ...c }; return this; }
  theme(c: Partial<ThemeConfig>): this { this._opts.theme = { ...this._opts.theme, ...c }; return this; }
  /** Data-driven highlighting, like R's gghighlight. */
  highlight(c: HighlightConfig): this { this._opts.highlight = c; return this; }
  labels(x?: string, y?: string): this { this._opts.xLabel = x; this._opts.yLabel = y; return this; }
  /**
   * Line above the panel describing what the plot shows (ggplot2 `subtitle`).
   * 'auto' speaks up only when the visual computed something itself
   * (auto-geom, summing, binning, density); 'always' describes every plot.
   */
  subtitle(s: string | 'auto' | 'always'): this { this._opts.subtitle = s; return this; }
  /**
   * Declare that the data is only part of the source (a host row cap).
   * The plot then says so above the panel whatever `subtitle` is set to.
   */
  truncation(shown: number): this { this._opts.truncation = { shown }; return this; }
  /**
   * Locale and currency for axis labels — decimal mark, group separator,
   * compact suffixes and month names. In Power BI this comes from the
   * host; in the browser it defaults to the runtime locale.
   */
  format(f: { locale?: string; currency?: string }): this {
    this._opts.format = { ...this._opts.format, ...f };
    return this;
  }
  /**
   * Debug view: overlay the ggpbi code that would produce this chart.
   * An overlay, so switching it on does not resize the plot.
   */
  showCode(show = true): this { this._opts.showCode = show; return this; }
  legend(show: boolean): this { this._opts.showLegend = show; return this; }
  size(w: number, h: number): this { this._opts.width = w; this._opts.height = h; return this; }

  renderTo(container: HTMLElement): SVGSVGElement {
    // No .geom() required — inferGeom() in render pipeline picks one
    return renderWithState(container, this.spec()).svg;
  }

  /**
   * Returns the current PlotSpec without rendering.
   * Useful for inspecting or serializing the chart configuration.
   */
  spec(): PlotSpec {
    return {
      data: this._data,
      aes: this._aes,
      layers: this._layers,
      ...this._opts,
    };
  }

  render(container: HTMLElement): SVGSVGElement {
    return this.renderTo(container);
  }
}
