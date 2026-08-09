import type { ThemeConfig } from './theme';

// Core types for Grammar of Graphics

/**
 * Raw data point - key-value pairs
 */
export type DataPoint = Record<string, any>;

/**
 * Aesthetic mappings - which data columns map to visual properties
 */
export interface AesMapping {
  x?: string;
  y?: string;
  /** Per-layer y mappings (override global y for multi-measure) */
  y1?: string;
  y2?: string;
  color?: string;
  size?: string;
  shape?: string;
  alpha?: string;
  fill?: string;
  label?: string;
  /** Weight variable for stat_count (weighted sums instead of counts) */
  weight?: string;
  /** Explicit grouping variable (for stacking/line grouping) */
  group?: string;
  /** Segment end x (geom_segment). */
  xend?: string;
  /** Segment end y (geom_segment). */
  yend?: string;
  /** Range lower x (geom_pointrange, horizontal). */
  xmin?: string;
  /** Range upper x (geom_pointrange, horizontal). */
  xmax?: string;
  /** Range lower y (geom_pointrange). */
  ymin?: string;
  /** Range upper y (geom_pointrange). */
  ymax?: string;
  /** Facet row variable */
  facetRow?: string;
  /** Facet column variable */
  facetCol?: string;
}

/**
 * Scale types for transforming data domain to visual range
 */
export type ScaleType = 'linear' | 'log' | 'sqrt' | 'time' | 'ordinal' | 'category';

/**
 * Tick label format for continuous axes.
 * Like ggplot2: scale_x_continuous(labels = scales::percent)
 * - 'auto': plain numbers with minimal decimals (default)
 * - 'percent': value × 100 with a "%" suffix (0.05 → "5%")
 * - function: custom formatter, receives the break value
 */
export type LabelFormat =
  | 'auto'
  | 'percent'
  | 'compact'
  | 'thousands'
  | 'currency'
  | ((value: number) => string);

/**
 * Extended axis scale config — allows setting type + limits.
 * Like ggplot2: scale_x_continuous(limits = c(0, 100))
 */
export interface AxisScaleConfig {
  type?: ScaleType;
  /** Minimum axis value (overrides data-driven domain) */
  min?: number;
  /** Maximum axis value (overrides data-driven domain) */
  max?: number;
  /** Gap between bands as fraction of step (default 0.1, like ggplot2 width=0.9). Only for ordinal/category. */
  paddingInner?: number;
  /** Outer padding as fraction of step (default 0.5, like ggplot2 expansion(add=0.6)). Only for ordinal/category. */
  paddingOuter?: number;
  /** Tick label format (ggplot2 labels=). Only for continuous scales. Default: 'auto'. */
  labels?: LabelFormat;
  /**
   * Granularity for a time axis: 'auto' follows the tick spacing (what d3
   * would pick), the named formats pin it. Month names always come from
   * the locale.
   */
  dateLabels?: 'auto' | 'year' | 'monthYear' | 'monthDay' | 'date' | 'dateTime';
}

export interface ScaleConfig {
  /** Scale type or extended config with limits. E.g. 'log' or { type: 'log', min: 1 } */
  x?: ScaleType | AxisScaleConfig;
  /** Scale type or extended config with limits. E.g. 'linear' or { min: 0, max: 100 } */
  y?: ScaleType | AxisScaleConfig;
  color?: string; // D3 color scheme name
  size?: [number, number]; // [min, max]
}

/**
 * Geometry type - what visual marks to draw
 */
export type GeomType = 'point' | 'line' | 'bar' | 'col' | 'area' | 'text' | 'boxplot' | 'histogram' | 'smooth' | 'density' | 'violin' | 'hline' | 'vline' | 'abline' | 'segment' | 'pointrange';

export type PositionType = 'identity' | 'stack' | 'dodge' | 'dodge2' | 'fill' | 'jitter';

/**
 * Statistical transformation type.
 *
 * Like ggplot2: stat_identity(), stat_count(), stat_boxplot().
 * - 'identity': pass data through unchanged (default)
 * - 'count': aggregate by counting observations per group
 * - 'boxplot': compute median, quartiles, whiskers, outliers
 */
export type StatType = 'identity' | 'sum' | 'count' | 'boxplot' | 'bin' | 'smooth' | 'density';
export type LinetypeType = 'solid' | 'dashed' | 'dotted' | 'dashdot' | 'longdash' | 'twodash';

