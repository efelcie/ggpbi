/**
 * FormattingModel Settings — GoG vocabulary for Power BI Format Pane.
 *
 * Layer 1–3: CompositeCards with collapsible groups for native PBI feel.
 * Conditional visibility: slices/groups appear based on geom type selection.
 * Other cards: SimpleCards for scales, legend, theme, histogram, smooth.
 */

import { formattingSettings } from 'powerbi-visuals-utils-formattingmodel';

// --- Geom-type sets for conditional visibility ---

/** Geom types that support point-specific settings (shape, fill, stroke). */
const POINT_GEOMS = new Set(['point', 'pointrange', 'auto']);
/** Geom types that support line-specific settings (cap, join, arrows). */
const LINE_GEOMS = new Set(['line', 'area', 'smooth', 'segment', 'auto']);
/** Geom types that support bar-specific settings (alignment, orientation). */
const BAR_GEOMS = new Set(['bar', 'col', 'histogram', 'auto']);

// --- Layer Card Factory ---

/** Default geom types per layer for a useful out-of-the-box combo. */
const LAYER_DEFAULTS: { type: string; enabled: boolean }[] = [
  { type: 'auto', enabled: true },
  { type: 'line', enabled: false },
  { type: 'point', enabled: false },
];

function createLayerCard(index: number) {
  const def = LAYER_DEFAULTS[index];

  // --- All slice definitions (shared across groups) ---

  const enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Active',
    value: def.enabled,
  });

  const type = new formattingSettings.AutoDropdown({
    name: 'type',
    displayName: 'Type',
    value: def.type,
  });

  const yField = new formattingSettings.AutoDropdown({
    name: 'yField',
    displayName: 'Y field',
    value: 'auto',
  });

  const alpha = new formattingSettings.NumUpDown({
    name: 'alpha',
    displayName: 'Transparency',
    value: 0.85,
    options: {
      minValue: { value: 0, type: 0 as const },
      maxValue: { value: 1, type: 1 as const },
    },
  });

  const size = new formattingSettings.NumUpDown({
    name: 'size',
    displayName: 'Size',
    value: 4,
    options: {
      minValue: { value: 1, type: 0 as const },
      maxValue: { value: 40, type: 1 as const },
    },
  });

  const fill = new formattingSettings.ColorPicker({
    name: 'fill',
    displayName: 'Color',
    value: { value: '' },
  });

  const lineStyle = new formattingSettings.AutoDropdown({
    name: 'lineStyle',
    displayName: 'Line type',
    value: 'solid',
  });

  const position = new formattingSettings.AutoDropdown({
    name: 'position',
    displayName: 'Position',
    value: 'identity',
  });

  const orientation = new formattingSettings.AutoDropdown({
    name: 'orientation',
    displayName: 'Orientation',
    value: 'x',
  });

  const just = new formattingSettings.NumUpDown({
    name: 'just',
    displayName: 'Bar alignment',
    value: 0.5,
    options: {
      minValue: { value: 0, type: 0 as const },
      maxValue: { value: 1, type: 1 as const },
    },
  });

  // --- Point group slices ---

  const shape = new formattingSettings.AutoDropdown({
    name: 'shape',
    displayName: 'Shape',
    value: 'circle',
  });

  const pointFill = new formattingSettings.ColorPicker({
    name: 'pointFill',
    displayName: 'Fill color (shapes 21-25)',
    value: { value: '' },
  });

  const strokeWidth = new formattingSettings.NumUpDown({
    name: 'strokeWidth',
    displayName: 'Stroke width',
    value: 0.5,
    options: {
      minValue: { value: 0, type: 0 as const },
      maxValue: { value: 10, type: 1 as const },
    },
  });

  // --- Jitter slices (visible when position = jitter) ---

  const jitterWidth = new formattingSettings.NumUpDown({
    name: 'jitterWidth',
    displayName: 'Jitter width',
    value: 0.4,
    options: {
      minValue: { value: 0, type: 0 as const },
      maxValue: { value: 2, type: 1 as const },
    },
  });

  const jitterHeight = new formattingSettings.NumUpDown({
    name: 'jitterHeight',
    displayName: 'Jitter height',
    value: 0,
    options: {
      minValue: { value: 0, type: 0 as const },
      maxValue: { value: 2, type: 1 as const },
    },
  });

  // --- Line group slices ---

  const repel = new formattingSettings.ToggleSwitch({
    name: 'repel',
    displayName: 'Repel labels',
    value: false,
  });

  const applyHighlight = new formattingSettings.ToggleSwitch({
    name: 'applyHighlight',
    displayName: 'Apply highlight',
    value: true,
  });

  const layerFilter = new formattingSettings.AutoDropdown({
    name: 'filter',
    displayName: 'Filter rows',
    value: 'none',
  });

  const labelTemplate = new formattingSettings.TextInput({
    name: 'labelTemplate',
    displayName: 'Label template',
    value: '',
    placeholder: 'e.g. {label} {x:.1%}',
  });

  const lineEnd = new formattingSettings.AutoDropdown({
    name: 'lineEnd',
    displayName: 'Line cap',
    value: 'butt',
  });

  const lineJoin = new formattingSettings.AutoDropdown({
    name: 'lineJoin',
    displayName: 'Line join',
    value: 'round',
  });

  const arrowShow = new formattingSettings.ToggleSwitch({
    name: 'arrowShow',
    displayName: 'Show arrow',
    value: false,
  });

  const arrowEnds = new formattingSettings.AutoDropdown({
    name: 'arrowEnds',
    displayName: 'Arrow position',
    value: 'last',
  });

  const arrowType = new formattingSettings.AutoDropdown({
    name: 'arrowType',
    displayName: 'Arrow type',
    value: 'open',
  });

  const arrowLength = new formattingSettings.NumUpDown({
    name: 'arrowLength',
    displayName: 'Arrow length',
    value: 8,
    options: {
      minValue: { value: 2, type: 0 as const },
      maxValue: { value: 30, type: 1 as const },
    },
  });

  const arrowAngle = new formattingSettings.NumUpDown({
    name: 'arrowAngle',
    displayName: 'Arrow angle',
    value: 30,
    options: {
      minValue: { value: 5, type: 0 as const },
      maxValue: { value: 90, type: 1 as const },
    },
  });

  // --- Build groups ---

  const suffix = index + 1; // 1, 2, 3 — unique per layer

  const generalGroup = new formattingSettings.Group({
    name: `general${suffix}`,
    displayName: 'General',
    slices: [type, yField],
  });

  const appearanceGroup = new formattingSettings.Group({
    name: `appearance${suffix}`,
    displayName: 'Appearance',
    collapsible: true,
    slices: [alpha, size, fill, lineStyle, orientation],
  });

  const pointGroup = new formattingSettings.Group({
    name: `pointSettings${suffix}`,
    displayName: 'Point',
    collapsible: true,
    slices: [shape, pointFill, strokeWidth],
  });

  const positionGroup = new formattingSettings.Group({
    name: `positionSettings${suffix}`,
    displayName: 'Position & Layout',
    collapsible: true,
    slices: [position, just, jitterWidth, jitterHeight, layerFilter, repel, labelTemplate, applyHighlight],
  });

  const lineGroup = new formattingSettings.Group({
    name: `lineSettings${suffix}`,
    displayName: 'Line & Arrow',
    collapsible: true,
    slices: [lineEnd, lineJoin, arrowShow, arrowEnds, arrowType, arrowLength, arrowAngle],
  });

  // --- CompositeCard with onPreProcess for conditional visibility ---

  class LayerCard extends formattingSettings.CompositeCard {
    // Expose slice references for pbi-visual.ts to read values
    enabled = enabled;
    type = type;
    yField = yField;
    alpha = alpha;
    size = size;
    fill = fill;
    lineStyle = lineStyle;
    position = position;
    orientation = orientation;
    just = just;
    shape = shape;
    pointFill = pointFill;
    strokeWidth = strokeWidth;
    jitterWidth = jitterWidth;
    jitterHeight = jitterHeight;
    repel = repel;
    applyHighlight = applyHighlight;
    layerFilter = layerFilter;
    labelTemplate = labelTemplate;
    lineEnd = lineEnd;
    lineJoin = lineJoin;
    arrowShow = arrowShow;
    arrowEnds = arrowEnds;
    arrowType = arrowType;
    arrowLength = arrowLength;
    arrowAngle = arrowAngle;

    name = `layer${index + 1}`;
    displayName = `Layer ${index + 1}`;
    topLevelSlice = this.enabled;

    groups = [generalGroup, appearanceGroup, pointGroup, positionGroup, lineGroup];

    /**
     * Conditional visibility: show/hide groups and slices based on geom type.
     * Called by FormattingSettingsService before building the formatting model.
     *
     * Also propagates the enabled/disabled state to all groups — Power BI's
     * topLevelToggle on CompositeCard does NOT automatically disable groups.
     */
    onPreProcess(): void {
      const isDisabled = !this.enabled.value;
      for (const group of this.groups) {
        group.disabled = isDisabled;
      }

      const geomType = extractEnumValue(this.type.value);

      // Point group: only for point-like geoms
      pointGroup.visible = POINT_GEOMS.has(geomType);

      // Line group: only for line-like geoms
      lineGroup.visible = LINE_GEOMS.has(geomType);

      // Arrow detail slices: only when arrowShow is true
      arrowEnds.visible = LINE_GEOMS.has(geomType) && this.arrowShow.value;
      arrowType.visible = LINE_GEOMS.has(geomType) && this.arrowShow.value;
      arrowLength.visible = LINE_GEOMS.has(geomType) && this.arrowShow.value;
      arrowAngle.visible = LINE_GEOMS.has(geomType) && this.arrowShow.value;

      // Bar alignment: only for bar-like geoms
      just.visible = BAR_GEOMS.has(geomType);

      // Orientation: only for bar-like geoms
      orientation.visible = BAR_GEOMS.has(geomType);

      // Jitter slices: only when position = jitter
      const pos = extractEnumValue(this.position.value);
      jitterWidth.visible = pos === 'jitter';
      jitterHeight.visible = pos === 'jitter';

      // Repel labels and label template: only for text geoms
      repel.visible = geomType === 'text';
      labelTemplate.visible = geomType === 'text';

      // Line style: relevant for line, area, smooth, point (borders)
      lineStyle.visible = LINE_GEOMS.has(geomType) || geomType === 'point';
    }
  }

  return new LayerCard();
}

