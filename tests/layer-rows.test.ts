/**
 * Each layer draws from the rows where its own value is present, and facet
 * panels come from every layer — ggplot2's per-layer remove_missing.
 *
 * The Power BI shape behind it: a month axis, a facet column with "LTM"
 * and "Per month", and one measure per layer that is non-blank in only one
 * of the panels. Power BI delivers one row per (month × panel) whenever
 * any measure is non-blank, so every layer sees rows that belong to
 * another layer. ggpbi 0.5 read the bar layer's month as "two rows per
 * category", summed the global y1 instead, and lost panel and layers.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ggpbi } from '../src/index';
import { resolveLayerStat, buildPlot } from '../src/pipeline';
import { renderVisual, solid } from './helpers/pbi-host';

const months = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(2024, i + 1, 0)));

/** Rows as Power BI delivers them: one per (month × panel). */
function panelRows() {
  const rows: Array<Record<string, unknown>> = [];
  months.forEach((month, i) => {
    rows.push({ month, Panel: 'LTM', y1: 7_000_000 + i * 100_000, y2: null, y3: 7_200_000 });
    rows.push({ month, Panel: 'Per month', y1: null, y2: 600_000 + i * 1_000, y3: null });
  });
  return rows;
}

const layersA = [
  { geom: { type: 'line' as const, size: 2, color: '#416B84' }, aes: { y: 'y1' } },
  { geom: { type: 'bar' as const, color: '#C8C6C4' }, aes: { y: 'y2' } },
  { geom: { type: 'line' as const, size: 1, linetype: 'dashed' as const, color: '#8A8886' }, aes: { y: 'y3' } },
];

describe('stat resolution counts only the layer’s own rows', () => {
  it('a bar layer ignores rows where its value is blank', () => {
    // Without a facet: one row per month carries y2, the other is blank.
    const layer = { geom: { type: 'bar' as const }, aes: { y: 'y2' } };
    expect(resolveLayerStat(layer, { x: 'month', y: 'y1' }, panelRows())).toBe('identity');
  });

  it('every facet panel is its own group', () => {
    const rows = panelRows().map(r => ({ ...r, y2: 1 })); // y2 everywhere
    const layer = { geom: { type: 'bar' as const }, aes: { y: 'y2' } };
    const aes = { x: 'month', y: 'y1' };
    // Two rows per month, but one per (month × panel).
    expect(resolveLayerStat(layer, aes, rows)).toBe('sum');
    expect(resolveLayerStat(layer, aes, rows, { wrap: 'Panel' })).toBe('identity');
  });

  it('a summing stat runs per panel and keeps the facet field', () => {
    const rows = ['A', 'B'].flatMap(Panel => [1, 2].flatMap(x => [
      { x, Panel, v: 1 },
      { x, Panel, v: 2 },
    ]));
    const built = buildPlot({
      data: rows,
      aes: { x: 'x', y: 'v' },
      layers: [{ geom: { type: 'bar' } }],
      facet: { wrap: 'Panel' },
      scales: { x: 'category' },
      width: 400,
      height: 300,
    } as any);
    expect(built.spec.aes.y).toBe('__sum');
    expect(built.data.map(d => `${d.Panel}${d.x}=${d.__sum}`).sort())
      .toEqual(['A1=3', 'A2=3', 'B1=3', 'B2=3']);
  });

  it('a counting stat keeps its facet panels too', () => {
    const rows = [
      { g: 'a', Panel: 'A' }, { g: 'a', Panel: 'A' }, { g: 'b', Panel: 'B' },
    ];
    const built = buildPlot({
      data: rows,
      aes: { x: 'g' },
      layers: [{ geom: { type: 'bar' } }],
      facet: { wrap: 'Panel' },
      width: 400,
      height: 300,
    } as any);
    expect(built.data.map(d => `${d.Panel}:${d.g}=${d.__count}`).sort()).toEqual(['A:a=2', 'B:b=1']);
  });
});