/**
 * Point shape types — matches ggplot2 pch values.
 *
 * Filled (colour only):     circle, square, triangle, diamond
 * Open (border only):       circleOpen, squareOpen, triangleOpen, diamondOpen
 * Fill + Border (two-tone): circleFilled, squareFilled, triangleFilled, diamondFilled
 * Line (stroke only):       plus, cross, asterisk, star
 */
export type ShapeType =
  | 'circle' | 'square' | 'triangle' | 'diamond'
  | 'circleOpen' | 'squareOpen' | 'triangleOpen' | 'diamondOpen'
  | 'circleFilled' | 'squareFilled' | 'triangleFilled' | 'diamondFilled'
  | 'plus' | 'cross' | 'asterisk' | 'star';

// ---------------------------------------------------------------------------
// GeomConfig — discriminated union with shared base
// ---------------------------------------------------------------------------

/** Shared options available on every geom type. */
export interface BaseGeomConfig {
  alpha?: number;
  size?: number;
  color?: string;
  /** Per-layer aesthetic overrides (ggplot2: layer-local aes). */
  aes?: Partial<AesMapping>;
  /** Stacking/dodging position adjustment */
  position?: PositionType;
  /** Line/border dash style */
  linetype?: LinetypeType;
  /** Bar/box width as fraction of bandwidth. */
  width?: number;
  /** Outline/border colour (ggplot2 `colour`). */
  stroke?: string;
  /** Outline/border width in px (ggplot2 `linewidth`/`stroke`). */
  strokeWidth?: number;
  /** Remove NA values silently (ggplot2 na.rm). Default: false. */
  naRm?: boolean;
  /** Statistical transformation. Default: 'identity'. */
  stat?: StatType;
  /**
   * Whether plot-level highlighting (`.highlight()` / the Highlight card)
   * applies to this layer. Default: true. Set false to exempt the layer —
   * it keeps its full colours (and, for text layers, all its labels).
   */
  highlight?: boolean;
  /**
   * Per-layer row filter (ggplot2's layer-local `data = subset(...)`).
   * - a function keeps the rows it returns true for
   * - 'min' / 'max' keep, per discrete-axis group, the row with the
   *   lowest / highest value on the continuous axis
   * - 'extremes' keeps both — the two ends of a dumbbell in one layer
   * Scales and stats still train on the full data; only this layer's
   * marks are restricted. Default: no filter.
   */
  filter?: ((d: DataPoint) => boolean) | 'min' | 'max' | 'extremes';
  /** SVG stroke-linecap (ggplot2 lineend). Default: 'butt'. */
  lineend?: 'butt' | 'round' | 'square';
  /** SVG stroke-linejoin (ggplot2 linejoin). Default: varies by geom. */
  linejoin?: 'round' | 'miter' | 'bevel';
  /** SVG stroke-miterlimit (ggplot2 linemitre). Default: 10. */
  linemitre?: number;
}

/** Point-specific options. */
export interface PointGeomConfig extends BaseGeomConfig {
  type: 'point';
  /** Point shape */
  shape?: ShapeType;
  /** Fill colour for two-tone shapes (ggplot2 shapes 21–25). Default: '#FFFFFF'. */
  fill?: string;
  /** Jitter width — proportion of bandwidth or pixel offset. Default: 0.4. */
  jitterWidth?: number;
  /** Jitter height — pixel offset for y. Default: 0. */
  jitterHeight?: number;
}

/** Line-specific options. */
export interface LineGeomConfig extends BaseGeomConfig {
  type: 'line';
  /** Show arrowhead on line end. Default: false. */
  arrowShow?: boolean;
  /** Arrowhead angle in degrees. Default: 30. */
  arrowAngle?: number;
  /** Arrowhead length in px. Default: 8. */
  arrowLength?: number;
  /** Which end(s) get arrow: 'first', 'last', 'both'. Default: 'last'. */
  arrowEnds?: 'first' | 'last' | 'both';
  /** Arrow type: 'open' or 'closed'. Default: 'open'. */
  arrowType?: 'open' | 'closed';
  /** Arrow fill colour (for closed arrows). Default: same as line colour. */
  arrowFill?: string;
}