/** Extract string value from enum/AutoDropdown value (can be string or {value: string}). */
function extractEnumValue(val: any): string {
  return typeof val === 'object' ? val?.value ?? '' : String(val ?? '');
}

/** Exported type for a single layer card instance. */
export type LayerCardInstance = ReturnType<typeof createLayerCard>;

// --- ScaleX Card ---

class ScaleXCard extends formattingSettings.SimpleCard {
  type = new formattingSettings.AutoDropdown({
    name: 'type',
    displayName: 'Scale type',
    value: 'auto',
  });

  label = new formattingSettings.TextInput({
    name: 'label',
    displayName: 'Axis title',
    value: '',
    placeholder: 'e.g. Month',
  });

  labelFormat = new formattingSettings.AutoDropdown({
    name: 'labelFormat',
    displayName: 'Label format',
    value: 'auto',
  });

  // Time axes need their own control: a number format cannot express
  // "Mär 2015", and the granularity a report wants is often coarser than
  // the tick spacing suggests.
  dateFormat = new formattingSettings.AutoDropdown({
    name: 'dateFormat',
    displayName: 'Date format',
    value: 'auto',
  });

  name = 'scaleX';
  displayName = 'X Axis';
  slices: formattingSettings.Slice[] = [this.type, this.label, this.labelFormat, this.dateFormat];
}

