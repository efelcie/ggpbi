import type { LabelFormat } from './types';
import {
  formatPlain, formatPercent, formatCompact, formatThousands, formatCurrency,
  type FormatOptions,
} from './format';

/**
 * Wilkinson's Extended axis-break algorithm (Talbot, Lin, Hanrahan 2010).
 *
 * Port of R's `labeling::extended()` — the default break generator used by
 * ggplot2 via `scales::breaks_extended()`.
 *
 * Reference:
 *   Talbot, J., Lin, S., Hanrahan, P. (2010)
 *   "An Extension of Wilkinson's Algorithm for Positioning Tick Labels on Axes"
 *   InfoVis 2010.
 */

// ── Scoring helpers ────────────────────────────────────────────────

const EPS = Number.EPSILON * 100;

/** Nice-number preference + zero-inclusion bonus. */
function simplicity(q: number, Q: number[], j: number, lmin: number, _lmax: number, lstep: number): number {
  const n = Q.length;
  const i = Q.indexOf(q);
  const v = ((lmin % lstep < EPS) || (lstep - (lmin % lstep) < EPS)) && lmin <= 0 && _lmax >= 0 ? 1 : 0;
  return 1 - (i) / (n - 1) - j + v;
}

function simplicityMax(q: number, Q: number[], j: number): number {
  const n = Q.length;
  const i = Q.indexOf(q);
  return 1 - (i) / (n - 1) - j + 1;
}

/** How well the label range covers the data range. */
function coverage(dmin: number, dmax: number, lmin: number, lmax: number): number {
  const range = dmax - dmin;
  return 1 - 0.5 * ((dmax - lmax) ** 2 + (dmin - lmin) ** 2) / ((0.1 * range) ** 2);
}

function coverageMax(dmin: number, dmax: number, span: number): number {
  const range = dmax - dmin;
  if (span > range) {
    const half = (span - range) / 2;
    return 1 - 0.5 * (half ** 2 + half ** 2) / ((0.1 * range) ** 2);
  }
  return 1;
}

/** How close the label density is to the requested density. */
function density(k: number, m: number, dmin: number, dmax: number, lmin: number, lmax: number): number {
  const r = (k - 1) / (lmax - lmin);
  const rt = (m - 1) / (Math.max(lmax, dmax) - Math.min(dmin, lmin));
  return 2 - Math.max(r / rt, rt / r);
}

function densityMax(k: number, m: number): number {
  if (k >= m) return 2 - (k - 1) / (m - 1);
  return 1;
}

// ── Main algorithm ─────────────────────────────────────────────────

/**
 * Generate "nice" axis breaks like ggplot2.
 *
 * @param dmin  Data minimum
 * @param dmax  Data maximum
 * @param m     Desired number of breaks (hint, not exact)
 * @param Q     Nice-number set (default: same as R's labeling package)
 * @param onlyLoose  If true, breaks must extend beyond data range
 * @param w     Weights: [simplicity, coverage, density, legibility]
 */