/** Bar-specific options. */
export interface BarGeomConfig extends BaseGeomConfig {
  type: 'bar';
  /** Fill colour. */
  fill?: string;
  /** Bar justification: 0=left, 0.5=center, 1=right. Default: 0.5. */
  just?: number;
  /** Orientation: 'x' = vertical (default), 'y' = horizontal. */
  orientation?: 'x' | 'y';
}

/** Col-specific options (like bar but always stat='identity'). */
export interface ColGeomConfig extends BaseGeomConfig {
  type: 'col';
  /** Fill colour. */
  fill?: string;
  /** Bar justification: 0=left, 0.5=center, 1=right. Default: 0.5. */
  just?: number;
  /** Orientation: 'x' = vertical (default), 'y' = horizontal. */
  orientation?: 'x' | 'y';
}

/** Area-specific options. */
export interface AreaGeomConfig extends BaseGeomConfig {
  type: 'area';
}

/** Text-specific options. */
export interface TextGeomConfig extends BaseGeomConfig {
  type: 'text';
  textAnchor?: 'start' | 'middle' | 'end';
  angle?: number;
  fontFamily?: string;
  dy?: string;
  /**
   * Horizontal justification (ggplot2 `hjust = "inward"`): labels left of
   * the panel centre anchor at their start, labels right of it at their
   * end — text never protrudes past the panel sides. Overrides textAnchor.
   */
  hjust?: 'inward';
  /**
   * Vertical justification (ggplot2 `vjust = "inward"`): labels in the
   * upper half go below their point, lower half above — text never
   * protrudes past the panel top/bottom. Overrides dy.
   */
  vjust?: 'inward';
  /**
   * Hide labels that would overlap an earlier label (ggplot2
   * `check_overlap`). First label in data order wins. Default: false.
   */
  checkOverlap?: boolean;
  /**
   * Labels find their own non-overlapping positions, like R's ggrepel
   * (`geom_text_repel`): a deterministic force layout pushes labels away
   * from each other and from data points, a spring pulls each label back
   * to its point, and labels that had to move far get a thin connector
   * line. Supersedes hjust/vjust/checkOverlap/dy. Default: false.
   */
  repel?: boolean;
  /**
   * Template for the label text. `{label}`, `{x}` and `{y}` are replaced
   * with the row's bound values; a d3-format spec after a colon formats
   * numeric values, e.g. '{label} {x:.1%}' → "SPAR 8.5%". Default: the
   * label aesthetic as-is.
   */
  labelTemplate?: string;
}

/** Boxplot-specific options. Matches ggplot2 geom_boxplot() / stat_boxplot(). */
export interface BoxplotGeomConfig extends BaseGeomConfig {
  type: 'boxplot';
  /** Whisker length as IQR multiplier (ggplot2 `coef`). Default: 1.5. Infinity = full range. */
  boxCoef?: number;
  /** Show notched box (ggplot2 `notch`). Default: false. */
  boxNotch?: boolean;
  /** Notch width relative to box width (ggplot2 `notchwidth`). Default: 0.5. */
  boxNotchWidth?: number;
  /** Box width proportional to sqrt(n) (ggplot2 `varwidth`). Default: false. */
  boxVarWidth?: boolean;
  /** Whisker cap width relative to box width (ggplot2 `staplewidth`). Default: 0 (no caps). */
  boxStapleWidth?: number;
  /** Median line thickness multiplier (ggplot2 `fatten`). Default: 2. */
  boxFatten?: number;
  boxBorderColor?: string;
  boxBorderLineStyle?: LinetypeType;
  boxBorderLineWidth?: number;
  boxWhiskerColor?: string;
  boxWhiskerLineStyle?: LinetypeType;
  boxWhiskerLineWidth?: number;
  boxStapleColor?: string;
  boxStapleLineStyle?: LinetypeType;
  boxStapleLineWidth?: number;
  boxMedianColor?: string;
  boxMedianLineStyle?: LinetypeType;
  boxMedianLineWidth?: number;
  /** Show outlier points (ggplot2 `outliers`). Default: true. */
  boxOutlierShow?: boolean;
  boxOutlierColor?: string;
  boxOutlierFill?: string;
  boxOutlierShape?: ShapeType;
  boxOutlierSize?: number;
  boxOutlierStroke?: number;
  boxOutlierAlpha?: number;
}