// --- ScaleY Card ---

class ScaleYCard extends formattingSettings.SimpleCard {
  type = new formattingSettings.AutoDropdown({
    name: 'type',
    displayName: 'Scale type',
    value: 'auto',
  });

  label = new formattingSettings.TextInput({
    name: 'label',
    displayName: 'Axis title',
    value: '',
    placeholder: 'e.g. Revenue (EUR)',
  });

  labelFormat = new formattingSettings.AutoDropdown({
    name: 'labelFormat',
    displayName: 'Label format',
    value: 'auto',
  });


  dateFormat = new formattingSettings.AutoDropdown({
    name: 'dateFormat',
    displayName: 'Date format',
    value: 'auto',
  });

  name = 'scaleY';
  displayName = 'Y Axis';
  slices: formattingSettings.Slice[] = [this.type, this.label, this.labelFormat, this.dateFormat];
}

// --- Legend Card ---

class LegendCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show legend',
    value: true,
  });

  position = new formattingSettings.AutoDropdown({
    name: 'position',
    displayName: 'Position',
    value: 'right',
  });

  name = 'legend';
  displayName = 'Legend';
  topLevelSlice = this.show;
  slices: formattingSettings.Slice[] = [this.position];
}

// --- Theme Card ---

class ThemeCard extends formattingSettings.SimpleCard {
  subtitle = new formattingSettings.AutoDropdown({
    name: 'subtitle',
    displayName: 'Describe the chart',
    value: 'auto',
  });

