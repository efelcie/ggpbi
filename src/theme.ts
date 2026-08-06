/**
 * ggpbi Theme System — based on ggplot2's theme_grey().
 *
 * Core idea: ONE parameter (base_size) drives all proportions.
 * Everything else is derived via relative multipliers, just like ggplot2.
 *
 * ggplot2 reference (theme_grey, base_size = 11):
 *   half_line       = base_size / 2           = 5.5
 *   base_line_size  = base_size / 22          = 0.5
 *   axis text       = rel(0.8) * base_size    = 8.8
 *   plot title      = rel(1.2) * base_size    = 13.2
 *   tick length     = rel(0.5) * half_line    = 2.75
 *   margins         = half_line               = 5.5
 */

export interface ThemeConfig {
  /** Base font size in px (like ggplot2's base_size, default 11). */
  baseSize: number;

  /** Axis label overlap handling: 'hide' (ggplot2 check.overlap) or 'rotate'. */
  axisTextOverlap: 'hide' | 'rotate' | 'none';

  /** Number of dodge rows for x-axis labels (ggplot2 n.dodge). Default 1. */
  axisTextDodge: number;

  /** Target number of ticks (ggplot2 default ~5). */
  nBreaks: number;

  /** Ink color (ggplot2 default "black"). */
  ink: string;

  /** Paper color (ggplot2 default "white"). */
  paper: string;

  /** Accent color for geoms. */
  accent: string;

  /** Panel background color (ggplot2 ~#EBEBEB). */
  panelFill: string;

  /** Grid line color (ggplot2 default white on grey panel). */
  gridColor: string;

  /** Categorical color palette (array of hex colors).
   *  Default: Power BI's standard 8-color palette.
   *  In PBI visuals, pass the host's palette to match report theming. */
  colorPalette: string[];

  /** High contrast mode (Power BI accessibility). Thicker strokes and borders. */
  isHighContrast: boolean;
}

/** Fully resolved theme with computed values. */
export interface ResolvedTheme {
  // Source config
  config: ThemeConfig;

  // Derived values (all in px)
  halfLine: number;
  baseLineSize: number;

  // Text sizes
  axisTextSize: number;      // rel(0.8)
  axisTitleSize: number;     // rel(1.0) = base_size
  plotTitleSize: number;     // rel(1.2)
  plotCaptionSize: number;   // rel(0.8)
  legendTextSize: number;    // rel(0.8)

  // Spacing
  tickLength: number;        // rel(0.5) * halfLine
  axisTextMargin: number;    // 0.8 * halfLine / 2
  axisTitleMargin: number;   // halfLine / 2

  // Margins (chart-level)
  margin: { top: number; right: number; bottom: number; left: number };

  // Colors
  ink: string;
  paper: string;
  accent: string;
  axisTextColor: string;     // ~30% mix ink/paper
  axisTickColor: string;     // ~20% mix ink/paper
  panelFill: string;
  gridColor: string;

  // Axis behavior
  axisTextOverlap: 'hide' | 'rotate' | 'none';
  axisTextDodge: number;
  nBreaks: number;

  // Point defaults
  pointSize: number;         // (base_size / 11) * 1.5

  // Color palette
  colorPalette: string[];

  // Accessibility
  isHighContrast: boolean;
  /** Stroke width on bars/points in HC mode. */
  highContrastStrokeWidth: number;
}

/**
 * Power BI default color palette (8 colors).
 * These are the standard colors PBI uses for categorical data.
 * When running inside PBI, the host palette should be passed instead
 * so colors match the user's report theme.
 */
export const PBI_DEFAULT_PALETTE: string[] = [
  '#118DFF', // blue
  '#12239E', // dark blue
  '#E66C37', // orange
  '#6B007B', // purple
  '#E044A7', // pink
  '#744EC2', // violet
  '#D9B300', // gold
  '#D64550', // red
];

const DEFAULT_CONFIG: ThemeConfig = {
  baseSize: 11,
  axisTextOverlap: 'hide',
  axisTextDodge: 1,
  nBreaks: 5,
  ink: '#333333',
  paper: '#ffffff',
  accent: '#118DFF',
  panelFill: '#EBEBEB',
  gridColor: '#ffffff',
  colorPalette: PBI_DEFAULT_PALETTE,
  isHighContrast: false,
};