/** Histogram-specific options. Matches ggplot2 geom_histogram() / stat_bin(). */
export interface HistogramGeomConfig extends BaseGeomConfig {
  type: 'histogram';
  /** Fill colour. */
  fill?: string;
  /** Bar justification: 0=left, 0.5=center, 1=right. Default: 0.5. */
  just?: number;
  /** Orientation: 'x' = vertical (default), 'y' = horizontal. */
  orientation?: 'x' | 'y';
  /** Number of bins. Default: 30. Overridden by binwidth. */
  bins?: number;
  /** Bin width (in data units). Overrides bins when set. */
  binwidth?: number;
  /** Explicit bin breaks (array of break values). Overrides bins and binwidth. */
  breaks?: number[];
  /** Center of one bin (determines break alignment). Mutually exclusive with boundary. */
  center?: number;
  /** Boundary between two bins (determines break alignment). Mutually exclusive with center. */
  boundary?: number;
  /** Which side of the bin interval is closed: 'right' = (a,b], 'left' = [a,b). Default: 'right'. */
  closed?: 'right' | 'left';
  /** Pad with zero-count bins at range boundaries. Default: false. */
  pad?: boolean;
  /** Empty-bin handling. Default: 'none'. */
  drop?: 'none' | 'all' | 'extremes';
  /** Computed variable mapped to the Y axis. Default: 'count'. */
  yAxis?: 'count' | 'density' | 'ncount' | 'ndensity';
}

/** Smooth method types. */
export type SmoothMethod = 'auto' | 'loess' | 'lm' | 'movingAverage';

/** Smooth-specific options. Matches ggplot2 geom_smooth() / stat_smooth(). */
export interface SmoothGeomConfig extends BaseGeomConfig {
  type: 'smooth';
  /** Smoothing method. Default: 'auto' (loess < 1000 obs, lm >= 1000). */
  method?: SmoothMethod;
  /** Show confidence band (ggplot2 `se`). Default: true. */
  se?: boolean;
  /** Confidence level (ggplot2 `level`). Default: 0.95. */
  level?: number;
  /** Loess span parameter (0–1). Default: 0.75. */
  span?: number;
  /** Number of evaluation points. Default: 80. */
  n?: number;
  /** Extend smooth to full x range. Default: false. */
  fullrange?: boolean;
  /** Fill colour for confidence band. */
  fill?: string;
  /** Band opacity (ggplot2 alpha=0.4). Default: 0.4. */
  fillAlpha?: number;
  /** Line width (ggplot2: 2x base = 1.0mm). Default: 2. */
  lineWidth?: number;
  /** Moving average window size (only for movingAverage method). Default: 5. */
  window?: number;
}

/** Density-specific options. Matches ggplot2 geom_density() / stat_density(). */
export interface DensityGeomConfig extends BaseGeomConfig {
  type: 'density';
  /** Fixed kernel bandwidth (ggplot2 `bw`). Default: Silverman's rule (R bw.nrd0). */
  bw?: number;
  /** Bandwidth multiplier (ggplot2 `adjust`) — 0.5 = wigglier, 2 = smoother. Default: 1. */
  adjust?: number;
  /** Number of evaluation points (ggplot2 `n`). Default: 512. */
  n?: number;
  /** Restrict the curve to the data range (ggplot2 `trim`). Default: false. */
  trim?: boolean;
  /**
   * Fill under the curve. `true` uses the line/group colour,
   * a string sets an explicit colour. Default: no fill (like ggplot2).
   */
  fill?: string | boolean;
  /** Fill opacity when `fill` is enabled (ggplot2 `alpha` on fills). Default: 0.3. */
  fillAlpha?: number;
}

/** Violin-specific options. Matches ggplot2 geom_violin() / stat_ydensity(). */
export interface ViolinGeomConfig extends BaseGeomConfig {
  type: 'violin';
  /** Fixed kernel bandwidth (ggplot2 `bw`). Default: Silverman's rule per group. */
  bw?: number;
  /** Bandwidth multiplier (ggplot2 `adjust`). Default: 1. */
  adjust?: number;
  /** Number of evaluation points along y (ggplot2 `n`). Default: 512. */
  n?: number;
  /** Clip each violin to its group's data range (ggplot2 `trim`). Default: true. */
  trim?: boolean;
  /**
   * Width scaling across violins (ggplot2 `scale`):
   * 'area' = equal areas (default), 'count' = area ∝ observations,
   * 'width' = every violin spans the full width.
   */
  violinScale?: 'area' | 'count' | 'width';
  /** Fill colour when no colour aesthetic is mapped. Default: '#FFFFFF'. */
  fill?: string;
}