  // Defaults to on: a silently miscounted chart is worse than a notice
  // someone has to switch off once. Deliberately aggregated data is a
  // legitimate case, hence the switch.
  warnAggregated = new formattingSettings.ToggleSwitch({
    name: 'warnAggregated',
    displayName: 'Warn about aggregated rows',
    value: true,
  });

  // Debug aid, off by default: it overlays the chart, so it is something
  // you switch on to look at, not a display setting.
  showCode = new formattingSettings.ToggleSwitch({
    name: 'showCode',
    displayName: 'Show ggpbi code (debug)',
    value: false,
  });

  // ISO 4217 rather than a symbol: Intl places the symbol and spacing
  // the way the report locale expects, which "€" alone cannot express.
  currency = new formattingSettings.TextInput({
    name: 'currency',
    displayName: 'Currency code',
    value: 'EUR',
    placeholder: 'EUR, USD, CHF …',
  });

  preset = new formattingSettings.AutoDropdown({
    name: 'preset',
    displayName: 'Preset',
    value: 'grey',
  });

  panelFill = new formattingSettings.ColorPicker({
    name: 'panelFill',
    displayName: 'Background',
    value: { value: '#EBEBEB' },
  });

  gridlineColor = new formattingSettings.ColorPicker({
    name: 'gridlineColor',
    displayName: 'Grid color',
    value: { value: '#ffffff' },
  });

  ink = new formattingSettings.ColorPicker({
    name: 'ink',
    displayName: 'Text color',
    value: { value: '#333333' },
  });

  paper = new formattingSettings.ColorPicker({
    name: 'paper',
    displayName: 'Paper color',
    value: { value: '#ffffff' },
  });

  baseSize = new formattingSettings.NumUpDown({
    name: 'baseSize',
    displayName: 'Font size',
    value: 11,
    options: {
      minValue: { value: 6, type: 0 as const },
      maxValue: { value: 24, type: 1 as const },
    },
  });

  name = 'theme';
  displayName = 'Theme';
  slices: formattingSettings.Slice[] = [
    this.subtitle,
    this.warnAggregated,
    this.showCode,
    this.currency,
    this.preset,
    this.panelFill,
    this.gridlineColor,
    this.ink,
    this.paper,
    this.baseSize,
  ];
}

// --- Boxplot Card ---
// Conditional visibility: notchWidth only when notch=true,
// outlier settings only when outlierShow=true.

class BoxplotCard extends formattingSettings.CompositeCard {
  coef = new formattingSettings.NumUpDown({
    name: 'coef',
    displayName: 'Whisker length (IQR ×)',
    value: 1.5,
    options: {
      minValue: { value: 0, type: 0 as const },
      maxValue: { value: 100, type: 1 as const },
    },
  });

  notch = new formattingSettings.ToggleSwitch({
    name: 'notch',
    displayName: 'Notch',
    value: false,
  });

  notchWidth = new formattingSettings.NumUpDown({
    name: 'notchWidth',
    displayName: 'Notch width',
    value: 0.5,
    options: {
      minValue: { value: 0.1, type: 0 as const },
      maxValue: { value: 1, type: 1 as const },
    },
  });

  varWidth = new formattingSettings.ToggleSwitch({
    name: 'varWidth',
    displayName: 'Variable width (√n)',
    value: false,
  });

  stapleWidth = new formattingSettings.NumUpDown({
    name: 'stapleWidth',
    displayName: 'Staple width',
    value: 0,
    options: {
      minValue: { value: 0, type: 0 as const },
      maxValue: { value: 1, type: 1 as const },
    },
  });

  fatten = new formattingSettings.NumUpDown({
    name: 'fatten',
    displayName: 'Median line thickness (×)',
    value: 2,
    options: {
      minValue: { value: 0.5, type: 0 as const },
      maxValue: { value: 10, type: 1 as const },
    },
  });

  boxWidth = new formattingSettings.NumUpDown({
    name: 'boxWidth',
    displayName: 'Box width',
    value: 0.9,
    options: {
      minValue: { value: 0.1, type: 0 as const },
      maxValue: { value: 1, type: 1 as const },
    },
  });

