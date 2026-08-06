/**
 * Aggregation warning (#282).
 *
 * Power BI returns distinct combinations of the bound fields, so a chart
 * that counts rows counts distinct values instead unless something in the
 * wells identifies a row. Reproduces the demo report's histogram trap.
 */
import { describe, it, expect } from 'vitest';
import { hasRowIdentity, boundFields, shouldWarnAggregated, AGGREGATION_NOTE } from '../src/row-identity';
import { buildPlot } from '../src/pipeline';

/** The real economics savings rate: many months share a one-decimal value. */
const psavert = [12.6, 12.6, 11.9, 12.9, 12.8, 11.8, 11.7, 12.3, 11.7, 12.3, 12.9, 12.6];
const collapsed = [...new Set(psavert)].map(v => ({ psavert: v }));
const withDate = psavert.map((v, i) => ({ psavert: v, date: new Date(2000, i, 1) }));

describe('hasRowIdentity', () => {
  it('finds a field that is unique per row', () => {
    expect(hasRowIdentity(withDate, ['psavert', 'date'])).toBe(true);
  });

  it('reports none when every field repeats', () => {
    expect(hasRowIdentity(psavert.map(v => ({ psavert: v })), ['psavert'])).toBe(false);
  });

  it('compares dates by value, not by object identity', () => {
    // Two Date objects for the same instant are the same row key; without
    // this every date column would look unique and silence the warning.
    const sameDay = [
      { d: new Date(2020, 0, 1) },
      { d: new Date(2020, 0, 1) },
      { d: new Date(2020, 0, 2) },
    ];
    expect(hasRowIdentity(sameDay, ['d'])).toBe(false);
  });

  it('treats a single row as identified', () => {
    expect(hasRowIdentity([{ a: 1 }], ['a'])).toBe(true);
  });
});

describe('boundFields', () => {
  it('lists each bound field once', () => {
    expect(boundFields({ x: 'a', y: 'b', color: 'a', label: 'c' } as any)).toEqual(['a', 'b', 'c']);
  });
});

describe('shouldWarnAggregated', () => {
  const noIdentity = psavert.map(v => ({ psavert: v }));

  it('warns for a histogram without a row identity', () => {
    expect(shouldWarnAggregated(
      [{ geom: 'histogram', stat: 'bin' }], { x: 'psavert' } as any, noIdentity,
    )).toBe(true);
  });

  it('stays quiet once a unique field is bound', () => {
    expect(shouldWarnAggregated(
      [{ geom: 'histogram', stat: 'bin' }], { x: 'psavert', detail: 'date' } as any, withDate,
    )).toBe(false);
  });

  it('stays quiet for stats that do not read row multiplicity', () => {
    // A scatter shows one mark per returned row — what the reader sees is
    // what arrived, so there is nothing hidden to announce.
    expect(shouldWarnAggregated(
      [{ geom: 'point', stat: 'identity' }], { x: 'psavert' } as any, noIdentity,
    )).toBe(false);
    expect(shouldWarnAggregated(
      [{ geom: 'line', stat: 'smooth' }], { x: 'psavert' } as any, noIdentity,
    )).toBe(false);
  });

  it('covers the other row-counting geoms', () => {
    for (const geom of ['boxplot', 'violin', 'density']) {
      expect(shouldWarnAggregated(
        [{ geom, stat: 'identity' }], { x: 'psavert' } as any, noIdentity,
      ), geom).toBe(true);
    }
  });

  it('warns for count bars — the classic silent miscount', () => {
    // "Count of rows by cyl" with only cyl bound returns 3 rows, so the
    // bars read 1, 1, 1 instead of 11, 7, 14.
    const cyl = [4, 4, 6, 6, 8, 8, 8].map(v => ({ cyl: v }));
    expect(shouldWarnAggregated(
      [{ geom: 'bar', stat: 'count' }], { x: 'cyl' } as any, cyl,
    )).toBe(true);
  });
});

describe('the notice in a built plot', () => {
  const spec = (extra: Record<string, unknown>) => ({
    data: psavert.map(v => ({ psavert: v })),
    aes: { x: 'psavert' },
    layers: [{ geom: { type: 'histogram' as const } }],
    width: 800,
    height: 600,
    ...extra,
  });

  it('is off unless asked for', () => {
    const built = buildPlot(spec({}) as any);
    expect(built.subtitleText ?? '').not.toMatch(/aggregated/);
  });

  it('appears with warnAggregated, even with descriptions off', () => {
    const built = buildPlot(spec({ warnAggregated: true }) as any);
    expect(built.subtitleText).toContain(AGGREGATION_NOTE);
  });

  it('joins the description rather than replacing it', () => {
    const built = buildPlot(spec({ warnAggregated: true, subtitle: 'auto' }) as any);
    expect(built.subtitleText).toMatch(/^Histogram of psavert/);
    expect(built.subtitleText).toContain(AGGREGATION_NOTE);
  });

  it('and stacks with the truncation notice', () => {
    const built = buildPlot(spec({ warnAggregated: true, truncation: { shown: 30000 } }) as any);
    expect(built.subtitleText).toMatch(/sample of 30,000 rows/);
    expect(built.subtitleText).toContain(AGGREGATION_NOTE);
  });

  it('reserves layout space for a notice-only line', () => {
    const withNote = buildPlot(spec({ warnAggregated: true }) as any);
    const without = buildPlot(spec({}) as any);
    expect(withNote.layout.margin.top).toBeGreaterThan(without.layout.margin.top);
  });

  it('says nothing when a row identity is bound', () => {
    const built = buildPlot({
      data: withDate,
      aes: { x: 'psavert', detail: 'date' },
      layers: [{ geom: { type: 'histogram' as const } }],
      width: 800,
      height: 600,
      warnAggregated: true,
    } as any);
    expect(built.subtitleText ?? '').not.toMatch(/aggregated/);
  });
});