/**
 * Horizontal reference line(s). Matches ggplot2 geom_hline().
 *
 * Drawn across the full panel width at fixed data-space y position(s).
 * Does not affect scale training; lines outside the y domain are clipped.
 */
export interface HlineGeomConfig extends BaseGeomConfig {
  type: 'hline';
  /** Data-space y position(s) of the line(s) (ggplot2 `yintercept`). */
  yintercept: number | number[];
}

/**
 * Vertical reference line(s). Matches ggplot2 geom_vline().
 *
 * Drawn across the full panel height at fixed data-space x position(s).
 * Accepts Date values on time axes.
 */
export interface VlineGeomConfig extends BaseGeomConfig {
  type: 'vline';
  /** Data-space x position(s) of the line(s) (ggplot2 `xintercept`). */
  xintercept: number | Date | Array<number | Date>;
}

/**
 * Diagonal reference line y = intercept + slope · x. Matches ggplot2 geom_abline().
 *
 * Requires continuous x and y scales (no-op on band scales).
 */
export interface AblineGeomConfig extends BaseGeomConfig {
  type: 'abline';
  /** Slope of the line (ggplot2 `slope`). Default: 1. */
  slope?: number;
  /** Y value at x = 0 (ggplot2 `intercept`). Default: 0. */
  intercept?: number;
}

/**
 * Straight segment from (x, y) to (xend, yend). Matches ggplot2 geom_segment().
 *
 * xend/yend come from the aes mapping; a missing end falls back to the
 * start value, so a segment with only xend draws horizontally. Arrow
 * options match geom_line.
 */
export interface SegmentGeomConfig extends BaseGeomConfig {
  type: 'segment';
  /** Show arrowhead on segment end. Default: false. */
  arrowShow?: boolean;
  /** Arrowhead angle in degrees. Default: 30. */
  arrowAngle?: number;
  /** Arrowhead length in px. Default: 8. */
  arrowLength?: number;
  /** Which end(s) get arrow: 'first', 'last', 'both'. Default: 'last'. */
  arrowEnds?: 'first' | 'last' | 'both';
  /** Arrow type: 'open' or 'closed'. Default: 'open'. */
  arrowType?: 'open' | 'closed';
  /** Arrow fill colour (for closed arrows). Default: same as segment colour. */
  arrowFill?: string;
}

/**
 * Point with a value range. Matches ggplot2 geom_pointrange().
 *
 * Vertical when ymin/ymax are mapped, horizontal when xmin/xmax are.
 * `size` sets the line width; the midpoint dot is `size * fatten` like
 * ggplot2's fatten parameter.
 */
export interface PointrangeGeomConfig extends BaseGeomConfig {
  type: 'pointrange';
  /** Midpoint dot radius = size * fatten (ggplot2 fatten). Default: 4. */
  fatten?: number;
  /** Midpoint shape. Default: 'circle'. */
  shape?: ShapeType;
  /** Fill colour for two-tone shapes (ggplot2 shapes 21–25). Default: '#FFFFFF'. */
  fill?: string;
}

/**
 * Discriminated union of all geom configs.
 * Discriminant: `type` field.
 *
 * TypeScript narrows the available options based on geom type:
 *   const g: GeomConfig = { type: 'point', shape: 'circle' };  // OK
 *   const g: GeomConfig = { type: 'line', shape: 'circle' };   // ERROR — shape not on LineGeomConfig
 */
export type GeomConfig =
  | PointGeomConfig
  | LineGeomConfig
  | BarGeomConfig
  | ColGeomConfig
  | AreaGeomConfig
  | TextGeomConfig
  | BoxplotGeomConfig
  | HistogramGeomConfig
  | SmoothGeomConfig
  | DensityGeomConfig
  | ViolinGeomConfig
  | HlineGeomConfig
  | VlineGeomConfig
  | AblineGeomConfig
  | SegmentGeomConfig
  | PointrangeGeomConfig;

/**
 * Helper: extract the config type for a specific geom.
 *   GeomConfigFor<'point'> → PointGeomConfig
 */
export type GeomConfigFor<T extends GeomType> = Extract<GeomConfig, { type: T }>;

/**
 * Tooltip configuration
 */
export interface TooltipConfig {
  /**
   * Enable/disable tooltips
   * Default: true
   */
  enabled?: boolean;