  boxFillColor = new formattingSettings.ColorPicker({
    name: 'boxFillColor',
    displayName: 'Fill color',
    value: { value: '' },
  });

  outlierShow = new formattingSettings.ToggleSwitch({
    name: 'outlierShow',
    displayName: 'Show outliers',
    value: true,
  });

  outlierSize = new formattingSettings.NumUpDown({
    name: 'outlierSize',
    displayName: 'Outlier size',
    value: 1.5,
    options: {
      minValue: { value: 0.5, type: 0 as const },
      maxValue: { value: 10, type: 1 as const },
    },
  });

  outlierShape = new formattingSettings.AutoDropdown({
    name: 'outlierShape',
    displayName: 'Outlier shape',
    value: 'circle',
  });

  appearanceGroup = new formattingSettings.Group({
    name: 'appearance',
    displayName: 'Style',
    slices: [this.boxFillColor, this.boxWidth, this.fatten],
  });

  outlierGroup = new formattingSettings.Group({
    name: 'outliers',
    displayName: 'Outliers',
    collapsible: true,
    slices: [this.outlierShow, this.outlierSize, this.outlierShape],
  });

  statisticsGroup = new formattingSettings.Group({
    name: 'statistics',
    displayName: 'Statistics (advanced)',
    collapsible: true,
    slices: [this.coef, this.notch, this.notchWidth, this.varWidth, this.stapleWidth],
  });

  name = 'boxplot';
  displayName = 'Boxplot';
  groups = [this.appearanceGroup, this.outlierGroup, this.statisticsGroup];

  onPreProcess(): void {
    // Notch width only relevant when notch is enabled
    this.notchWidth.visible = this.notch.value;
    // Outlier detail settings only when outliers are shown
    this.outlierSize.visible = this.outlierShow.value;
    this.outlierShape.visible = this.outlierShow.value;
  }
}

// --- Histogram Card ---

class HistogramCard extends formattingSettings.SimpleCard {
  bins = new formattingSettings.NumUpDown({
    name: 'bins',
    displayName: 'Number of bins',
    value: 30,
    options: {
      minValue: { value: 1, type: 0 as const },
      maxValue: { value: 500, type: 1 as const },
    },
  });

  binwidth = new formattingSettings.NumUpDown({
    name: 'binwidth',
    displayName: 'Bin width',
    value: 0,
    options: {
      minValue: { value: 0, type: 0 as const },
      maxValue: { value: 1000000, type: 1 as const },
    },
  });

  boundary = new formattingSettings.NumUpDown({
    name: 'boundary',
    displayName: 'Boundary',
    value: 0,
    options: {
      minValue: { value: -1000000, type: 0 as const },
      maxValue: { value: 1000000, type: 1 as const },
    },
  });

  center = new formattingSettings.NumUpDown({
    name: 'center',
    displayName: 'Center',
    value: 0,
    options: {
      minValue: { value: -1000000, type: 0 as const },
      maxValue: { value: 1000000, type: 1 as const },
    },
  });

  closed = new formattingSettings.AutoDropdown({
    name: 'closed',
    displayName: 'Closed side',
    value: 'right',
  });

  pad = new formattingSettings.ToggleSwitch({
    name: 'pad',
    displayName: 'Pad with empty bins',
    value: false,
  });

  drop = new formattingSettings.AutoDropdown({
    name: 'drop',
    displayName: 'Drop empty bins',
    value: 'none',
  });

  histYAxis = new formattingSettings.AutoDropdown({
    name: 'histYAxis',
    displayName: 'Y-axis statistic',
    value: 'count',
  });

  histFillColor = new formattingSettings.ColorPicker({
    name: 'histFillColor',
    displayName: 'Fill color',
    value: { value: '' },
  });

  histBorderColor = new formattingSettings.ColorPicker({
    name: 'histBorderColor',
    displayName: 'Border color',
    value: { value: '' },
  });

  histBorderWidth = new formattingSettings.NumUpDown({
    name: 'histBorderWidth',
    displayName: 'Border width',
    value: 0.5,
    options: {
      minValue: { value: 0, type: 0 as const },
      maxValue: { value: 10, type: 1 as const },
    },
  });

  histBorderStyle = new formattingSettings.AutoDropdown({
    name: 'histBorderStyle',
    displayName: 'Border line type',
    value: 'solid',
  });