export function extendedBreaks(
  dmin: number,
  dmax: number,
  m: number = 5,
  Q: number[] = [1, 5, 2, 2.5, 4, 3],
  onlyLoose: boolean = false,
  w: [number, number, number, number] = [0.25, 0.2, 0.5, 0.05],
): number[] {
  if (dmin > dmax) {
    const tmp = dmin; dmin = dmax; dmax = tmp;
  }

  if (dmax - dmin < EPS) {
    // Degenerate range — return evenly spaced
    const out: number[] = [];
    for (let i = 0; i < m; i++) out.push(dmin + (dmax - dmin) * i / (m - 1 || 1));
    return out;
  }

  const _nQ = Q.length;
  let best = { lmin: dmin, lmax: dmax, lstep: (dmax - dmin) / (m - 1 || 1), score: -2 };

  let j = 1;
  outer:
  while (j < Infinity) {
    for (const q of Q) {
      const sm = simplicityMax(q, Q, j);

      if (w[0] * sm + w[1] + w[2] + w[3] < best.score) {
        break outer;
      }

      let k = 2;
      while (k < Infinity) {
        const dm = densityMax(k, m);

        if (w[0] * sm + w[1] + w[2] * dm + w[3] < best.score) break;

        const delta = (dmax - dmin) / (k + 1) / j / q;
        let z = Math.ceil(Math.log10(delta));

        while (z < Infinity) {
          const step = j * q * Math.pow(10, z);
          const cm = coverageMax(dmin, dmax, step * (k - 1));

          if (w[0] * sm + w[1] * cm + w[2] * dm + w[3] < best.score) break;

          const minStart = Math.floor(dmax / step) * j - (k - 1) * j;
          const maxStart = Math.ceil(dmin / step) * j;

          if (minStart > maxStart) {
            z++;
            continue;
          }

          for (let start = minStart; start <= maxStart; start++) {
            const lmin = start * (step / j);
            const lmax = lmin + step * (k - 1);
            const lstep = step;

            const s = simplicity(q, Q, j, lmin, lmax, lstep);
            const c = coverage(dmin, dmax, lmin, lmax);
            const g = density(k, m, dmin, dmax, lmin, lmax);
            const l = 1; // legibility — constant in R implementation

            const score = w[0] * s + w[1] * c + w[2] * g + w[3] * l;

            if (score > best.score && (!onlyLoose || (lmin <= dmin && lmax >= dmax))) {
              best = { lmin, lmax, lstep, score };
            }
          }
          z++;
        }
        k++;
      }
    }
    j++;
  }

  // Build result sequence
  const result: number[] = [];
  // Use a count-based approach to avoid floating-point drift
  const count = Math.round((best.lmax - best.lmin) / best.lstep);
  for (let i = 0; i <= count; i++) {
    result.push(best.lmin + i * best.lstep);
  }
  return result;
}

/**
 * Compute minor breaks: midpoints between major breaks (ggplot2 default).
 * Only returns minor ticks that fall within [dmin, dmax].
 */
export function minorBreaks(majorBreaks: number[], dmin: number, dmax: number): number[] {
  if (majorBreaks.length < 2) return [];
  const result: number[] = [];
  for (let i = 0; i < majorBreaks.length - 1; i++) {
    const mid = (majorBreaks[i] + majorBreaks[i + 1]) / 2;
    if (mid >= dmin && mid <= dmax) {
      result.push(mid);
    }
  }
  return result;
}

// ── Label formatting ───────────────────────────────────────────────

/**
 * Auto-detect precision like R's scales::precision().
 *
 * Finds the minimum number of decimal places needed to distinguish
 * adjacent break values.
 */
export function precision(breaks: number[]): number {
  const unique = [...new Set(breaks.filter(Number.isFinite))];
  if (unique.length <= 1) return 1;

  unique.sort((a, b) => a - b);
  let smallestDiff = Infinity;
  for (let i = 1; i < unique.length; i++) {
    const d = unique[i] - unique[i - 1];
    if (d > 0 && d < smallestDiff) smallestDiff = d;
  }

  if (smallestDiff < Math.sqrt(Number.EPSILON)) return 1;

  let p = Math.pow(10, Math.floor(Math.log10(smallestDiff)) - 1);

  // Reduce precision when final digit is always 0
  if (unique.every(v => Math.round(v / p) % 10 === 0)) {
    p *= 10;
  }

  return Math.min(p, 1);
}

/**
 * Format break labels with minimal necessary decimal places.
 * Like R's scales::label_number() with accuracy = NULL.
 */
export function formatBreaks(breaks: number[]): string[] {
  const p = precision(breaks);
  const decimals = Math.max(0, -Math.floor(Math.log10(p)));
  return breaks.map(v => v.toFixed(decimals));
}

/**
 * Format break labels with an optional label format.
 * Like R's scales::percent — precision is computed on the scaled values,
 * so 0.05/0.10 become "5%"/"10%" and 0.125 becomes "12.5%".
 */
export function formatBreaksAs(
  breaks: number[],
  format?: LabelFormat,
  opts: FormatOptions = {},
): string[] {
  if (typeof format === 'function') return breaks.map(v => format(v));
  switch (format) {
    case 'percent': return formatPercent(breaks, opts);
    case 'compact': return formatCompact(breaks, opts);
    case 'thousands': return formatThousands(breaks, opts);
    case 'currency': return formatCurrency(breaks, opts);
    default: return formatPlain(breaks, opts);
  }
}
