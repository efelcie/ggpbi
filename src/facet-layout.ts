/**
 * Facet grid geometry — where each small-multiple panel sits.
 *
 * Pure arithmetic, no DOM, so the layout rules are testable on their own:
 *
 * - Axes sit on the outside of the grid, as in ggplot2: the x axis under
 *   the bottom panel of each column, the y axis left of the first column.
 *   A free scale gives every panel its own axis, and the grid makes room
 *   for the interior ones.
 * - Every size comes from the theme (strip height from the strip text,
 *   axis room from the tick labels), so a chart laid out for a 3× device
 *   with `baseSize = 40` keeps its strips and axes readable instead of
 *   overlapping the neighbouring panel.
 * - Rows can have relative heights (`heights = [4, 1]`), like patchwork's
 *   `plot_layout(heights = …)` or `ggh4x::force_panelsizes(rows = …)`.
 */

export interface FacetGridInput {
  nRows: number;
  nCols: number;
  /** Whether cell (r, c) holds a panel — facet_wrap leaves trailing cells empty. */
  present: (r: number, c: number) => boolean;
  innerWidth: number;
  innerHeight: number;
  freeX: boolean;
  freeY: boolean;
  /** A strip above the panels of row r (wrap: every row; grid: the first). */
  stripAbove: (r: number) => boolean;
  /** Row strips to the right of the last column (facet_grid rows). */
  stripRight: boolean;
  /** Relative row heights, recycled; invalid or missing entries count as 1. */
  heights?: number[];
  /** Room the y axis of column c needs: widest tick label + tick + padding. */
  yAxisWidth: (c: number) => number;
  /**
   * Y-axis room the outer plot margin already provides beside the outer
   * column (left of column 0, or right of the last column for a right axis).
   */
  reservedLeft: number;
  /** Side of the y axes (ggplot2 position = "right"). Default 'left'. */
  yAxisSide?: 'left' | 'right';
  /**
   * Per-row axis overrides (`rowAxes`): which axes row r draws. Undefined
   * entries keep ggplot2's outer-axes rule.
   */
  rowAxes?: Array<{ x: boolean; y: boolean } | undefined>;
  /**
   * Strip thickness, interior x-axis height and the gap between panels.
   * `colSpacing` widens the gap between columns (free x scales put tick
   * labels at both panel edges); default `spacing`.
   */
  metrics: { strip: number; xAxis: number; spacing: number; colSpacing?: number };
}

export interface FacetCell {
  r: number;
  c: number;
  /** Panel origin and size inside the plot area. */
  x: number;
  y: number;
  width: number;
  height: number;
  showXAxis: boolean;
  showYAxis: boolean;
}

/** Which axes one panel row draws, from a `rowAxes` entry ("xy", "x", "y", "none"). */
export function parseRowAxes(entry: unknown): { x: boolean; y: boolean } | undefined {
  if (typeof entry !== 'string') return undefined;
  const e = entry.trim().toLowerCase();
  if (e === '') return undefined;
  if (e === 'none' || e === '-') return { x: false, y: false };
  if (!/^[xy]+$/.test(e)) return undefined;
  return { x: e.includes('x'), y: e.includes('y') };
}

/** Split a Format Pane `rowAxes` text ("xy,none") into its entries. */
export function parseRowAxesText(text: unknown): string[] | undefined {
  if (Array.isArray(text)) return text.length > 0 ? text.map(String) : undefined;
  if (typeof text !== 'string' || text.trim() === '') return undefined;
  const entries = text.split(/[\s,;]+/).filter(Boolean);
  return entries.every(e => parseRowAxes(e) !== undefined) ? entries : undefined;
}

/** Facet levels and grid shape, shared by the layout and the renderer. */
export interface FacetDims {
  wrapLevels: string[];
  rowLevels: string[];
  colLevels: string[];
  nRows: number;
  nCols: number;
}

/**
 * Levels sort like ggplot2 factor levels: numerically when all values are
 * numbers (4, 6, 8 — not data order), alphabetically otherwise. They come
 * from every row, so a level only one layer has values for gets a panel.
 */
export function facetDims(
  facet: { wrap?: string; row?: string; col?: string; ncol?: number; nrow?: number },
  data: Array<Record<string, unknown>>,
): FacetDims {
  const levelSort = (a: string, b: string): number => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  };
  const levels = (field: string) => Array.from(new Set(data.map(d => String(d[field])))).sort(levelSort);
  const wrapLevels = facet.wrap ? levels(facet.wrap) : [];
  const rowLevels = !facet.wrap && facet.row ? levels(facet.row) : [''];
  const colLevels = !facet.wrap && facet.col ? levels(facet.col) : [''];
  if (facet.wrap) {
    // ggplot2 wrap_dims: ncol wins, else derive from nrow, else ceil(sqrt(n)).
    const n = wrapLevels.length;
    let nCols = facet.ncol ?? (facet.nrow ? Math.ceil(n / facet.nrow) : Math.ceil(Math.sqrt(n)));
    nCols = Math.max(1, Math.min(nCols, n));
    return { wrapLevels, rowLevels, colLevels, nRows: Math.max(1, Math.ceil(n / nCols)), nCols };
  }
  return {
    wrapLevels, rowLevels, colLevels,
    nRows: Math.max(1, rowLevels.length),
    nCols: Math.max(1, colLevels.length),
  };
}

