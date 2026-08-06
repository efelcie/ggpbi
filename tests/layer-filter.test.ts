/**
 * Per-layer row filter (dumbbell charts) + label templates + cross-layer repel.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as d3 from 'd3';
import { ggpbi } from '../src/index';
import { applyLayerFilter } from '../src/pipeline';
import { renderLabelTemplate, textToScene } from '../src/geoms/text';
import type { PanelSharedState } from '../src/scene-types';

const ocr = [
  { branche: 'Retail', tenant: 'Kik', ocr: 0.35 },
  { branche: 'Retail', tenant: 'Pepco', ocr: 0.08 },
  { branche: 'Retail', tenant: 'TEDi', ocr: 0.14 },
  { branche: 'Grocery', tenant: 'SPAR', ocr: 0.09 },
  { branche: 'Grocery', tenant: 'Hofer', ocr: 0.04 },
];

describe('applyLayerFilter (pure)', () => {
  const aes = { x: 'ocr', y: 'branche' };

  it('no filter returns the same array', () => {
    expect(applyLayerFilter(ocr, { type: 'point' } as any, aes)).toBe(ocr);
  });

  it('function filter keeps matching rows', () => {
    const out = applyLayerFilter(ocr, { type: 'point', filter: (d: any) => d.ocr > 0.1 } as any, aes);
    expect(out.map(d => d.tenant)).toEqual(['Kik', 'TEDi']);
  });

  it("'min' keeps the lowest row per discrete-y group", () => {
    const out = applyLayerFilter(ocr, { type: 'point', filter: 'min' } as any, aes);
    expect(out.map(d => d.tenant).sort()).toEqual(['Hofer', 'Pepco']);
  });

  it("'max' keeps the highest row per discrete-y group", () => {
    const out = applyLayerFilter(ocr, { type: 'point', filter: 'max' } as any, aes);
    expect(out.map(d => d.tenant).sort()).toEqual(['Kik', 'SPAR']);
  });

  it("'extremes' keeps both ends per group", () => {
    const out = applyLayerFilter(ocr, { type: 'point', filter: 'extremes' } as any, aes);
    expect(out.map(d => d.tenant).sort()).toEqual(['Hofer', 'Kik', 'Pepco', 'SPAR']);
  });

  it('vertical orientation: discrete x groups, extremes on y', () => {
    const data = [
      { g: 'a', v: 1 }, { g: 'a', v: 9 }, { g: 'a', v: 5 },
      { g: 'b', v: 3 }, { g: 'b', v: 7 },
    ];
    const out = applyLayerFilter(data, { type: 'point', filter: 'max' } as any, { x: 'g', y: 'v' });
    expect(out.map(d => d.v).sort()).toEqual([7, 9]);
  });

  it('numeric y groups honour a declared category scale', () => {
    const data = [
      { cyl: 4, mpg: 22 }, { cyl: 4, mpg: 34 },
      { cyl: 8, mpg: 10 }, { cyl: 8, mpg: 19 },
    ];
    const out = applyLayerFilter(
      data, { type: 'point', filter: 'min' } as any,
      { x: 'mpg', y: 'cyl' }, { y: 'category' },
    );
    expect(out.map(d => d.mpg).sort()).toEqual([10, 22]);
  });

  it('both axes continuous: groups by the color aesthetic', () => {
    const data = [
      { x: 1, y: 5, s: 'a' }, { x: 2, y: 9, s: 'a' },
      { x: 3, y: 2, s: 'b' }, { x: 4, y: 4, s: 'b' },
    ];
    const out = applyLayerFilter(data, { type: 'point', filter: 'max' } as any, { x: 'x', y: 'y', color: 's' });
    expect(out.map(d => d.y).sort()).toEqual([4, 9]);
  });

  it('rows with NA on the value axis never win', () => {
    const data = [
      { g: 'a', v: null }, { g: 'a', v: 3 }, { g: 'a', v: NaN },
    ];
    const out = applyLayerFilter(data as any, { type: 'point', filter: 'max' } as any, { x: 'g', y: 'v' });
    expect(out.map(d => d.v)).toEqual([3]);
  });
});

describe('renderLabelTemplate', () => {
  const bp: any = { label: 'SPAR', x: 0.085, y: 'Grocery' };

  it('substitutes label, x and y', () => {
    expect(renderLabelTemplate('{label}: {y}', bp)).toBe('SPAR: Grocery');
  });

  it('formats numbers with a d3-format spec', () => {
    expect(renderLabelTemplate('{label} {x:.1%}', bp)).toBe('SPAR 8.5%');
  });

  it('missing values become empty strings', () => {
    expect(renderLabelTemplate('[{label}]', { x: 1, y: 2 } as any)).toBe('[]');
  });

  it('an invalid format spec falls back to the raw value', () => {
    expect(renderLabelTemplate('{x:nonsense}', bp)).toBe('0.085');
  });

  it('format specs are ignored for non-numeric values', () => {
    expect(renderLabelTemplate('{y:.1%}', bp)).toBe('Grocery');
  });
});

describe('cross-layer repel coordination', () => {
  const xScale = d3.scaleLinear().domain([0, 10]).range([0, 400]);
  const yScale = d3.scaleLinear().domain([0, 10]).range([300, 0]);

  it('a second text layer avoids the first layer’s label boxes', () => {
    // Two layers labelling the SAME point — without shared state both
    // would sit at the identical preferred position.
    const layer1 = bindPoints([{ x: 5, y: 5, label: 'AAAAAA' }]);
    const layer2 = bindPoints([{ x: 5, y: 5, label: 'BBBBBB' }]);
    const shared: PanelSharedState = { repelPlaced: [], repelAnchors: [] };
    const cfg: any = { type: 'text', repel: true };

    const nodes1 = textToScene(layer1, xScale, yScale, cfg, undefined, 400, 300, shared);
    const nodes2 = textToScene(layer2, xScale, yScale, cfg, undefined, 400, 300, shared);

    const t1 = nodes1.find(n => n.type === 'text') as any;
    const t2 = nodes2.find(n => n.type === 'text') as any;
    expect(t1).toBeTruthy();
    expect(t2).toBeTruthy();
    const dist = Math.hypot(t1.x - t2.x, t1.y - t2.y);
    expect(dist).toBeGreaterThan(10);
  });

  it('without shared state both layers pick the same spot (the old defect)', () => {
    const layer1 = bindPoints([{ x: 5, y: 5, label: 'AAAAAA' }]);
    const layer2 = bindPoints([{ x: 5, y: 5, label: 'BBBBBB' }]);
    const cfg: any = { type: 'text', repel: true };
    const t1 = textToScene(layer1, xScale, yScale, cfg, undefined, 400, 300).find(n => n.type === 'text') as any;
    const t2 = textToScene(layer2, xScale, yScale, cfg, undefined, 400, 300).find(n => n.type === 'text') as any;
    expect(t1.x).toBe(t2.x);
    expect(t1.y).toBe(t2.y);
  });

  function bindPoints(rows: Array<{ x: number; y: number; label: string }>) {
    return rows.map(r => ({ x: r.x, y: r.y, label: r.label, data: r } as any));
  }
});

describe('dumbbell chart end to end', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('line + min/max points + templated labels render the full dumbbell', () => {
    const svg = ggpbi()
      .data(ocr as any)
      .aes({ x: 'ocr', y: 'branche', label: 'tenant' })
      .geom('line', { color: '#C8D0D9', size: 2 })
      .geom('point', { filter: 'min', color: '#4E79A7', size: 5 })
      .geom('point', { filter: 'max', color: '#F28E2B', size: 5 })
      .geom('text', { filter: 'min', repel: true, color: '#4E79A7', labelTemplate: '{label} {x:.1%}' })
      .geom('text', { filter: 'max', repel: true, color: '#F28E2B', labelTemplate: '{label} {x:.1%}' })
      .scale({ x: { labels: 'percent' } })
      .size(640, 420)
      .renderTo(container);

    // One segment per Branche.
    const segments = svg.querySelectorAll('.ggpbi-layer-line .ggpbi-line');
    expect(segments.length).toBe(2);

    // Two dots per Branche: one blue (min), one orange (max).
    const fills = Array.from(svg.querySelectorAll('.ggpbi-point')).map(p => p.getAttribute('fill'));
    expect(fills.filter(c => c === '#4E79A7').length).toBe(2);
    expect(fills.filter(c => c === '#F28E2B').length).toBe(2);

    // Templated labels: name + percent value.
    const labels = Array.from(svg.querySelectorAll('.ggpbi-geom-clip text')).map(t => t.textContent);
    expect(labels.sort()).toEqual(['Hofer 4.0%', 'Kik 35.0%', 'Pepco 8.0%', 'SPAR 9.0%']);
  });

  it('scales still train on the full data — the min layer does not shrink the x domain', () => {
    const svg = ggpbi()
      .data(ocr as any)
      .aes({ x: 'ocr', y: 'branche' })
      .geom('point', { filter: 'min', size: 5 })
      .size(640, 420)
      .renderTo(container);

    // Axis must still cover Kik's 0.35 even though only min rows are drawn.
    const ticks = Array.from(svg.querySelectorAll('.ggpbi-axis-x text')).map(t => t.textContent);
    const maxTick = Math.max(...ticks.map(t => parseFloat(String(t))).filter(Number.isFinite));
    expect(maxTick).toBeGreaterThanOrEqual(0.3);
  });
});