  /**
   * Fields to show in tooltip
   * If not specified, shows all aesthetic mappings
   */
  fields?: string[];

  /**
   * Custom tooltip formatter
   * @param point - The data point
   * @returns HTML string for tooltip content
   */
  format?: (point: DataPoint) => string;
}

/**
 * Drill-down configuration
 */
export interface DrilldownConfig {
  /** Enable/disable drill-down. Default: true */
  enabled?: boolean;

  /** Double-click callback with the underlying datum */
  onDrill?: (datum: DataPoint) => void;
}

/**
 * Faceting configuration (small multiples)
 */
export interface FacetConfig {
  /**
   * Facet by a categorical field into rows.
   * Similar to ggplot2: facet_grid(rows ~ .)
   */
  row?: string;

  /**
   * Facet by a categorical field into columns.
   * Similar to ggplot2: facet_grid(. ~ cols)
   */
  col?: string;

  /**
   * Wrap a single categorical field into a roughly square grid.
   * Similar to ggplot2: facet_wrap(~ field).
   * Takes precedence over row/col when set.
   */
  wrap?: string;

  /**
   * Number of grid columns for wrap. Default: ceil(sqrt(levels)),
   * like ggplot2's facet_wrap.
   */
  ncol?: number;

  /**
   * Number of grid rows for wrap (used when ncol is not set).
   */
  nrow?: number;

  /**
   * If true, each facet gets its own y scale domain.
   * Default: false (shared scales)
   */
  freeY?: boolean;

  /**
   * If true, each facet gets its own x scale domain.
   * Default: false (shared scales)
   */
  freeX?: boolean;
}

export interface SelectionConfig {
  /**
   * Enable/disable selection
   * Default: true
   */
  enabled?: boolean;

  /**
   * Selection mode
   * - single: only one item can be selected at a time
   * - multi: multiple items (shift+click)
   * Default: multi
   */
  mode?: 'single' | 'multi';

  /**
   * Stable key extractor for selection identity.
   * Useful when data objects are re-created between renders.
   *
   * Default: uses the datum object reference.
   */
  key?: (datum: DataPoint) => any;

  /**
   * Callback when selection changes
   * @param selected - Array of selected data points
   */
  onSelectionChange?: (selected: DataPoint[]) => void;

  /**
   * Power BI SelectionManager for cross-filtering.
   * When set, clicks call selectionManager.select() / clear()
   * to participate in Power BI cross-visual filtering.
   */
  selectionManager?: any;

  /**
   * Visual styling for selected points
   */
  selectedStyle?: {
    strokeWidth?: number;
    stroke?: string;
    opacity?: number;
  };

  /**
   * Visual styling for unselected points (when some are selected)
   */
  unselectedStyle?: {
    opacity?: number;
  };
}

/**
 * Data-driven highlighting, like R's gghighlight package.
 *
 * Rows (or, when a colour aesthetic is mapped, whole groups) matching the
 * predicate keep their colours; everything else is drawn in a muted grey,
 * underneath the highlighted marks, and drops out of the legend.
 */
export interface HighlightConfig {
  /**
   * Predicate over data rows. With a colour aesthetic, a GROUP is
   * highlighted when any of its rows passes (like gghighlight's
   * per-group evaluation); without one, each row is judged individually.
   */
  filter: (d: DataPoint) => boolean;
  /** Colour for unhighlighted marks (gghighlight `unhighlighted_colour`). Default: '#BEBEBE'. */
  color?: string;
}

/**
 * Optional parameters for plot rendering.
 */