  histTransparency = new formattingSettings.NumUpDown({
    name: 'histTransparency',
    displayName: 'Transparency',
    value: 0,
    options: {
      minValue: { value: 0, type: 0 as const },
      maxValue: { value: 100, type: 1 as const },
    },
  });

  name = 'histogram';
  displayName = 'Histogram';
  slices: formattingSettings.Slice[] = [
    this.bins,
    this.binwidth,
    this.boundary,
    this.center,
    this.closed,
    this.pad,
    this.drop,
    this.histYAxis,
    this.histFillColor,
    this.histBorderColor,
    this.histBorderWidth,
    this.histBorderStyle,
    this.histTransparency,
  ];

  onPreProcess(): void {
    // When binwidth > 0, bins is ignored (binwidth takes priority in ggplot2)
    this.bins.visible = !(this.binwidth.value > 0);
    // Center and boundary are mutually exclusive bin-alignment controls.
    this.boundary.visible = this.center.value === 0;
    this.center.visible = this.boundary.value === 0;
  }
}

// --- Smooth Card ---
// Smooth-specific parameters (ggplot2 geom_smooth / stat_smooth).

class SmoothCard extends formattingSettings.SimpleCard {
  method = new formattingSettings.AutoDropdown({
    name: 'method',
    displayName: 'Method',
    value: 'loess',
  });

  se = new formattingSettings.ToggleSwitch({
    name: 'se',
    displayName: 'Show confidence interval',
    value: true,
  });

  level = new formattingSettings.NumUpDown({
    name: 'level',
    displayName: 'Confidence level',
    value: 0.95,
    options: {
      minValue: { value: 0.5, type: 0 as const },
      maxValue: { value: 0.999, type: 1 as const },
    },
  });

  span = new formattingSettings.NumUpDown({
    name: 'span',
    displayName: 'Span (LOESS)',
    value: 0.75,
    options: {
      minValue: { value: 0.1, type: 0 as const },
      maxValue: { value: 2, type: 1 as const },
    },
  });

  n = new formattingSettings.NumUpDown({
    name: 'n',
    displayName: 'Output points',
    value: 80,
    options: {
      minValue: { value: 10, type: 0 as const },
      maxValue: { value: 500, type: 1 as const },
    },
  });

  fullrange = new formattingSettings.ToggleSwitch({
    name: 'fullrange',
    displayName: 'Full range',
    value: false,
  });

  smoothFillColor = new formattingSettings.ColorPicker({
    name: 'smoothFillColor',
    displayName: 'Ribbon color',
    value: { value: '' },
  });

  fillAlpha = new formattingSettings.NumUpDown({
    name: 'fillAlpha',
    displayName: 'Ribbon opacity',
    value: 0.4,
    options: {
      minValue: { value: 0, type: 0 as const },
      maxValue: { value: 1, type: 1 as const },
    },
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line width',
    value: 1,
    options: {
      minValue: { value: 0.5, type: 0 as const },
      maxValue: { value: 10, type: 1 as const },
    },
  });

  name = 'smooth';
  displayName = 'Smooth';
  slices: formattingSettings.Slice[] = [
    this.method,
    this.se,
    this.level,
    this.span,
    this.n,
    this.fullrange,
    this.smoothFillColor,
    this.fillAlpha,
    this.lineWidth,
  ];

  onPreProcess(): void {
    const m = extractEnumValue(this.method.value);
    // Confidence interval settings only when SE is shown
    this.level.visible = this.se.value;
    this.smoothFillColor.visible = this.se.value;
    this.fillAlpha.visible = this.se.value;
    // Span only relevant for LOESS
    this.span.visible = m === 'loess' || m === '';
  }
}

// --- Highlight Card (gghighlight) ---

class HighlightCard extends formattingSettings.SimpleCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: 'enabled',
    displayName: 'Enabled',
    value: false,
  });

  values = new formattingSettings.TextInput({
    name: 'values',
    displayName: 'Highlight values',
    description: 'Comma-separated values of the Color field to highlight',
    value: '',
    placeholder: 'e.g. North, South',
  });

  color = new formattingSettings.ColorPicker({
    name: 'color',
    displayName: 'Unhighlighted color',
    value: { value: '#BEBEBE' },
  });

  name = 'highlight';
  displayName = 'Highlight';
  topLevelSlice = this.enabled;
  slices = [this.values, this.color];
}

