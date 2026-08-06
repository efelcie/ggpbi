/**
 * Did the host collapse rows before the visual saw them? (#282)
 *
 * Power BI returns the *distinct combinations* of the bound fields, not
 * the underlying rows. Without a field that identifies a row, every
 * observation sharing the same values arrives as one — and a stat that
 * counts rows then counts distinct values instead.
 *
 * The demo report hit exactly this: a histogram of a savings rate with
 * only that column bound counted distinct rates per bin, capping every
 * bar at 10 for one-decimal data. It looked like a plausible plateau.
 *
 * We cannot observe the collapse itself — the lost rows never arrive. We
 * can observe the condition that permits it: no bound field is unique per
 * row. That is what this module reports, and why the wording says *may*.
 */
import type { DataPoint, AesMapping, StatType } from './types';

/**
 * Stats whose result changes when rows are collapsed.
 *
 * Counting and shape-fitting stats read row multiplicity directly. Left
 * out on purpose: `identity` (one mark per returned row, which is what the
 * reader sees anyway) and `smooth` (a fit over distinct points is still a
 * fair fit).
 */
const ROW_COUNTING_STATS: ReadonlySet<StatType> = new Set<StatType>([
  'bin', 'count', 'boxplot', 'density',
]);

/** Geoms that count rows even when their stat is resolved elsewhere. */
const ROW_COUNTING_GEOMS: ReadonlySet<string> = new Set(['histogram', 'boxplot', 'violin', 'density']);

/** Does any bound field hold a distinct value for every row? */
export function hasRowIdentity(data: DataPoint[], fields: string[]): boolean {
  if (data.length <= 1) return true;
  for (const field of fields) {
    const seen = new Set<unknown>();
    for (const row of data) {
      const v = row[field];
      seen.add(v instanceof Date ? v.getTime() : v);
    }
    if (seen.size === data.length) return true;
  }
  return false;
}

/** Every field a spec binds, in aesthetic order, without duplicates. */
export function boundFields(aes: AesMapping): string[] {
  const out: string[] = [];
  for (const value of Object.values(aes)) {
    if (typeof value === 'string' && value && !out.includes(value)) out.push(value);
  }
  return out;
}

/**
 * Should the plot warn that its rows may be pre-aggregated?
 *
 * True only when both halves hold: a stat that reads row multiplicity is
 * in play, and nothing in the wells identifies a row. Either alone is
 * unremarkable — plenty of charts are legitimately built on aggregates.
 */
export function shouldWarnAggregated(
  layers: Array<{ geom: string; stat: StatType }>,
  aes: AesMapping,
  data: DataPoint[],
): boolean {
  const counts = layers.some(
    l => ROW_COUNTING_STATS.has(l.stat) || ROW_COUNTING_GEOMS.has(l.geom),
  );
  if (!counts) return false;
  return !hasRowIdentity(data, boundFields(aes));
}

/** The sentence shown above the panel; kept here next to its reasoning. */
export const AGGREGATION_NOTE =
  'rows may be aggregated — add a unique field to Detail to count rows';
