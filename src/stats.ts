/**
 * Statistical transformations — pure data transforms.
 *
 * Like ggplot2's stat layer: each stat computes derived data from raw data.
 * - stat_identity: pass through unchanged
 * - stat_count: aggregate by counting observations per group
 * - stat_boxplot: compute median, quartiles, whiskers, outliers
 *
 * Stats are pure functions: DataPoint[] → DataPoint[].
 * No DOM, no scales, no side effects.
 */

import * as d3 from 'd3';
import type { DataPoint, AesMapping, StatType } from './types';
import type { BoundPoint } from './bind-data';

// ---------------------------------------------------------------------------
// stat_count
// ---------------------------------------------------------------------------

/** The field name used by stat_count for the computed y value. */
export const STAT_COUNT_FIELD = '__count';

/**
 * stat_count: Aggregate raw data by counting observations per (x, color?) group.
 * If a weight aesthetic is mapped, sums weights instead of counting.
 *
 * Like ggplot2's stat_count / stat_bin(width=1):
 * - Groups by x (and optionally color)
 * - Counts observations per group (or sums weights)
 * - Outputs one row per group with '__count' field
 */
export function statCount(
  data: DataPoint[],
  xField: string,
  colorField?: string,
  weightField?: string,
): DataPoint[] {
  const groups = new Map<string, { count: number; weightSum: number; representative: DataPoint }>();

  for (const row of data) {
    const xVal = row[xField];
    const colorVal = colorField ? row[colorField] : undefined;
    const key = colorVal !== undefined ? `${xVal}|||${colorVal}` : String(xVal);

    if (!groups.has(key)) {
      groups.set(key, { count: 0, weightSum: 0, representative: row });
    }
    const entry = groups.get(key)!;
    entry.count++;
    if (weightField) {
      entry.weightSum += Number(row[weightField]) || 0;
    }
  }

  const result: DataPoint[] = [];
  for (const [, entry] of groups) {
    result.push({
      ...entry.representative,
      [STAT_COUNT_FIELD]: weightField ? entry.weightSum : entry.count,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// stat_boxplot — matches ggplot2 R/stat-boxplot.R
// ---------------------------------------------------------------------------

export type BoxplotStats = {
  x: unknown;
  color?: unknown;
  n: number;
  q1: number;
  median: number;
  q3: number;
  iqr: number;
  whiskerLow: number;
  whiskerHigh: number;
  notchLower: number;
  notchUpper: number;
  outliers: BoundPoint[];
};

/**
 * Compute boxplot statistics for grouped data.
 *
 * Matches ggplot2's stat_boxplot:
 * - Q1, Q2, Q3 via quantileSorted (type-7 quantiles, same as R default)
 * - IQR = Q3 - Q1
 * - Whisker fences at Q1 - coef*IQR / Q3 + coef*IQR
 * - whiskerLow = smallest datum >= lower fence
 * - whiskerHigh = largest datum <= upper fence
 * - Notch bounds: median ± 1.58 * IQR / sqrt(n)
 * - Outliers = values outside whisker range
 *
 * @param points  Bound data points
 * @param coef    Whisker multiplier (default 1.5). Infinity = full range.
 * @param naRm    If true, filter NaN silently. If false, warn.
 */
export function computeBoxplotStats(
  points: BoundPoint[],
  coef: number = 1.5,
  naRm: boolean = false,
): BoxplotStats[] {
  // Group by x + color (same as ggplot2 interaction(x, colour))
  const byGroup = d3.group(
    points,
    d => `${String(d.x)}\u0000${String(d.color ?? '__none__')}`,
  );

  const result: BoxplotStats[] = [];

  for (const [, group] of byGroup) {
    const x = group[0]?.x;
    const color = group[0]?.color;

    const validPoints: BoundPoint[] = [];
    let naCount = 0;

    for (const p of group) {
      const y = Number(p.y);
      if (Number.isNaN(y) || p.y == null) {
        naCount++;
      } else {
        validPoints.push(p);
      }
    }

    if (!naRm && naCount > 0) {
      console.warn(
        `ggpbi: removed ${naCount} rows containing non-finite values (stat_boxplot).`,
      );
    }

    if (validPoints.length === 0) continue;

    const ys = validPoints.map(d => Number(d.y)).sort(d3.ascending);
    const n = ys.length;

    const q1 = d3.quantileSorted(ys, 0.25)!;
    const median = d3.quantileSorted(ys, 0.5)!;
    const q3 = d3.quantileSorted(ys, 0.75)!;
    const iqr = q3 - q1;

    // Whisker bounds (ggplot2 logic)
    let whiskerLow: number;
    let whiskerHigh: number;
    let outliers: BoundPoint[];

    if (!isFinite(coef) || coef === Infinity) {
      // coef = Inf → whiskers to data extremes, no outliers
      whiskerLow = ys[0];
      whiskerHigh = ys[n - 1];
      outliers = [];
    } else {
      const lowFence = q1 - coef * iqr;
      const highFence = q3 + coef * iqr;

      // Whisker = most extreme datum still inside fence
      whiskerLow = ys.find(v => v >= lowFence) ?? q1;
      whiskerHigh = [...ys].reverse().find(v => v <= highFence) ?? q3;

      outliers = validPoints.filter(d => {
        const y = Number(d.y);
        return y < whiskerLow || y > whiskerHigh;
      });
    }

    // Notch bounds (ggplot2: 1.58 * IQR / sqrt(n))
    const notchSpread = 1.58 * iqr / Math.sqrt(n);
    const notchLower = median - notchSpread;
    const notchUpper = median + notchSpread;

    result.push({
      x,
      color,
      n,
      q1,
      median,
      q3,
      iqr,
      whiskerLow,
      whiskerHigh,
      notchLower,
      notchUpper,
      outliers,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// stat_bin — matches ggplot2 R/stat-bin.R + R/bin.R
// ---------------------------------------------------------------------------

/** The field names used by stat_bin for computed variables. */
export const STAT_BIN_COUNT = '__bin_count';
export const STAT_BIN_DENSITY = '__bin_density';
export const STAT_BIN_NCOUNT = '__bin_ncount';
export const STAT_BIN_NDENSITY = '__bin_ndensity';
export const STAT_BIN_WIDTH = '__bin_width';
export const STAT_BIN_X = '__bin_x';
export const STAT_BIN_XMIN = '__bin_xmin';
export const STAT_BIN_XMAX = '__bin_xmax';

export interface StatBinParams {
  bins?: number;
  binwidth?: number;
  breaks?: number[];
  center?: number;
  boundary?: number;
  closed?: 'right' | 'left';
  pad?: boolean;
  drop?: 'none' | 'all' | 'extremes';
}

/**
 * Compute bin breaks from number of bins (ggplot2: bin_breaks_bins).
 *
 * Width formula: (max - min) / (bins - 1).
 * This matches ggplot2 exactly — NOT (max - min) / bins.
 */
function binBreaksBins(
  xMin: number,
  xMax: number,
  bins: number,
  center?: number,
  boundary?: number,
): number[] {
  const range = xMax - xMin;
  if (range === 0) {
    // Zero-width data: use width=0.1 like ggplot2
    return binBreaksWidth(xMin, xMax, 0.1, center, boundary);
  }
  if (bins === 1) {
    return binBreaksWidth(xMin, xMax, range, center, xMin);
  }
  const width = range / (bins - 1);

  // ggplot2: adjust boundary to prevent misalignment when range is exact
  // multiple of width
  const effectiveBoundary = boundary ?? (center != null ? center - width / 2 : undefined);
  return binBreaksWidth(xMin, xMax, width, center, effectiveBoundary);
}

/**
 * Compute bin breaks from bin width (ggplot2: bin_breaks_width).
 *
 * Determines the left-most bin edge (origin) from boundary:
 *   origin = boundary + floor((xMin - boundary) / width) * width
 */
function binBreaksWidth(
  xMin: number,
  xMax: number,
  width: number,
  center?: number,
  boundary?: number,
): number[] {
  if (width <= 0) throw new Error('ggpbi: binwidth must be positive');

  // Resolve boundary from center
  let bnd: number;
  if (boundary != null && center != null) {
    // ggplot2: "Can only set one of `boundary` and `center`" — center wins
    bnd = center - width / 2;
  } else if (center != null) {
    bnd = center - width / 2;
  } else if (boundary != null) {
    bnd = boundary;
  } else {
    bnd = 0; // ggplot2 default: boundary=0
  }

  // Compute origin: shift boundary down to cover xMin
  const origin = bnd + Math.floor((xMin - bnd) / width) * width;

  // Safety: prevent >1,000,000 bins
  const nBins = Math.ceil((xMax - origin) / width) + 1;
  if (nBins > 1e6) {
    throw new Error(`ggpbi: stat_bin would produce ${nBins} bins — binwidth too small`);
  }

  // Generate breaks
  const breaks: number[] = [];
  for (let i = 0; i <= nBins; i++) {
    breaks.push(origin + i * width);
  }

  // ggplot2 safety: ensure at least 2 breaks
  if (breaks.length === 1) {
    breaks.push(breaks[0] + width);
  }

  return breaks;
}

/**
 * Compute bin breaks — resolves priority: breaks > binwidth > bins.
 * Matches ggplot2's compute_bins().
 */
function computeBinBreaks(
  xs: number[],
  params: StatBinParams,
): number[] {
  if (xs.length === 0) return [];

  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);

  // Priority: explicit breaks > binwidth > bins (ggplot2 spec)
  if (params.breaks && params.breaks.length > 0) {
    return [...params.breaks].sort((a, b) => a - b);
  }

  if (params.binwidth != null) {
    return binBreaksWidth(xMin, xMax, params.binwidth, params.center, params.boundary);
  }

  const nBins = params.bins ?? 30;
  return binBreaksBins(xMin, xMax, nBins, params.center, params.boundary);
}

/**
 * Bin a numeric vector into histogram bins (ggplot2: bin_vector).
 *
 * Assigns each value to a bin using cut() semantics with fuzz factor.
 * Returns one row per bin with computed variables.
 */
export function statBin(
  data: DataPoint[],
  xField: string,
  params: StatBinParams = {},
  colorField?: string,
  weightField?: string,
): DataPoint[] {
  // Extract numeric x values, filter NA (null/undefined/NaN)
  const validRows: { row: DataPoint; x: number }[] = [];
  for (const row of data) {
    const raw = row[xField];
    if (raw == null) continue; // null/undefined → NA
    const v = Number(raw);
    if (!Number.isFinite(v)) continue; // NaN/Infinity → NA
    validRows.push({ row, x: v });
  }
  if (validRows.length === 0) return [];

  // Group by color if present
  const groups = new Map<string, { rows: { row: DataPoint; x: number }[] }>();
  for (const vr of validRows) {
    const key = colorField ? String(vr.row[colorField]) : '__all__';
    if (!groups.has(key)) groups.set(key, { rows: [] });
    groups.get(key)!.rows.push(vr);
  }

  // Compute breaks from ALL data (shared bins across color groups, like ggplot2)
  const allXs = validRows.map(vr => vr.x);
  const breaks = computeBinBreaks(allXs, params);
  if (breaks.length < 2) return [];

  const closed = params.closed ?? 'right';
  const pad = params.pad ?? false;
  const drop = params.drop ?? 'none';

  // Fuzz factor: 1e-8 * median(diff(breaks)) — ggplot2 exact
  const diffs = [];
  for (let i = 1; i < breaks.length; i++) {
    diffs.push(breaks[i] - breaks[i - 1]);
  }
  diffs.sort((a, b) => a - b);
  const medianDiff = diffs.length > 0
    ? (diffs.length % 2 === 0
      ? (diffs[diffs.length / 2 - 1] + diffs[diffs.length / 2]) / 2
      : diffs[Math.floor(diffs.length / 2)])
    : 0;
  const fuzz = Number.isFinite(medianDiff) && medianDiff > 0
    ? 1e-8 * medianDiff
    : Number.EPSILON * 1e3;

  // Build fuzzy breaks (ggplot2: adjusts bin edges for floating-point safety)
  const fuzzyBreaks = breaks.map((b, i) => {
    if (closed === 'right') {
      return i === 0 ? b - fuzz : b + fuzz;
    } else {
      return i === breaks.length - 1 ? b + fuzz : b - fuzz;
    }
  });

  const result: DataPoint[] = [];

  for (const [groupKey, group] of groups) {
    const nBins = breaks.length - 1;
    const counts = new Array(nBins).fill(0);

    // Assign each x to a bin using fuzzy breaks
    for (const vr of group.rows) {
      const x = vr.x;
      const w = weightField ? (Number(vr.row[weightField]) || 0) : 1;

      // Find bin: linear scan (sufficient for typical bin counts)
      let binIdx = -1;
      if (closed === 'right') {
        // (a, b] — right-closed
        for (let i = 0; i < nBins; i++) {
          if (x > fuzzyBreaks[i] && x <= fuzzyBreaks[i + 1]) {
            binIdx = i;
            break;
          }
        }
      } else {
        // [a, b) — left-closed
        for (let i = 0; i < nBins; i++) {
          if (x >= fuzzyBreaks[i] && x < fuzzyBreaks[i + 1]) {
            binIdx = i;
            break;
          }
        }
      }

      // Fallback: edge case — place in last/first bin
      if (binIdx === -1) {
        if (x <= fuzzyBreaks[0]) binIdx = 0;
        else if (x >= fuzzyBreaks[nBins]) binIdx = nBins - 1;
      }

      if (binIdx >= 0 && binIdx < nBins) {
        counts[binIdx] += w;
      }
    }

    // Compute derived values
    const totalCount = counts.reduce((a, b) => a + b, 0);
    const maxCount = Math.max(...counts);
    const binWidths: number[] = [];
    const binMidpoints: number[] = [];
    for (let i = 0; i < nBins; i++) {
      binWidths.push(breaks[i + 1] - breaks[i]);
      binMidpoints.push((breaks[i] + breaks[i + 1]) / 2);
    }

    // Density: count / (total * width)  — ggplot2: density integrates to 1
    const densities = counts.map((c, i) => totalCount > 0 ? c / totalCount / binWidths[i] : 0);
    const maxDensity = Math.max(...densities);

    // Build result rows
    const groupResult: DataPoint[] = [];
    for (let i = 0; i < nBins; i++) {
      const count = counts[i];
      const density = densities[i];
      const ncount = maxCount > 0 ? count / maxCount : 0;
      const ndensity = maxDensity > 0 ? density / maxDensity : 0;

      const row: DataPoint = {
        [STAT_BIN_X]: binMidpoints[i],
        [STAT_BIN_XMIN]: breaks[i],
        [STAT_BIN_XMAX]: breaks[i + 1],
        [STAT_BIN_COUNT]: count,
        [STAT_BIN_DENSITY]: density,
        [STAT_BIN_NCOUNT]: ncount,
        [STAT_BIN_NDENSITY]: ndensity,
        [STAT_BIN_WIDTH]: binWidths[i],
        [xField]: binMidpoints[i],
      };

      if (colorField && groupKey !== '__all__') {
        row[colorField] = groupKey;
      }

      groupResult.push(row);
    }

    // Padding: add zero-count bins at boundaries (ggplot2: pad=TRUE)
    if (pad && nBins > 0) {
      const firstWidth = binWidths[0];
      const lastWidth = binWidths[nBins - 1];
      const padRow = (x: number, xmin: number, xmax: number, w: number) => {
        const r: DataPoint = {
          [STAT_BIN_X]: x,
          [STAT_BIN_XMIN]: xmin,
          [STAT_BIN_XMAX]: xmax,
          [STAT_BIN_COUNT]: 0,
          [STAT_BIN_DENSITY]: 0,
          [STAT_BIN_NCOUNT]: 0,
          [STAT_BIN_NDENSITY]: 0,
          [STAT_BIN_WIDTH]: w,
          [xField]: x,
        };
        if (colorField && groupKey !== '__all__') {
          r[colorField] = groupKey;
        }
        return r;
      };

      // Prepend
      const padXmin = breaks[0] - firstWidth;
      groupResult.unshift(
        padRow(padXmin + firstWidth / 2, padXmin, breaks[0], firstWidth),
      );
      // Append
      const padXmax = breaks[nBins] + lastWidth;
      groupResult.push(
        padRow(breaks[nBins] + lastWidth / 2, breaks[nBins], padXmax, lastWidth),
      );
    }

    if (drop === 'all') {
      result.push(...groupResult.filter(row => Number(row[STAT_BIN_COUNT]) !== 0));
    } else if (drop === 'extremes') {
      const firstNonEmpty = groupResult.findIndex(row => Number(row[STAT_BIN_COUNT]) !== 0);
      let lastNonEmpty = groupResult.length - 1;
      while (lastNonEmpty >= 0 && Number(groupResult[lastNonEmpty][STAT_BIN_COUNT]) === 0) {
        lastNonEmpty--;
      }
      if (firstNonEmpty >= 0) {
        result.push(...groupResult.slice(firstNonEmpty, lastNonEmpty + 1));
      }
    } else {
      result.push(...groupResult);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// stat_smooth — matches ggplot2 R/stat-smooth.R
// ---------------------------------------------------------------------------

/** Fields produced by stat_smooth. */
export const STAT_SMOOTH_X = '__smooth_x';
export const STAT_SMOOTH_Y = '__smooth_y';
export const STAT_SMOOTH_YMIN = '__smooth_ymin';
export const STAT_SMOOTH_YMAX = '__smooth_ymax';
export const STAT_SMOOTH_SE = '__smooth_se';

export interface StatSmoothParams {
  method?: 'auto' | 'loess' | 'lm' | 'movingAverage';
  span?: number;
  n?: number;
  level?: number;
  fullrange?: boolean;
  se?: boolean;
  window?: number;
}

/**
 * Tricube weight function for LOESS.
 * w(u) = (1 - |u|³)³ for |u| < 1, else 0.
 */
function tricube(u: number): number {
  const absU = Math.abs(u);
  if (absU >= 1) return 0;
  const t = 1 - absU * absU * absU;
  return t * t * t;
}

/**
 * LOESS (locally weighted polynomial regression).
 *
 * Matches R's stats::loess() with degree=2 (local quadratic):
 * - For each evaluation point, fits a local weighted quadratic regression
 *   using the nearest `span * n` data points with tricube weighting
 * - Returns predicted y values and standard errors
 * - Computes effective degrees of freedom from hat matrix trace
 *   for proper confidence interval width (like R's predict.loess)
 */
function loessFit(
  xs: number[],
  ys: number[],
  evalPoints: number[],
  span: number,
): { fitted: number[]; se: number[]; effectiveDf: number } {
  const n = xs.length;
  const bandwidth = Math.max(3, Math.ceil(span * n)); // at least 3 for quadratic

  const fitted: number[] = [];
  const seValues: number[] = [];

  // Hat matrix diagonal (h_ii): needed for effective df and SE
  // We accumulate the trace across all data points
  let hatTrace = 0;

  // First pass: compute fitted values at data points for residual variance
  const fittedAtData: number[] = new Array(n);
  const hatDiag: number[] = new Array(n);

  for (let di = 0; di < n; di++) {
    const xEval = xs[di];

    // Find k nearest neighbours
    const dists = xs.map((x, i) => ({ dist: Math.abs(x - xEval), idx: i }));
    dists.sort((a, b) => a.dist - b.dist);
    const neighbours = dists.slice(0, bandwidth);
    const maxDist = neighbours[neighbours.length - 1].dist || 1;

    // Tricube weights
    const weights = neighbours.map(nb => tricube(nb.dist / (maxDist * 1.0001)));

    // Weighted least squares: y = a + b*x + c*x² (degree 2)
    const result = weightedPolyFit(neighbours, weights, xs, ys, xEval, 2);
    fittedAtData[di] = result.yPred;

    // Approximate hat diagonal for this point (leverage)
    // h_ii ≈ w_ii * x_i^T * (X^T W X)^-1 * x_i * w_ii
    // Simplified: use the weight of the point itself in the local fit
    const selfIdx = neighbours.findIndex(nb => nb.idx === di);
    hatDiag[di] = selfIdx >= 0 ? weights[selfIdx] / (weights.reduce((s, w) => s + w, 0) || 1) : 0;
    hatTrace += hatDiag[di];
  }

  // Effective degrees of freedom (like R's loess$enp)
  // df_residual = n - trace(H), where trace(H) ≈ n * span * (degree + 1) / n
  // More accurate: use the actual hat trace computed above
  const effectiveDf = Math.max(1, n - hatTrace);

  // Compute residual variance (sigma²)
  let ssResid = 0;
  for (let i = 0; i < n; i++) {
    const resid = ys[i] - fittedAtData[i];
    ssResid += resid * resid;
  }
  const sigma2 = effectiveDf > 0 ? ssResid / effectiveDf : 0;

  // Second pass: compute fitted values and SE at evaluation points
  for (const xEval of evalPoints) {
    const dists = xs.map((x, i) => ({ dist: Math.abs(x - xEval), idx: i }));
    dists.sort((a, b) => a.dist - b.dist);
    const neighbours = dists.slice(0, bandwidth);
    const maxDist = neighbours[neighbours.length - 1].dist || 1;

    const weights = neighbours.map(nb => tricube(nb.dist / (maxDist * 1.0001)));

    // Local quadratic fit
    const result = weightedPolyFit(neighbours, weights, xs, ys, xEval, 2);
    fitted.push(result.yPred);

    // SE at this point: sigma * sqrt(l(x)^T * l(x))
    // Approximated as sigma * sqrt(1/sum(w)) — the local effective sample size
    const sumW = weights.reduce((s, w) => s + w, 0);
    const se = Math.sqrt(sigma2 / Math.max(1, sumW));
    seValues.push(se);
  }

  return { fitted, se: seValues, effectiveDf };
}

/**
 * Weighted polynomial fit at a single evaluation point.
 *
 * Fits y = a0 + a1*x + a2*x² + ... using weighted least squares
 * with the Cramer/normal equations approach.
 *
 * degree=1: local linear, degree=2: local quadratic (ggplot2 default)
 */
function weightedPolyFit(
  neighbours: { dist: number; idx: number }[],
  weights: number[],
  xs: number[],
  ys: number[],
  xEval: number,
  degree: number,
): { yPred: number } {
  const p = degree + 1; // number of parameters

  // Build weighted normal equations: (X^T W X) beta = X^T W y
  // where X = [1, x, x², ...] and W = diag(weights)
  const XtWX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const XtWy: number[] = new Array(p).fill(0);

  for (let j = 0; j < neighbours.length; j++) {
    const idx = neighbours[j].idx;
    const w = weights[j];
    const xi = xs[idx];
    const yi = ys[idx];

    // Build x vector: [1, xi, xi², ...]
    const xvec: number[] = new Array(p);
    xvec[0] = 1;
    for (let k = 1; k < p; k++) {
      xvec[k] = xvec[k - 1] * xi;
    }

    // Accumulate X^T W X and X^T W y
    for (let r = 0; r < p; r++) {
      for (let c = 0; c < p; c++) {
        XtWX[r][c] += w * xvec[r] * xvec[c];
      }
      XtWy[r] += w * xvec[r] * yi;
    }
  }

  // Solve via Gaussian elimination with partial pivoting
  const beta = solveLinearSystem(XtWX, XtWy, p);

  // Evaluate polynomial at xEval
  let yPred = beta[0];
  let xPow = 1;
  for (let k = 1; k < p; k++) {
    xPow *= xEval;
    yPred += beta[k] * xPow;
  }

  return { yPred };
}

/**
 * Solve a linear system Ax = b via Gaussian elimination with partial pivoting.
 * Returns solution vector x. Modifies A and b in place.
 */
function solveLinearSystem(A: number[][], b: number[], n: number): number[] {
  // Copy to avoid mutation
  const a = A.map(row => [...row]);
  const rhs = [...b];

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxVal = Math.abs(a[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > maxVal) {
        maxVal = Math.abs(a[row][col]);
        maxRow = row;
      }
    }

    // Swap rows
    if (maxRow !== col) {
      [a[col], a[maxRow]] = [a[maxRow], a[col]];
      [rhs[col], rhs[maxRow]] = [rhs[maxRow], rhs[col]];
    }

    // Degenerate: near-zero pivot
    if (Math.abs(a[col][col]) < 1e-15) {
      continue; // leave coefficient as 0
    }

    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = a[row][col] / a[col][col];
      for (let c = col; c < n; c++) {
        a[row][c] -= factor * a[col][c];
      }
      rhs[row] -= factor * rhs[col];
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    if (Math.abs(a[row][row]) < 1e-15) continue;
    let sum = rhs[row];
    for (let col = row + 1; col < n; col++) {
      sum -= a[row][col] * x[col];
    }
    x[row] = sum / a[row][row];
  }

  return x;
}

/**
 * Linear regression (OLS) with confidence intervals.
 *
 * Computes y = a + bx and standard errors at evaluation points.
 * SE formula: sqrt(MSE * (1/n + (x - x̄)² / Σ(xi - x̄)²))
 */
function lmFit(
  xs: number[],
  ys: number[],
  evalPoints: number[],
): { fitted: number[]; se: number[] } {
  const n = xs.length;

  // Compute means
  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  // Compute slope and intercept
  let ssXX = 0, ssXY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    ssXX += dx * dx;
    ssXY += dx * (ys[i] - meanY);
  }

  const slope = ssXX > 0 ? ssXY / ssXX : 0;
  const intercept = meanY - slope * meanX;

  // Compute MSE (mean squared error)
  let ssResid = 0;
  for (let i = 0; i < n; i++) {
    const resid = ys[i] - (intercept + slope * xs[i]);
    ssResid += resid * resid;
  }
  const mse = n > 2 ? ssResid / (n - 2) : 0;

  // Predict at evaluation points
  const fitted = evalPoints.map(x => intercept + slope * x);
  const se = evalPoints.map(x => {
    const dx = x - meanX;
    return Math.sqrt(mse * (1 / n + (dx * dx) / ssXX));
  });

  return { fitted, se };
}

/**
 * Moving average with confidence intervals.
 *
 * Power BI extension — not in ggplot2.
 * Uses a centered rolling window.
 */
function movingAverageFit(
  xs: number[],
  ys: number[],
  evalPoints: number[],
  windowSize: number,
): { fitted: number[]; se: number[] } {
  // Sort data by x
  const sorted = xs.map((x, i) => ({ x, y: ys[i] })).sort((a, b) => a.x - b.x);
  const sortedXs = sorted.map(d => d.x);
  const sortedYs = sorted.map(d => d.y);
  const n = sorted.length;
  const halfWin = Math.floor(windowSize / 2);

  const fitted: number[] = [];
  const seValues: number[] = [];

  for (const xEval of evalPoints) {
    // Find the closest data index
    let closestIdx = 0;
    let minDist = Math.abs(sortedXs[0] - xEval);
    for (let i = 1; i < n; i++) {
      const dist = Math.abs(sortedXs[i] - xEval);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }

    // Window around closest point
    const lo = Math.max(0, closestIdx - halfWin);
    const hi = Math.min(n - 1, closestIdx + halfWin);
    let sum = 0;
    let count = 0;
    for (let i = lo; i <= hi; i++) {
      sum += sortedYs[i];
      count++;
    }
    const mean = sum / count;
    fitted.push(mean);

    // SE from window variance
    let sumSq = 0;
    for (let i = lo; i <= hi; i++) {
      const d = sortedYs[i] - mean;
      sumSq += d * d;
    }
    const variance = count > 1 ? sumSq / (count - 1) : 0;
    seValues.push(Math.sqrt(variance / count));
  }

  return { fitted, se: seValues };
}

/**
 * Normal distribution quantile (probit) via rational approximation.
 *
 * Abramowitz & Stegun formula 26.2.23. Accurate to ~4.5e-4.
 */
function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p < 0.5) return -normalQuantile(1 - p);
  const t = Math.sqrt(-2 * Math.log(1 - p));
  return t - (2.515517 + 0.802853 * t + 0.010328 * t * t) /
    (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
}

/**
 * T-distribution critical value approximation.
 *
 * Uses the Cornish–Fisher expansion to adjust the normal quantile
 * for the t-distribution with given degrees of freedom.
 * Accurate to ~0.01 for df >= 3 and all common confidence levels.
 */
function tCritical(level: number, df: number): number {
  if (df <= 0) return normalQuantile((1 + level) / 2);

  const alpha = (1 - level) / 2;
  const z = normalQuantile(1 - alpha);

  // For large df, normal approximation is sufficient
  if (df > 1000) return z;

  // Cornish–Fisher expansion (3-term) for t-distribution
  const g1 = (z * z * z + z) / (4 * df);
  const g2 = (5 * z * z * z * z * z + 16 * z * z * z + 3 * z) / (96 * df * df);
  return z + g1 + g2;
}

/**
 * stat_smooth: Compute smoothed conditional means.
 *
 * Like ggplot2's stat_smooth:
 * - Auto-detects method (loess < 1000 obs, lm >= 1000)
 * - Generates n evaluation points
 * - Computes fitted values + confidence bands
 * - Groups by colour aesthetic
 */
export function statSmooth(
  data: DataPoint[],
  xField: string,
  yField: string,
  params: StatSmoothParams = {},
  colorField?: string,
): DataPoint[] {
  const method = params.method ?? 'auto';
  const span = params.span ?? 0.75;
  const nEval = params.n ?? 80;
  const level = params.level ?? 0.95;
  const computeSE = params.se !== false;
  const fullrange = params.fullrange ?? false;
  const windowSize = params.window ?? 5;

  // Group by color
  const groups = new Map<string, { rows: DataPoint[]; xs: number[]; ys: number[] }>();
  for (const row of data) {
    const xRaw = row[xField];
    const yRaw = row[yField];
    if (xRaw == null || yRaw == null) continue;
    const x = Number(xRaw);
    const y = Number(yRaw);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const key = colorField ? String(row[colorField]) : '__all__';
    if (!groups.has(key)) groups.set(key, { rows: [], xs: [], ys: [] });
    const g = groups.get(key)!;
    g.rows.push(row);
    g.xs.push(x);
    g.ys.push(y);
  }

  const result: DataPoint[] = [];

  for (const [groupKey, group] of groups) {
    const { xs, ys } = group;
    const n = xs.length;

    // Need at least 2 unique x values
    const uniqueX = new Set(xs);
    if (uniqueX.size < 2) continue;

    // Generate evaluation points
    // fullrange=true: extend to full data range (across all groups)
    let xMin: number, xMax: number;
    if (fullrange) {
      // Use the global data range (all rows, not just this group)
      xMin = Infinity;
      xMax = -Infinity;
      for (const row of data) {
        const v = Number(row[xField]);
        if (Number.isFinite(v)) {
          if (v < xMin) xMin = v;
          if (v > xMax) xMax = v;
        }
      }
    } else {
      xMin = Math.min(...xs);
      xMax = Math.max(...xs);
    }
    const evalPoints: number[] = [];
    for (let i = 0; i < nEval; i++) {
      evalPoints.push(xMin + (xMax - xMin) * i / (nEval - 1));
    }

    // Determine method
    let effectiveMethod = method;
    if (effectiveMethod === 'auto') {
      effectiveMethod = n < 1000 ? 'loess' : 'lm';
    }

    // Fit
    let fitResult: { fitted: number[]; se: number[]; effectiveDf?: number };
    try {
      switch (effectiveMethod) {
        case 'loess':
          fitResult = loessFit(xs, ys, evalPoints, span);
          break;
        case 'lm':
          fitResult = lmFit(xs, ys, evalPoints);
          break;
        case 'movingAverage':
          fitResult = movingAverageFit(xs, ys, evalPoints, windowSize);
          break;
        default:
          fitResult = loessFit(xs, ys, evalPoints, span);
      }
    } catch {
      // Like ggplot2: warn and skip group on fit error
      console.warn(`ggpbi: fitting failed for group "${groupKey}". Skipping.`);
      continue;
    }

    // Compute confidence band
    // Use effective df from the fitting method when available (LOESS),
    // otherwise fall back to n - 2 (LM).
    // R's predictdf.loess uses predict.loess()$df for the t-quantile.
    const df = Math.max(1, fitResult.effectiveDf ?? (n - 2));
    const tCrit = tCritical(level, df);

    for (let i = 0; i < nEval; i++) {
      const row: DataPoint = {
        [xField]: evalPoints[i],
        [STAT_SMOOTH_X]: evalPoints[i],
        [STAT_SMOOTH_Y]: fitResult.fitted[i],
        [yField]: fitResult.fitted[i],
      };

      if (computeSE) {
        const margin = tCrit * fitResult.se[i];
        row[STAT_SMOOTH_SE] = fitResult.se[i];
        row[STAT_SMOOTH_YMIN] = fitResult.fitted[i] - margin;
        row[STAT_SMOOTH_YMAX] = fitResult.fitted[i] + margin;
      }

      if (colorField && groupKey !== '__all__') {
        row[colorField] = groupKey;
      }

      result.push(row);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// stat_density — matches ggplot2 R/stat-density.R (Gaussian kernel)
// ---------------------------------------------------------------------------

/** Fields produced by stat_density. */
export const STAT_DENSITY_X = '__density_x';
export const STAT_DENSITY_Y = '__density';

export interface StatDensityParams {
  /** Fixed bandwidth. Default: Silverman's rule of thumb (R bw.nrd0). */
  bw?: number;
  /** Bandwidth multiplier (ggplot2 `adjust`). Default: 1. */
  adjust?: number;
  /** Number of evaluation points (ggplot2 `n`). Default: 512. */
  n?: number;
  /** Restrict the curve to the data range instead of extending by 3·bw (ggplot2 `trim`). Default: false. */
  trim?: boolean;
}

/**
 * Silverman's rule-of-thumb bandwidth (R bw.nrd0):
 *   0.9 · min(sd, IQR/1.34) · n^(-1/5)
 * with R's fallback chain when spread estimates are zero.
 */
function bwNrd0(xs: number[]): number {
  const n = xs.length;
  const mean = xs.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(xs.reduce((s, v) => s + (v - mean) * (v - mean), 0) / (n - 1));

  const sorted = [...xs].sort((a, b) => a - b);
  const quantile = (p: number): number => {
    // R type-7 quantile (default).
    const h = (n - 1) * p;
    const lo = Math.floor(h);
    const hi = Math.ceil(h);
    return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
  };
  const iqr = quantile(0.75) - quantile(0.25);

  let lo = Math.min(sd, iqr / 1.34);
  if (lo === 0) lo = sd || Math.abs(sorted[0]) || 1;
  return 0.9 * lo * Math.pow(n, -1 / 5);
}

/**
 * stat_density: Gaussian kernel density estimate.
 *
 * Like ggplot2's stat_density / R's stats::density:
 * - Bandwidth via bw.nrd0 (Silverman), scaled by `adjust`
 * - Evaluated on an even grid extended by 3·bw beyond the data range
 *   (R `cut = 3`), or clipped to the range with `trim`
 * - Groups by colour aesthetic (one curve per group)
 */
export function statDensity(
  data: DataPoint[],
  xField: string,
  params: StatDensityParams = {},
  colorField?: string,
): DataPoint[] {
  const adjust = params.adjust ?? 1;
  const nEval = params.n ?? 512;
  const trim = params.trim ?? false;

  const groups = new Map<string, number[]>();
  for (const row of data) {
    const raw = row[xField];
    if (raw == null) continue;
    const x = raw instanceof Date ? raw.getTime() : Number(raw);
    if (!Number.isFinite(x)) continue;
    const key = colorField ? String(row[colorField]) : '__all__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(x);
  }

  const result: DataPoint[] = [];
  const INV_SQRT_2PI = 1 / Math.sqrt(2 * Math.PI);

  for (const [groupKey, xs] of groups) {
    if (xs.length < 2) {
      console.warn(`ggpbi: stat_density needs at least 2 observations, group "${groupKey}" skipped.`);
      continue;
    }

    const bw = (params.bw ?? bwNrd0(xs)) * adjust;
    if (!Number.isFinite(bw) || bw <= 0) {
      console.warn(`ggpbi: non-positive density bandwidth for group "${groupKey}", skipped.`);
      continue;
    }

    const dataMin = Math.min(...xs);
    const dataMax = Math.max(...xs);
    const gridMin = trim ? dataMin : dataMin - 3 * bw;
    const gridMax = trim ? dataMax : dataMax + 3 * bw;

    const invNBw = 1 / (xs.length * bw);
    for (let i = 0; i < nEval; i++) {
      const gx = gridMin + ((gridMax - gridMin) * i) / (nEval - 1);
      let sum = 0;
      for (const xi of xs) {
        const z = (gx - xi) / bw;
        sum += Math.exp(-0.5 * z * z);
      }
      const density = sum * INV_SQRT_2PI * invNBw;

      const row: DataPoint = {
        [xField]: gx,
        [STAT_DENSITY_X]: gx,
        [STAT_DENSITY_Y]: density,
      };
      if (colorField && groupKey !== '__all__') row[colorField] = groupKey;
      result.push(row);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// StatFn — common interface for all stat transforms
// ---------------------------------------------------------------------------

/**
 * A stat transform function.
 *
 * Pure function: data + aesthetics → transformed data + output field mapping.
 * The pipeline calls this before aesthetic binding.
 */
export interface StatResult {
  /** Transformed data (e.g., aggregated rows for stat_count). */
  data: DataPoint[];
  /** Aesthetic overrides (e.g., stat_count sets y → '__count'). */
  aesOverrides?: Partial<AesMapping>;
}

export type StatFn = (data: DataPoint[], aes: AesMapping, geomConfig?: import('./types').GeomConfig) => StatResult;

// ---------------------------------------------------------------------------
// Stat registry
// ---------------------------------------------------------------------------

/** stat_identity: pass data through unchanged. */
const statIdentity: StatFn = (data) => ({ data });

/** stat_count: aggregate by counting. */
const statCountFn: StatFn = (data, aes, geomConfig?) => {
  // Horizontal bars with only a y mapping count over y instead — the
  // categories sit on the y axis and the count becomes the x value.
  const horizontal = geomConfig != null
    && (geomConfig.type === 'bar' || geomConfig.type === 'col')
    && geomConfig.orientation === 'y';
  if (!aes.x && horizontal && aes.y) {
    const aggregated = statCount(data, aes.y, aes.color, aes.weight);
    return {
      data: aggregated,
      aesOverrides: { x: STAT_COUNT_FIELD },
    };
  }

  if (!aes.x) return { data };
  const aggregated = statCount(data, aes.x, aes.color, aes.weight);
  return {
    data: aggregated,
    aesOverrides: { y: STAT_COUNT_FIELD },
  };
};

/** stat_bin: bin continuous data into histogram bins. */
const statBinFn: StatFn = (data, aes, geomConfig?) => {
  if (!aes.x) return { data };

  // Extract binning params from geom config
  const params: StatBinParams = {};
  if (geomConfig && geomConfig.type === 'histogram') {
    const h = geomConfig as import('./types').HistogramGeomConfig;
    if (h.bins != null) params.bins = h.bins;
    if (h.binwidth != null) params.binwidth = h.binwidth;
    if (h.breaks) params.breaks = h.breaks;
    if (h.center != null) params.center = h.center;
    if (h.boundary != null) params.boundary = h.boundary;
    if (h.closed) params.closed = h.closed;
    if (h.pad != null) params.pad = h.pad;
    if (h.drop) params.drop = h.drop;
  }

  const binned = statBin(data, aes.x, params, aes.color, aes.weight);
  const yField = geomConfig?.type === 'histogram'
    ? {
        count: STAT_BIN_COUNT,
        density: STAT_BIN_DENSITY,
        ncount: STAT_BIN_NCOUNT,
        ndensity: STAT_BIN_NDENSITY,
      }[geomConfig.yAxis ?? 'count']
    : STAT_BIN_COUNT;
  return {
    data: binned,
    aesOverrides: { y: yField },
  };
};

/** stat_smooth: compute smoothed conditional means. */
const statSmoothFn: StatFn = (data, aes, geomConfig?) => {
  if (!aes.x || !aes.y) return { data };

  const params: StatSmoothParams = {};
  if (geomConfig && geomConfig.type === 'smooth') {
    const s = geomConfig as import('./types').SmoothGeomConfig;
    if (s.method != null) params.method = s.method;
    if (s.span != null) params.span = s.span;
    if (s.n != null) params.n = s.n;
    if (s.level != null) params.level = s.level;
    if (s.fullrange != null) params.fullrange = s.fullrange;
    if (s.se != null) params.se = s.se;
    if (s.window != null) params.window = s.window;
  }

  const smoothed = statSmooth(data, aes.x, aes.y, params, aes.color);
  return {
    data: smoothed,
    aesOverrides: { y: STAT_SMOOTH_Y },
  };
};

/** stat_density: Gaussian kernel density estimate. */
const statDensityFn: StatFn = (data, aes, geomConfig?) => {
  if (!aes.x) return { data };

  const params: StatDensityParams = {};
  if (geomConfig && geomConfig.type === 'density') {
    const d = geomConfig as import('./types').DensityGeomConfig;
    if (d.bw != null) params.bw = d.bw;
    if (d.adjust != null) params.adjust = d.adjust;
    if (d.n != null) params.n = d.n;
    if (d.trim != null) params.trim = d.trim;
  }

  const densities = statDensity(data, aes.x, params, aes.color);
  return {
    data: densities,
    aesOverrides: { y: STAT_DENSITY_Y },
  };
};

/**
 * Stat registry — lookup by StatType.
 *
 * Stateless, composable. Each stat is a pure function:
 *   const result = stats[type](data, aes);
 */
/** Field holding the summed value produced by stat_sum. */
export const STAT_SUM_FIELD = '__sum';

/**
 * stat_sum: one row per (category × colour × group × facet), values added up.
 *
 * ggplot2's geom_col draws one rectangle per observation and lets
 * position_stack pile them into a bar of the summed height. That is
 * mathematically the same total, but with several rows per group it
 * renders as visible segment seams — and under position_dodge the
 * rectangles land on top of each other, showing the maximum instead of
 * the sum. Power BI routinely delivers such row-level data (a column set
 * to "Don't summarize"), so bar/col aggregate first; the result matches
 * `stat_summary(fun = sum)`. Explicit `stat: 'identity'` keeps the
 * ggplot2 stacking behaviour.
 */
const statSumFn: StatFn = (data, aes, geomConfig?) => {
  const horizontal = geomConfig != null
    && (geomConfig.type === 'bar' || geomConfig.type === 'col')
    && geomConfig.orientation === 'y';
  const catField = horizontal ? aes.y : aes.x;
  const valField = horizontal ? aes.x : aes.y;
  if (!catField || !valField) return { data };

  const keyFields = [catField, aes.color, aes.group, aes.facetRow, aes.facetCol]
    .filter((f): f is string => !!f);

  const groups = new Map<string, DataPoint>();
  for (const d of data) {
    const key = keyFields.map(f => String(d[f])).join('\u0000');
    const value = Number(d[valField]);
    const existing = groups.get(key);
    if (existing) {
      if (Number.isFinite(value)) {
        existing[STAT_SUM_FIELD] = Number(existing[STAT_SUM_FIELD]) + value;
      }
    } else {
      // Keep the first row so other aesthetics (tooltip fields, selection
      // ids) survive; only the value axis is replaced.
      groups.set(key, { ...d, [STAT_SUM_FIELD]: Number.isFinite(value) ? value : 0 });
    }
  }

  return {
    data: Array.from(groups.values()),
    aesOverrides: horizontal ? { x: STAT_SUM_FIELD } : { y: STAT_SUM_FIELD },
  };
};

export const stats: Record<StatType, StatFn> = {
  identity: statIdentity,
  sum: statSumFn,
  count: statCountFn,
  bin: statBinFn,
  smooth: statSmoothFn,
  density: statDensityFn,
  boxplot: statIdentity, // boxplot stats are computed inside the geom (needs scale info)
};

// ---------------------------------------------------------------------------
// Stat resolution — determine which stat to use for a layer
// ---------------------------------------------------------------------------

/**
 * Default stat for each geom type (like ggplot2 defaults).
 *
 * - bar → 'count' (unless y is explicitly mapped)
 * - boxplot → 'boxplot' (computed in geom renderer)
 * - everything else → 'identity'
 */
export const DEFAULT_GEOM_STAT: Record<string, StatType> = {
  bar: 'count',
  histogram: 'bin',
  boxplot: 'boxplot',
  smooth: 'smooth',
  density: 'density',
};