// --- Model ---

/**
 * Shared options for the two kernel-density geoms (density, violin) —
 * one card instead of two nearly identical ones.
 */
class DistributionCard extends formattingSettings.SimpleCard {
  adjust = new formattingSettings.NumUpDown({
    name: 'adjust',
    displayName: 'Smoothing (adjust)',
    value: 1,
    options: {
      minValue: { value: 0.1, type: 0 as const },
      maxValue: { value: 10, type: 1 as const },
    },
  });

  // Density and violin keep separate trim toggles because their ggplot2
  // defaults differ (density off, violin on) — one shared toggle cannot
  // hold both defaults, and forcing the density default onto violins
  // makes their tails poke past the y domain and clip at the panel edge.
  trim = new formattingSettings.ToggleSwitch({
    name: 'trim',
    displayName: 'Trim density to data range',
    value: false,
  });

  violinTrim = new formattingSettings.ToggleSwitch({
    name: 'violinTrim',
    displayName: 'Trim violin to data range',
    value: true,
  });

  densityFill = new formattingSettings.ToggleSwitch({
    name: 'densityFill',
    displayName: 'Fill under curve',
    value: false,
  });

  fillAlpha = new formattingSettings.NumUpDown({
    name: 'fillAlpha',
    displayName: 'Fill transparency',
    value: 0.3,
    options: {
      minValue: { value: 0, type: 0 as const },
      maxValue: { value: 1, type: 1 as const },
    },
  });

  violinScale = new formattingSettings.AutoDropdown({
    name: 'violinScale',
    displayName: 'Violin width scaling',
    value: 'area',
  });

  name = 'distribution';
  displayName = 'Distribution (Density / Violin)';
  slices = [this.adjust, this.trim, this.violinTrim, this.densityFill, this.fillAlpha, this.violinScale];
}

/**
 * Reference lines as an overlay card rather than a layer type: they carry
 * no data, and this way they don't consume one of the three layer slots.
 * Positions accept numbers or the keywords mean/median, resolved against
 * the bound data (the "show the average" business case).
 */
class ReferenceLinesCard extends formattingSettings.SimpleCard {
  show = new formattingSettings.ToggleSwitch({
    name: 'show',
    displayName: 'Show',
    value: false,
  });

  hlineAt = new formattingSettings.TextInput({
    name: 'hlineAt',
    displayName: 'Horizontal line(s) at',
    description: "Y positions: numbers (comma-separated) or 'mean' / 'median'",
    value: '',
    placeholder: 'e.g. mean, 30',
  });

  vlineAt = new formattingSettings.TextInput({
    name: 'vlineAt',
    displayName: 'Vertical line(s) at',
    description: "X positions: numbers (comma-separated) or 'mean' / 'median'",
    value: '',
    placeholder: 'e.g. median',
  });

  lineColor = new formattingSettings.ColorPicker({
    name: 'lineColor',
    displayName: 'Line color',
    value: { value: '#E15759' },
  });

  lineStyle = new formattingSettings.AutoDropdown({
    name: 'lineStyle',
    displayName: 'Line type',
    value: 'dashed',
  });

  lineWidth = new formattingSettings.NumUpDown({
    name: 'lineWidth',
    displayName: 'Line width',
    value: 1,
    options: {
      minValue: { value: 0.5, type: 0 as const },
      maxValue: { value: 10, type: 1 as const },
    },
  });

  name = 'referenceLines';
  displayName = 'Reference Lines';
  topLevelSlice = this.show;
  slices = [this.hlineAt, this.vlineAt, this.lineColor, this.lineStyle, this.lineWidth];
}

/**
 * Facet layout. Power BI has a single Facet well, so the natural
 * translation is ggplot2's facet_wrap (a roughly square grid) rather
 * than facet_grid, which would put every level in one row.
 */
class FacetCard extends formattingSettings.SimpleCard {
  columns = new formattingSettings.NumUpDown({
    name: 'columns',
    displayName: 'Columns',
    value: 0,
    options: {
      minValue: { value: 0, type: 0 as const },
      maxValue: { value: 12, type: 1 as const },
    },
  });

  freeX = new formattingSettings.ToggleSwitch({
    name: 'freeX',
    displayName: 'Free X scale',
    value: false,
  });

  freeY = new formattingSettings.ToggleSwitch({
    name: 'freeY',
    displayName: 'Free Y scale',
    value: false,
  });