/** Normalised row weights: `heights` recycled over the rows, invalid → 1. */
export function rowWeights(nRows: number, heights?: number[]): number[] {
  const valid = (heights ?? []).filter(h => Number.isFinite(h) && h > 0);
  if (valid.length === 0) return Array.from({ length: nRows }, () => 1);
  return Array.from({ length: nRows }, (_, r) => valid[r % valid.length]);
}

/**
 * Parse a heights text such as "4,1" or "4 1" (the Format Pane field).
 * Non-positive or non-numeric entries are dropped; empty text → undefined.
 */
export function parseHeights(text: unknown): number[] | undefined {
  if (Array.isArray(text)) {
    const nums = text.map(Number).filter(h => Number.isFinite(h) && h > 0);
    return nums.length > 0 ? nums : undefined;
  }
  if (typeof text !== 'string') return undefined;
  const nums = text
    .split(/[\s,;]+/)
    .filter(Boolean)
    // A decimal comma ("1,5") cannot be told apart from a list separator,
    // so the decimal point is the only decimal mark accepted.
    .map(Number)
    .filter(h => Number.isFinite(h) && h > 0);
  return nums.length > 0 ? nums : undefined;
}

export function layoutFacetGrid(input: FacetGridInput): FacetCell[] {
  const { nRows, nCols, present, innerWidth, innerHeight, metrics } = input;

  const right = input.yAxisSide === 'right';
  // The outer column carries the y axis: the first, or the last for a
  // right-hand axis.
  const outerCol = right ? nCols - 1 : 0;
  const override = (r: number) => input.rowAxes?.[r];

  const showX = (r: number, c: number): boolean =>
    override(r)?.x ?? (input.freeX || r === nRows - 1 || !present(r + 1, c));
  const showY = (r: number, c: number): boolean =>
    override(r)?.y ?? (input.freeY || c === outerCol);

  // Interior axis room. With a fixed x scale, a panel above an empty wrap
  // cell draws its axis into that empty cell — no room needed. A free
  // scale (or a row told to draw its axis) needs room above the next row.
  const xAxisRoom = (r: number): number => {
    if (r >= nRows - 1) return 0;
    for (let c = 0; c < nCols; c++) {
      if (present(r, c) && showX(r, c) && present(r + 1, c)) return metrics.xAxis;
    }
    return 0;
  };
  // Interior y-axis room sits beside every column but the outer one:
  // left of it for a left axis, right of it for a right axis.
  const yAxisRoom = (c: number): number => {
    if (c === outerCol) return 0;
    for (let r = 0; r < nRows; r++) {
      if (present(r, c) && showY(r, c)) return input.yAxisWidth(c);
    }
    return 0;
  };
  const stripAbove = (r: number): number => (input.stripAbove(r) ? metrics.strip : 0);

  // The outer column's axis lives in the outer margin; only what does not
  // fit there pushes the grid inwards.
  const extraOuter = Math.max(0, input.yAxisWidth(outerCol) - input.reservedLeft);
  const stripRight = input.stripRight ? metrics.strip : 0;

  let interiorY = 0;
  for (let c = 0; c < nCols; c++) interiorY += yAxisRoom(c);
  const colGap = metrics.colSpacing ?? metrics.spacing;
  const availW = innerWidth - extraOuter - interiorY - colGap * (nCols - 1) - stripRight;
  const panelW = Math.max(1, availW / nCols);

  let fixedH = metrics.spacing * (nRows - 1);
  for (let r = 0; r < nRows; r++) fixedH += stripAbove(r) + xAxisRoom(r);
  const availH = Math.max(nRows, innerHeight - fixedH);
  const weights = rowWeights(nRows, input.heights);
  const total = weights.reduce((a, w) => a + w, 0);
  const rowH = weights.map(w => Math.max(1, (availH * w) / total));

  const colX: number[] = [];
  let x = right ? 0 : extraOuter;
  for (let c = 0; c < nCols; c++) {
    if (!right) x += yAxisRoom(c);
    colX.push(x);
    x += panelW + colGap;
    if (right) x += yAxisRoom(c);
  }
  const rowY: number[] = [];
  let y = 0;
  for (let r = 0; r < nRows; r++) {
    y += stripAbove(r);
    rowY.push(y);
    y += rowH[r] + xAxisRoom(r) + metrics.spacing;
  }

  const cells: FacetCell[] = [];
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      if (!present(r, c)) continue;
      cells.push({
        r, c,
        x: colX[c], y: rowY[r], width: panelW, height: rowH[r],
        showXAxis: showX(r, c),
        showYAxis: showY(r, c),
      });
    }
  }
  return cells;
}
