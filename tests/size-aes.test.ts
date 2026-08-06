/**
 * The size aesthetic — ggplot2's `scale_size()`, which is AREA-proportional.
 *
 * Reported as "bubbles all come out at the default size". They did vary,
 * but a linear radius map crushes the low end together: with mtcars hp it
 * left 17 of 32 cars below r = 2.5, and the largest bubble (r = 6) was
 * barely bigger than an ordinary point (r = 4).
 */
import { describe, it, expect } from 'vitest';
import { createSizeScale } from '../src/scales';
import { buildPlot } from '../src/pipeline';
import { ggpbi } from '../src/index';

/** mtcars hp — the data behind the bug report. */
const HP = [110, 110, 93, 110, 175, 105, 245, 62, 95, 123, 123, 180, 180, 180,
  205, 215, 230, 66, 52, 65, 97, 150, 150, 245, 175, 66, 91, 113, 264, 175, 335, 109];
const hpRows = HP.map(hp => ({ hp }));

function container(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 600 });
  Object.defineProperty(el, 'clientHeight', { value: 400 });
  document.body.appendChild(el);
  return el;
}

describe('createSizeScale', () => {
  it('scales by area, like ggplot2 area_pal', () => {
    // radius = rMin + (rMax - rMin) · √t, with t the value normalised to
    // [0, 1] — NOT a linear ramp on the radius.
    const scale = createSizeScale([{ v: 0 }, { v: 100 }], 'v', [0, 10]);
    expect(scale(0)).toBeCloseTo(0, 6);
    expect(scale(100)).toBeCloseTo(10, 6);
    expect(scale(25)).toBeCloseTo(5, 6);   // √0.25 = 0.5 — linear would give 2.5
    expect(scale(50)).toBeCloseTo(7.071, 3);
  });

  it('gives the drawn areas the same ratio as the values', () => {
    // The point of area scaling: twice the value looks twice as big.
    const scale = createSizeScale([{ v: 0 }, { v: 100 }], 'v', [0, 10]);
    const area = (v: number) => Math.PI * scale(v) ** 2;
    expect(area(50) / area(25)).toBeCloseTo(2, 6);
  });

  it('spreads the low end instead of crushing it', () => {
    const scale = createSizeScale(hpRows, 'hp');
    const tiny = HP.filter(v => scale(v) < 3).length;
    expect(tiny, 'most cars must not collapse to the same dot').toBeLessThan(HP.length / 3);
  });

  it('makes the largest bubble clearly larger than a plain point', () => {
    // The default point radius is 4; a bubble chart whose maximum is 6 does
    // not read as one.
    const scale = createSizeScale(hpRows, 'hp');
    expect(scale(Math.max(...HP))).toBeGreaterThan(4 * 2);
  });

  it('keeps the range ends exact', () => {
    const scale = createSizeScale(hpRows, 'hp', [2, 12]);
    expect(scale(Math.min(...HP))).toBeCloseTo(2, 6);
    expect(scale(Math.max(...HP))).toBeCloseTo(12, 6);
  });

  it('handles a constant field and non-numeric values', () => {
    const flat = createSizeScale([{ v: 5 }, { v: 5 }], 'v', [2, 12]);
    expect(flat(5)).toBe(7);
    const scale = createSizeScale(hpRows, 'hp');
    expect(Number.isFinite(scale(NaN as unknown as number))).toBe(true);
  });

  it('still exposes domain and range', () => {
    const scale = createSizeScale(hpRows, 'hp', [2, 12]);
    expect(scale.domain()).toEqual([52, 335]);
    expect(scale.range()).toEqual([2, 12]);
  });
});

describe('the size aesthetic through the pipeline', () => {
  const rows = [
    { wt: 2.6, mpg: 21, hp: 110 },
    { wt: 3.2, mpg: 22.8, hp: 52 },
    { wt: 3.4, mpg: 18.1, hp: 335 },
  ];

  it('binds a radius per row', () => {
    const built = buildPlot({
      data: rows,
      aes: { x: 'wt', y: 'mpg', size: 'hp' },
      layers: [{ geom: { type: 'point' } }],
      width: 600, height: 400,
    } as any);
    const sizes = built.layers[0].data.map((d: any) => d.size);
    expect(new Set(sizes).size).toBe(3);
    expect(Math.max(...sizes)).toBeGreaterThan(Math.min(...sizes) * 2);
  });

  it('survives the Power BI shape: per-layer aes and an explicit geom size', () => {
    // Power BI sets aes.size on every layer and may pass a Size slider
    // value — neither may override the mapped field.
    const built = buildPlot({
      data: rows,
      aes: { x: 'wt', y: 'mpg', size: 'hp' },
      layers: [{ geom: { type: 'point', size: 10 }, aes: { y: 'mpg', size: 'hp' } }],
      width: 600, height: 400,
    } as any);
    const sizes = built.layers[0].data.map((d: any) => d.size);
    expect(new Set(sizes).size).toBe(3);
    expect(sizes).not.toContain(10);
  });

  it('renders marks of visibly different area', () => {
    const svg = ggpbi().data(rows).aes({ x: 'wt', y: 'mpg', size: 'hp' })
      .geom('point').size(600, 400).renderTo(container());
    const paths = [...svg.querySelectorAll('.ggpbi-point')];
    expect(paths.length).toBe(3);
    expect(new Set(paths.map(p => p.getAttribute('d'))).size).toBe(3);
  });
});