export interface PlotOptions {
  /** Data-driven highlighting (like R's gghighlight). */
  highlight?: HighlightConfig;
  scales?: ScaleConfig;
  theme?: Partial<ThemeConfig>;
  xLabel?: string;
  yLabel?: string;
  /**
   * Sentence above the panel describing what the plot shows, including
   * transformations the visual applied on its own (ggplot2 `subtitle`).
   * - a string sets it explicitly
   * - 'auto' generates one, but only when something is not visible from
   *   the marks alone (auto-picked geom, summing, binning, density)
   * - 'always' generates one unconditionally
   * Default: no subtitle.
   */
  subtitle?: string | 'auto' | 'always';
  /**
   * The host handed over fewer rows than the source holds (Power BI's data
   * reduction). Set this and the plot says so above the panel — regardless
   * of the `subtitle` setting, because a chart drawn from part of the data
   * must never look like a chart drawn from all of it.
   */
  truncation?: { shown: number };
  /**
   * Warn above the panel when a row-counting stat (histogram, count bars,
   * boxplot, density, violin) runs on data where no bound field identifies
   * a row — the state in which Power BI has already collapsed duplicates,
   * so the stat counts distinct values instead of observations.
   * Default: off in the library, on in the Power BI visual.
   */
  warnAggregated?: boolean;
  /**
   * Locale and currency for axis labels. In Power BI these come from the
   * host (`host.locale`), so a German report reads "1.234,5" and "Mär"
   * instead of the JavaScript defaults.
   */
  format?: { locale?: string; currency?: string };
  /**
   * Debug view: overlay the ggpbi code that would produce this chart.
   * An overlay rather than a layout element — inspecting a chart must not
   * resize it.
   */
  showCode?: boolean;
  /**
   * Which language the debug view speaks: the fluent ggpbi chain
   * (default), ggplot2 (R), or ggpbir — the visual's real report-file
   * JSON. All three are editable.
   */
  codeSyntax?: 'ggpbi' | 'ggplot2' | 'ggpbir';
  /**
   * Pre-rendered text for the debug view, overriding the generated code.
   * The ggpbir dialect needs host context (wells, pane state) that a
   * PlotSpec does not carry, so the visual renders it and hands it over.
   */
  codeTextOverride?: string;
  /**
   * Host hooks for editing the code shown by the debug view (Deneb-style).
   * Like `tooltipService`, these are live callbacks, not serializable
   * state: `onApply` receives the edited text and returns an error message
   * or null, after which the host re-renders. Applied edits are durable —
   * there is no reset; deletions write defaults back to the pane.
   */
  codeEdit?: {
    onApply?: (code: string) => string | null;
    edited?: boolean;
    /** Default for the editor's modal (vim) layer; Ctrl+M overrides per session. */
    vimDefault?: boolean;
    /** The header's ✕ — the host persists showCode off. */
    onClose?: () => void;
    /**
     * Dock the editor into this element instead of overlaying the chart —
     * the advanced-edit split view: editor left, chart right.
     */
    dockHost?: HTMLElement;
    /** Display names of the bound well fields, for autocomplete. */
    fields?: string[];
    /** The header's language switch — the host persists the next dialect. */
    onSyntaxChange?: (syntax: 'ggpbi' | 'ggplot2' | 'ggpbir') => void;
    /** The header's vim switch / Ctrl+M — the host persists the state. */
    onVimChange?: (on: boolean) => void;
  };
  /** Display names per aesthetic for the generated subtitle (Power BI field names). */
  fieldLabels?: Partial<Record<'x' | 'y' | 'color' | 'size' | 'facetCol' | 'facetRow', string>>;
  showLegend?: boolean;
  legendPosition?: 'right' | 'bottom' | 'top' | 'left';
  tooltip?: TooltipConfig;
  /**
   * Power BI TooltipService for native tooltips.
   * When set, PBI-native tooltips are used instead of DOM overlay.
   */
  tooltipService?: any;
  selection?: SelectionConfig;
  drilldown?: DrilldownConfig;
  facet?: FacetConfig;
  width?: number;
  height?: number;
}

// ---------------------------------------------------------------------------
// Layer — the Grammar of Graphics composition unit
// ---------------------------------------------------------------------------

/**
 * A Layer in the Grammar of Graphics pipeline.
 *
 * Like ggplot2's layer(): each layer combines a geom (visual mark),
 * an optional stat (data transformation), and optional per-layer aesthetics.
 * Position adjustment is specified on the geom config.
 *
 *   layer({ geom: { type: 'bar' }, stat: 'count', aes: { color: 'region' } })
 */
export interface Layer {
  /** Geom type and visual configuration (type-safe via discriminated union). */
  geom: GeomConfig;
  /** Statistical transformation. Default: inferred from geom (bar→count if no y, else identity). */
  stat?: StatType;
  /** Per-layer aesthetic overrides (ggplot2: layer-local aes()). */
  aes?: Partial<AesMapping>;
}

/**
 * Full plot specification — the Grammar of Graphics pipeline input.
 */
export interface PlotSpec extends PlotOptions {
  data?: DataPoint[];
  aes: AesMapping;
  /** Layers (Grammar of Graphics). Each layer = geom + stat + aes. */
  layers: Layer[];
}