/** Mix two hex colors. ratio=0 → color1, ratio=1 → color2. */
function mixColor(hex1: string, hex2: string, ratio: number): string {
  const parse = (h: string) => {
    const c = h.replace('#', '');
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(hex1);
  const [r2, g2, b2] = parse(hex2);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * ratio);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(r1, r2))}${toHex(mix(g1, g2))}${toHex(mix(b1, b2))}`;
}

/** Resolve a ThemeConfig into computed pixel values. */
export function resolveTheme(config: Partial<ThemeConfig> = {}): ResolvedTheme {
  const c: ThemeConfig = { ...DEFAULT_CONFIG, ...config };
  const halfLine = c.baseSize / 2;
  const baseLineSize = c.baseSize / 22;

  // Margins derived from base_size, like ggplot2's margin_auto(half_line)
  // Bottom extra for axis text + title, left extra for y-axis text + title
  const margin = {
    top: Math.round(halfLine * 2),
    right: Math.round(halfLine * 2),
    bottom: Math.round(halfLine * 2 + c.baseSize * 0.8 + halfLine / 2 + c.baseSize + halfLine / 2),
    left: Math.round(halfLine * 2 + c.baseSize * 0.8 + halfLine / 2 + c.baseSize + halfLine / 2),
  };

  return {
    config: c,
    halfLine,
    baseLineSize,

    axisTextSize: c.baseSize * 0.8,
    axisTitleSize: c.baseSize,
    plotTitleSize: c.baseSize * 1.2,
    plotCaptionSize: c.baseSize * 0.8,
    legendTextSize: c.baseSize * 0.8,

    tickLength: 0.5 * halfLine,
    axisTextMargin: 0.8 * halfLine / 2,
    axisTitleMargin: halfLine / 2,

    margin,

    ink: c.ink,
    paper: c.paper,
    accent: c.accent,
    axisTextColor: mixColor(c.ink, c.paper, 0.3),
    axisTickColor: mixColor(c.ink, c.paper, 0.2),
    panelFill: c.panelFill,
    gridColor: c.gridColor,

    axisTextOverlap: c.axisTextOverlap,
    axisTextDodge: c.axisTextDodge,
    nBreaks: c.nBreaks,

    pointSize: (c.baseSize / 11) * 1.5,

    colorPalette: c.colorPalette,

    isHighContrast: c.isHighContrast,
    highContrastStrokeWidth: c.isHighContrast ? 2 : 0,
  };
}

/**
 * ggplot2-style label priority: first, last, middle, then binary subdivide.
 * Used with check.overlap to hide overlapping labels while keeping the
 * most important ones visible.
 */
export function axisLabelPriority(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [0];
  if (n === 2) return [0, 1];

  const result: number[] = [0, n - 1];

  function between(lo: number, hi: number) {
    const span = hi - lo + 1;
    if (span <= 2) return;
    const mid = lo + Math.floor((span - 1) / 2);
    result.push(mid);
    between(lo, mid);
    between(mid, hi);
  }
  between(0, n - 1);
  return result;
}

// --- Preset themes ---

/** ggplot2 theme_grey equivalent (default). */
export function themeGrey(baseSize = 11): Partial<ThemeConfig> {
  return { baseSize, ...GREY_DEFAULTS };
}

/**
 * Colours of the default grey theme. The Power BI Format Pane ships its
 * colour pickers with exactly these values, so a picker only counts as a
 * user override when it differs from them — otherwise an untouched picker
 * would silently undo a chosen preset.
 */
export const GREY_DEFAULTS = {
  panelFill: '#EBEBEB',
  gridColor: '#ffffff',
  ink: '#333333',
  paper: '#ffffff',
} as const;

/** Minimal theme: white background, light grey grid. */
export function themeMinimal(baseSize = 11): Partial<ThemeConfig> {
  return { baseSize, panelFill: '#ffffff', gridColor: '#e0e0e0', ink: '#333333' };
}

/** Dark theme. */
export function themeDark(baseSize = 11): Partial<ThemeConfig> {
  return {
    baseSize,
    panelFill: '#2d2d2d',
    gridColor: '#444444',
    ink: '#e0e0e0',
    paper: '#1a1a1a',
    accent: '#5599ff',
  };
}