  name = 'facet';
  displayName = 'Facets (Small Multiples)';
  slices = [this.columns, this.freeX, this.freeY];
}

export class GgpbiFormattingSettings extends formattingSettings.Model {
  layer1 = createLayerCard(0);
  layer2 = createLayerCard(1);
  layer3 = createLayerCard(2);

  scaleX = new ScaleXCard();
  scaleY = new ScaleYCard();
  legend = new LegendCard();
  theme = new ThemeCard();
  highlight = new HighlightCard();
  boxplot = new BoxplotCard();
  histogram = new HistogramCard();
  smooth = new SmoothCard();
  distribution = new DistributionCard();
  referenceLines = new ReferenceLinesCard();
  facet = new FacetCard();

  cards: (formattingSettings.SimpleCard | formattingSettings.CompositeCard)[] = [
    this.layer1,
    this.layer2,
    this.layer3,
    this.scaleX,
    this.scaleY,
    this.legend,
    this.theme,
    this.highlight,
    this.boxplot,
    this.histogram,
    this.smooth,
    this.distribution,
    this.referenceLines,
    this.facet,
  ];

  /** Helper: iterate over all layer cards. */
  get layers(): LayerCardInstance[] {
    return [this.layer1, this.layer2, this.layer3];
  }

  /**
   * Set contextual visibility of specialized cards based on active layers.
   * Call this after populating settings from DataView.
   */
  updateCardVisibility(): void {
    const activeGeoms = new Set<string>();
    for (const layer of this.layers) {
      if (layer.enabled.value) {
        activeGeoms.add(extractEnumValue(layer.type.value));
      }
    }

    // Show boxplot/histogram/smooth cards only when that geom is active
    // (or when any layer is set to 'auto', since auto could resolve to anything)
    const hasAuto = activeGeoms.has('auto') || activeGeoms.has('');
    this.boxplot.visible = hasAuto || activeGeoms.has('boxplot');
    this.histogram.visible = hasAuto || activeGeoms.has('histogram');
    this.smooth.visible = hasAuto || activeGeoms.has('smooth');
    this.distribution.visible = hasAuto || activeGeoms.has('density') || activeGeoms.has('violin');
  }

  /**
   * Refine the Format Pane once the data has resolved every layer:
   *
   * - Layer card titles show what will actually be drawn — "Layer 1 ·
   *   Auto (Bar)" for the auto choice, "Layer 2 · Line" for explicit
   *   types — so 'Auto' is never a black box.
   * - Specialized cards (Boxplot/Histogram/Smooth) only stay visible for
   *   geoms that are REALLY active after auto resolution, instead of all
   *   three whenever any layer says 'auto'.
   *
   * Call after resolving layers in update(); refines updateCardVisibility.
   */
  applyResolvedGeoms(resolved: Array<{ type: string; auto: boolean } | null>): void {
    this.layers.forEach((card, i) => {
      const r = resolved[i];
      const base = `Layer ${i + 1}`;
      if (!r) {
        card.displayName = base;
        return;
      }
      const label = GEOM_LABELS[r.type] ?? r.type;
      card.displayName = r.auto ? `${base} · Auto (${label})` : `${base} · ${label}`;
    });

    const active = new Set(resolved.filter((r): r is { type: string; auto: boolean } => r != null).map(r => r.type));
    this.boxplot.visible = active.has('boxplot');
    this.histogram.visible = active.has('histogram');
    this.smooth.visible = active.has('smooth');
    this.distribution.visible = active.has('density') || active.has('violin');

    // Density/violin-only slices follow the geoms that use them.
    this.distribution.densityFill.visible = active.has('density');
    this.distribution.fillAlpha.visible = active.has('density');
    this.distribution.violinScale.visible = active.has('violin');
  }
}

/** Display labels for resolved geom types (layer card titles). */
const GEOM_LABELS: Record<string, string> = {
  point: 'Point',
  line: 'Line',
  bar: 'Bar',
  col: 'Column',
  area: 'Area',
  text: 'Text',
  boxplot: 'Boxplot',
  histogram: 'Histogram',
  smooth: 'Smooth',
  density: 'Density',
  violin: 'Violin',
  segment: 'Segment',
  pointrange: 'Point range',
  hline: 'Reference line',
  vline: 'Reference line',
  abline: 'Reference line',
};