describe('facet panels and scales come from every layer', () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const renderA = (facet: Record<string, unknown> = { wrap: 'Panel', ncol: 1, freeY: true }) =>
    ggpbi()
      .data(panelRows() as any)
      .aes({ x: 'month', y: 'y1' })
      .layer(layersA[0] as any)
      .layer(layersA[1] as any)
      .layer(layersA[2] as any)
      .facet(facet as any)
      .size(640, 480)
      .renderTo(container);

  const panels = (svg: SVGSVGElement) => Array.from(svg.querySelectorAll('.ggpbi-facet'));
  const yLabels = (panel: Element) =>
    Array.from(panel.querySelectorAll('.ggpbi-axis-y text')).map(t => t.textContent ?? '');

  it('draws one panel per level, each with its own layers', () => {
    const svg = renderA();
    const strips = Array.from(svg.querySelectorAll('.ggpbi-facet-strip-wrap')).map(t => t.textContent);
    expect(strips).toEqual(['LTM', 'Per month']);

    const [ltm, perMonth] = panels(svg);
    // LTM: the solid line and the dashed reference, no bars.
    const ltmStrokes = Array.from(ltm.querySelectorAll('.ggpbi-layer-line path'))
      .map(p => p.getAttribute('stroke'));
    expect(ltmStrokes).toEqual(['#416B84', '#8A8886']);
    expect(ltm.querySelectorAll('.ggpbi-bar').length).toBe(0);
    // Per month: six bars in the layer's colour, no lines.
    const bars = Array.from(perMonth.querySelectorAll('.ggpbi-bar'));
    expect(bars.map(b => b.getAttribute('fill'))).toEqual(Array(6).fill('#C8C6C4'));
    expect(perMonth.querySelectorAll('.ggpbi-layer-line path').length).toBe(0);
  });

  it('free y: each panel trains on its own layers’ values', () => {
    const svg = renderA();
    const [ltm, perMonth] = panels(svg);
    const max = (labels: string[]) => Math.max(...labels.map(Number));
    // LTM spans the 7 M line and the 7.2 M reference …
    expect(max(yLabels(ltm))).toBeGreaterThan(7_000_000);
    // … the bar panel stands on zero and tops out near 605 K.
    const barTicks = yLabels(perMonth).map(Number);
    expect(Math.min(...barTicks)).toBe(0);
    expect(max(yLabels(perMonth))).toBeLessThan(1_000_000);
  });

  it('shared y: one domain across all layers and panels', () => {
    const svg = renderA({ wrap: 'Panel', ncol: 1 });
    const [ltm] = panels(svg);
    const ticks = yLabels(ltm).map(Number);
    // Bars put zero into the shared scale, the reference line the top.
    expect(Math.min(...ticks)).toBe(0);
    expect(Math.max(...ticks)).toBeGreaterThanOrEqual(6_000_000);
  });

  it('a blank measure is not zero on an unfaceted axis', () => {
    // The prior-year reference starts blank: the line axis must not
    // stretch down to 0 because Number(null) is 0.
    const rows = months.map((month, i) => ({ month, y1: 7_000_000 + i * 10_000, y2: i < 2 ? null : 7_020_000 }));
    const built = buildPlot({
      data: rows,
      aes: { x: 'month', y: 'y1' },
      layers: [
        { geom: { type: 'line' }, aes: { y: 'y1' } },
        { geom: { type: 'line' }, aes: { y: 'y2' } },
      ],
      width: 400,
      height: 300,
    } as any);
    const [lo] = built.scales.y.domain() as [number, number];
    expect(lo).toBeGreaterThan(6_900_000);
  });

  it('a layer whose global y is blank everywhere still gets a scale', () => {
    const rows = months.map((month, i) => ({ month, y1: null, y2: 100 + i }));
    const built = buildPlot({
      data: rows,
      aes: { x: 'month', y: 'y1' },
      layers: [
        { geom: { type: 'line' }, aes: { y: 'y1' } },
        { geom: { type: 'line' }, aes: { y: 'y2' } },
      ],
      width: 400,
      height: 300,
    } as any);
    const [lo, hi] = built.scales.y.domain() as [number, number];
    expect(lo).toBeLessThanOrEqual(100);
    expect(hi).toBeGreaterThanOrEqual(105);
  });
});

describe('the Power BI visual draws variant A', () => {
  it('shows both panels, the bars and the dashed reference in their colours', () => {
    const month: Date[] = [];
    const panel: string[] = [];
    const y1: Array<number | null> = [];
    const y2: Array<number | null> = [];
    const y3: Array<number | null> = [];
    for (const row of panelRows()) {
      month.push(row.month as Date);
      panel.push(row.Panel as string);
      y1.push(row.y1 as number | null);
      y2.push(row.y2 as number | null);
      y3.push(row.y3 as number | null);
    }
    const { container } = renderVisual({
      categories: [
        { name: 'Month End', role: 'x', values: month },
        { name: 'Panel', role: 'facet', values: panel },
      ],
      measures: [
        { name: 'Sales LTM', values: y1 },
        { name: 'Sales per Month', values: y2 },
        { name: 'Prior year', values: y3 },
      ],
      objects: {
        layer1: { enabled: true, type: 'line', yField: 'y1', size: 2, fill: solid('#416B84') },
        layer2: { enabled: true, type: 'bar', yField: 'y2', fill: solid('#C8C6C4') },
        layer3: { enabled: true, type: 'line', yField: 'y3', size: 1, lineStyle: 'dashed', fill: solid('#8A8886') },
        facet: { columns: 1, freeY: true },
        scaleY: { labelFormat: 'compact' },
      },
    });
    const svg = container.querySelector('svg');
    expect(svg, container.textContent ?? '').not.toBeNull();
    const strips = Array.from(svg!.querySelectorAll('.ggpbi-facet-strip-wrap')).map(t => t.textContent);
    expect(strips).toEqual(['LTM', 'Per month']);
    expect(Array.from(svg!.querySelectorAll('.ggpbi-bar')).map(b => b.getAttribute('fill')))
      .toEqual(Array(6).fill('#C8C6C4'));
    const strokes = Array.from(svg!.querySelectorAll('.ggpbi-layer-line path'))
      .map(p => p.getAttribute('stroke'));
    expect(strokes).toEqual(['#416B84', '#8A8886']);
    const dashed = Array.from(svg!.querySelectorAll('.ggpbi-layer-line path'))
      .filter(p => p.getAttribute('stroke-dasharray'));
    expect(dashed.length).toBe(1);
  });
});
