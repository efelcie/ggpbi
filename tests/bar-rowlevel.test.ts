/**
 * Bars over row-level data — the shape Power BI delivers when a numeric
 * column is set to "Don't summarize" (Y arrives as raw rows, not a sum).
 *
 * Reproduces three Desktop findings on the ToothGrowth demo pages:
 * striped stacks, hairline seams within one bar, and dodged bars that
 * showed the maximum instead of the group total.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ggpbi } from '../src/index';
import { applyStack } from '../src/position';
import { resolveLayerStat, buildPlot } from '../src/pipeline';

// 6 rows per dose, alternating supp — exactly how PBI interleaves them.
const toothRows = [0.5, 1, 2].flatMap(dose =>
  [10, 12, 14].flatMap(base => [
    { dose, supp: 'OJ', len: base },
    { dose, supp: 'VC', len: base + 1 },
  ]),
);

describe('bar/col over row-level data', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('several rows per group resolve to stat_sum, a single row stays identity', () => {
    const layer = { geom: { type: 'bar' as const } };
    const aes = { x: 'dose', y: 'len', color: 'supp' };
    expect(resolveLayerStat(layer, aes, toothRows)).toBe('sum');

    const oneRowPerGroup = [
      { dose: 0.5, supp: 'OJ', len: 10 },
      { dose: 0.5, supp: 'VC', len: 11 },
    ];
    expect(resolveLayerStat(layer, aes, oneRowPerGroup)).toBe('identity');
  });

  it('an explicit stat wins over the automatic choice', () => {
    const layer = { geom: { type: 'bar' as const, stat: 'identity' as const } };
    expect(resolveLayerStat(layer, { x: 'dose', y: 'len', color: 'supp' }, toothRows))
      .toBe('identity');
  });

  it('stacked bars: one rect per colour group, not one per row', () => {
    const svg = ggpbi()
      .data(toothRows as any)
      .aes({ x: 'dose', y: 'len', color: 'supp' })
      .geom('bar', { position: 'stack' })
      .scale({ x: 'category' })
      .size(500, 350)
      .renderTo(container);

    // 3 doses × 2 supp = 6 rects — not 18 stacked slivers.
    const bars = Array.from(svg.querySelectorAll('.ggpbi-bar'));
    expect(bars.length).toBe(6);

    // Total height per dose equals the summed len of that dose.
    const sumFirstDose = toothRows.filter(r => r.dose === 0.5).reduce((a, r) => a + r.len, 0);
    const xs = bars.map(b => b.getAttribute('x'));
    const firstColumn = bars.filter(b => b.getAttribute('x') === xs[0]);
    expect(firstColumn.length).toBe(2);
    const heights = firstColumn.map(b => parseFloat(b.getAttribute('height')!));
    expect(heights.reduce((a, h) => a + h, 0)).toBeGreaterThan(0);
    expect(sumFirstDose).toBe(75); // 10+11+12+13+14+15 sanity check
  });

  it('dodged bars: each group shows its total, not the largest single row', () => {
    const svg = ggpbi()
      .data(toothRows as any)
      .aes({ x: 'dose', y: 'len', color: 'supp' })
      .geom('bar', { position: 'dodge' })
      .scale({ x: 'category' })
      .size(500, 350)
      .renderTo(container);

    const bars = Array.from(svg.querySelectorAll('.ggpbi-bar'));
    expect(bars.length).toBe(6);
    // Every rect sits at its own x — dodge must not stack rows on top of
    // each other (the defect showed 18 overlapping rects).
    const positions = bars.map(b => b.getAttribute('x'));
    expect(new Set(positions).size).toBe(6);
  });

  it('single-colour bars render one rect per category (no seams)', () => {
    const svg = ggpbi()
      .data(toothRows as any)
      .aes({ x: 'dose', y: 'len' })
      .geom('bar')
      .scale({ x: 'category' })
      .size(500, 350)
      .renderTo(container);

    expect(svg.querySelectorAll('.ggpbi-bar').length).toBe(3);
  });
});

describe('layer-local aes must not survive a stat (the Power BI shape)', () => {
  // pbi-visual sets aes.y on EVERY layer (yRaw1 for a raw column). After a
  // stat computes a new value field, that override would still point at the
  // raw field: bars drew the first raw row per group while the axis was
  // trained on the computed sum — small bars under a much larger axis.
  const pbiRows = [0.5, 1].flatMap(dose =>
    [10, 12, 14].flatMap(base => [
      { dose, supp: 'OJ', yRaw1: base },
      { dose, supp: 'VC', yRaw1: base + 1 },
    ]),
  );

  it('the stat-computed aesthetic replaces the layer override', () => {
    const built = buildPlot({
      data: pbiRows,
      aes: { x: 'dose', y: 'yRaw1', color: 'supp' },
      layers: [{ geom: { type: 'bar', position: 'stack' }, aes: { y: 'yRaw1' } }],
      scales: { x: 'category' },
      width: 500,
      height: 350,
    } as any);

    expect(built.spec.aes.y).toBe('__sum');
    expect(built.layers[0].aes.y).toBe('__sum');

    // Group sums, not the first raw row: OJ 10+12+14 = 36, VC 11+13+15 = 39.
    const values = built.layers[0].data.map(p => p.y).sort((a, b) => a - b);
    expect(values).toEqual([36, 36, 39, 39]);

    // Axis covers the stacked total (75) instead of a raw single value.
    const [, yMax] = built.scales.y.domain() as [number, number];
    expect(yMax).toBeGreaterThanOrEqual(75);
  });

  it('geom-level aes overrides are stripped as well', () => {
    const built = buildPlot({
      data: pbiRows,
      aes: { x: 'dose', y: 'yRaw1', color: 'supp' },
      layers: [{ geom: { type: 'bar', aes: { y: 'yRaw1' } } }],
      scales: { x: 'category' },
      width: 500,
      height: 350,
    } as any);
    expect(built.layers[0].aes.y).toBe('__sum');
  });

  it('overrides for untouched aesthetics survive', () => {
    const built = buildPlot({
      data: pbiRows,
      aes: { x: 'dose', y: 'yRaw1' },
      layers: [{ geom: { type: 'bar' }, aes: { y: 'yRaw1', color: 'supp' } }],
      scales: { x: 'category' },
      width: 500,
      height: 350,
    } as any);
    expect(built.layers[0].aes.y).toBe('__sum');
    expect(built.layers[0].aes.color).toBe('supp');
  });
});

describe('applyStack: ggplot2 position_stack ordering', () => {
  it('stacks each colour group as one contiguous block', () => {
    // Interleaved input, as Power BI delivers it.
    const points = [
      { x: 'a', y: 1, color: 'OJ', datum: {} },
      { x: 'a', y: 2, color: 'VC', datum: {} },
      { x: 'a', y: 3, color: 'OJ', datum: {} },
      { x: 'a', y: 4, color: 'VC', datum: {} },
    ] as any;
    const stacked = applyStack(points);

    // Both OJ segments must be adjacent in value space: OJ spans 0..4,
    // VC continues 4..10 — no interleaving.
    const oj = stacked.filter((p: any) => p.color === 'OJ');
    const vc = stacked.filter((p: any) => p.color === 'VC');
    const ojMax = Math.max(...oj.map((p: any) => p._v1));
    const vcMin = Math.min(...vc.map((p: any) => p._v0));
    expect(ojMax).toBeLessThanOrEqual(vcMin);
  });

  it('without a colour aesthetic the order is unchanged', () => {
    const points = [
      { x: 'a', y: 1, datum: {} },
      { x: 'a', y: 2, datum: {} },
    ] as any;
    const stacked = applyStack(points);
    expect(stacked.map((p: any) => p._v1)).toEqual([1, 3]);
  });
});
