import { describe, it, expect, beforeEach } from 'vitest';
import { statDensity, STAT_DENSITY_X, STAT_DENSITY_Y } from '../src/stats';
import { densityToScene } from '../src/geoms/density';
import { ggpbi } from '../src/index';
import * as d3 from 'd3';

/** Deterministic pseudo-normal sample (sum of uniforms, mulberry32 seed). */
function normalSample(n: number, mean = 0, sd = 1, seed = 42): number[] {
  let a = seed;
  const rng = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: n }, () => {
    let s = 0;
    for (let i = 0; i < 12; i++) s += rng();
    return mean + sd * (s - 6);
  });
}

describe('statDensity (pure)', () => {
  const sample = normalSample(200, 10, 2);
  const data = sample.map(v => ({ v }));

  it('integrates to ~1 (trapezoid rule over the grid)', () => {
    const rows = statDensity(data, 'v');
    expect(rows.length).toBe(512);

    let integral = 0;
    for (let i = 1; i < rows.length; i++) {
      const dx = (rows[i][STAT_DENSITY_X] as number) - (rows[i - 1][STAT_DENSITY_X] as number);
      integral += dx * (((rows[i][STAT_DENSITY_Y] as number) + (rows[i - 1][STAT_DENSITY_Y] as number)) / 2);
    }
    expect(integral).toBeCloseTo(1, 2);
  });

  it('peaks near the sample mean for symmetric data', () => {
    const rows = statDensity(data, 'v');
    const peak = rows.reduce((best, r) => ((r[STAT_DENSITY_Y] as number) > (best[STAT_DENSITY_Y] as number) ? r : best));
    const mean = sample.reduce((s, v) => s + v, 0) / sample.length;
    expect(Math.abs((peak[STAT_DENSITY_X] as number) - mean)).toBeLessThan(1);
  });

  it('extends the grid ~3 bandwidths beyond the data range (trim clips it)', () => {
    const untrimmed = statDensity(data, 'v');
    const trimmed = statDensity(data, 'v', { trim: true });
    const min = Math.min(...sample);
    const max = Math.max(...sample);
    expect(untrimmed[0][STAT_DENSITY_X] as number).toBeLessThan(min);
    expect(untrimmed[untrimmed.length - 1][STAT_DENSITY_X] as number).toBeGreaterThan(max);
    expect(trimmed[0][STAT_DENSITY_X] as number).toBeCloseTo(min, 6);
    expect(trimmed[trimmed.length - 1][STAT_DENSITY_X] as number).toBeCloseTo(max, 6);
  });

  it('higher adjust smooths the curve (lower peak)', () => {
    const peakOf = (adjust: number) =>
      Math.max(...statDensity(data, 'v', { adjust }).map(r => r[STAT_DENSITY_Y] as number));
    expect(peakOf(4)).toBeLessThan(peakOf(1));
  });

  it('respects a fixed bandwidth and n', () => {
    const rows = statDensity(data, 'v', { bw: 0.5, n: 64 });
    expect(rows.length).toBe(64);
    // cut=3: grid extends exactly 3·bw beyond the data.
    expect(rows[0][STAT_DENSITY_X] as number).toBeCloseTo(Math.min(...sample) - 1.5, 6);
  });

  it('produces one curve per colour group', () => {
    const grouped = [
      ...normalSample(100, 0, 1, 1).map(v => ({ v, g: 'a' })),
      ...normalSample(100, 5, 1, 2).map(v => ({ v, g: 'b' })),
    ];
    const rows = statDensity(grouped, 'v', { n: 100 }, 'g');
    expect(rows.length).toBe(200);
    const groups = new Set(rows.map(r => r.g));
    expect([...groups].sort()).toEqual(['a', 'b']);
  });

  it('skips groups with fewer than 2 observations', () => {
    const rows = statDensity([{ v: 1, g: 'a' }, { v: 2, g: 'b' }, { v: 3, g: 'b' }], 'v', { n: 10 }, 'g');
    expect(new Set(rows.map(r => r.g))).toEqual(new Set(['b']));
  });

  it('ignores null and non-numeric values', () => {
    const rows = statDensity([{ v: 1 }, { v: null }, { v: 'x' }, { v: 2 }, { v: 3 }], 'v', { n: 10 });
    expect(rows.length).toBe(10);
    for (const r of rows) expect(Number.isFinite(r[STAT_DENSITY_Y] as number)).toBe(true);
  });
});

describe('densityToScene (pure, no JSDOM)', () => {
  const xScale = d3.scaleLinear().domain([0, 10]).range([0, 100]);
  const yScale = d3.scaleLinear().domain([0, 1]).range([100, 0]);
  const pts = [0, 2, 4, 6, 8, 10].map(x => ({ x, y: 0.1 + 0.05 * x, data: {} }) as any);

  it('builds a stroke path with no fill by default', () => {
    const nodes = densityToScene(pts, xScale, yScale, { type: 'density' });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].class).toBe('ggpbi-density');
    expect(nodes[0].style.fill).toBe('none');
    expect(nodes[0].d).not.toMatch(/NaN/);
  });

  it('adds an area path closed to the baseline when fill is enabled', () => {
    const nodes = densityToScene(pts, xScale, yScale, { type: 'density', fill: true, fillAlpha: 0.4 });
    expect(nodes).toHaveLength(2);
    expect(nodes[0].class).toBe('ggpbi-density-area');
    expect(nodes[0].style.opacity).toBe(0.4);
    // Area closes down to yScale(0) = 100.
    expect(nodes[0].d).toContain('100');
    expect(nodes[1].class).toBe('ggpbi-density');
  });

  it('uses an explicit fill colour string', () => {
    const nodes = densityToScene(pts, xScale, yScale, { type: 'density', fill: 'pink' });
    expect(nodes[0].style.fill).toBe('pink');
  });
});

describe('geom density (rendered)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders one curve per group with a legend, no NaN', () => {
    const data = [
      ...normalSample(80, 5, 1, 7).map(v => ({ len: v, kind: 'A' })),
      ...normalSample(80, 8, 1, 9).map(v => ({ len: v, kind: 'B' })),
    ];

    const svg = ggpbi()
      .data(data as any)
      .aes({ x: 'len', color: 'kind' })
      .geom('density', { fill: true })
      .size(500, 350)
      .renderTo(container);

    const curves = svg.querySelectorAll('.ggpbi-density');
    const areas = svg.querySelectorAll('.ggpbi-density-area');
    expect(curves.length).toBe(2);
    expect(areas.length).toBe(2);
    expect(svg.innerHTML).not.toMatch(/NaN/);
  });
});
