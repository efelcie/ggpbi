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
  /** Y-axis room the outer plot margin already provides left of column 0. */
  reservedLeft: number;
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

  const showX = (r: number, c: number): boolean =>
    input.freeX || r === nRows - 1 || !present(r + 1, c);
  const showY = (_r: number, c: number): boolean => input.freeY || c === 0;

  // Interior axis room. With a fixed x scale, a panel above an empty wrap
  // cell draws its axis into that empty cell — no room needed. Free scales
  // put an axis on every panel, so every gap needs one.
  const xAxisRoom = (r: number): number => (input.freeX && r < nRows - 1 ? metrics.xAxis : 0);
  const yAxisRoom = (c: number): number => (input.freeY && c > 0 ? input.yAxisWidth(c) : 0);
  const stripAbove = (r: number): number => (input.stripAbove(r) ? metrics.strip : 0);

  // Column 0's axis lives in the outer margin; only what does not fit
  // there pushes the grid right.
  const extraLeft = Math.max(0, input.yAxisWidth(0) - input.reservedLeft);
  const stripRight = input.stripRight ? metrics.strip : 0;

  let interiorY = 0;
  for (let c = 1; c < nCols; c++) interiorY += yAxisRoom(c);
  const colGap = metrics.colSpacing ?? metrics.spacing;
  const availW = innerWidth - extraLeft - interiorY - colGap * (nCols - 1) - stripRight;
  const panelW = Math.max(1, availW / nCols);

  let fixedH = metrics.spacing * (nRows - 1);
  for (let r = 0; r < nRows; r++) fixedH += stripAbove(r) + xAxisRoom(r);
  const availH = Math.max(nRows, innerHeight - fixedH);
  const weights = rowWeights(nRows, input.heights);
  const total = weights.reduce((a, w) => a + w, 0);
  const rowH = weights.map(w => Math.max(1, (availH * w) / total));

  const colX: number[] = [];
  let x = extraLeft;
  for (let c = 0; c < nCols; c++) {
    x += yAxisRoom(c);
    colX.push(x);
    x += panelW + colGap;
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
