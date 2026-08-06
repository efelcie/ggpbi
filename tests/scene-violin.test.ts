import { describe, it, expect, beforeEach } from 'vitest';
import * as d3 from 'd3';
import { violinToScene } from '../src/geoms/violin';
import { ggpbi } from '../src/index';
import type { BoundPoint } from '../src/bind-data';

/** Deterministic pseudo-normal sample (mulberry32 seed). */
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

const mkPoints = (groups: Record<string, number[]>): BoundPoint[] =>
  Object.entries(groups).flatMap(([x, ys]) =>
    ys.map(y => ({ x, y, data: { x, y } }) as unknown as BoundPoint)
  );

const xBand = d3.scaleBand<string>().domain(['a', 'b']).range([0, 200]);
const yLinear = d3.scaleLinear().domain([-5, 15]).range([300, 0]);

/** Parse "x,y" pairs out of a violin path. */
const pathXs = (d: string): number[] =>
  [...d.matchAll(/([\d.eE+-]+),[\d.eE+-]+/g)].map(m => Number(m[1]));

describe('violinToScene (pure, no JSDOM)', () => {
  const points = mkPoints({
    a: normalSample(60, 2, 1, 1),
    b: normalSample(60, 8, 2, 2),
  });

  it('builds one closed, NaN-free path per category', () => {
    const nodes = violinToScene(points, xBand, yLinear, { type: 'violin' });
    expect(nodes).toHaveLength(2);
    for (const n of nodes) {
      expect(n.class).toBe('ggpbi-violin');
      expect(n.d).toMatch(/^M/);
      expect(n.d).toMatch(/Z$/);
      expect(n.d).not.toMatch(/NaN/);
    }
  });

  it('mirrors each violin symmetrically around its band centre', () => {
    const nodes = violinToScene(points, xBand, yLinear, { type: 'violin' });
    const centerA = xBand('a')! + xBand.bandwidth() / 2;
    const xs = pathXs(nodes[0].d);
    const maxRight = Math.max(...xs) - centerA;
    const maxLeft = centerA - Math.min(...xs);
    expect(maxRight).toBeGreaterThan(1);
    expect(maxRight).toBeCloseTo(maxLeft, 6);
  });

  it("scale 'area' (default): the flatter-distribution violin is narrower", () => {
    // Group b has sd 2 → lower peak density → narrower under equal-area scaling.
    const nodes = violinToScene(points, xBand, yLinear, { type: 'violin' });
    const widthOf = (d: string) => Math.max(...pathXs(d)) - Math.min(...pathXs(d));
    expect(widthOf(nodes[1].d)).toBeLessThan(widthOf(nodes[0].d));
  });

  it("scale 'width': every violin spans the full band width", () => {
    const nodes = violinToScene(points, xBand, yLinear, { type: 'violin', violinScale: 'width' });
    const widthOf = (d: string) => Math.max(...pathXs(d)) - Math.min(...pathXs(d));
    const expected = xBand.bandwidth() * 0.9;
    expect(widthOf(nodes[0].d)).toBeCloseTo(expected, 4);
    expect(widthOf(nodes[1].d)).toBeCloseTo(expected, 4);
  });

  it("scale 'count': fewer observations make a narrower violin", () => {
    const uneven = mkPoints({
      a: normalSample(100, 5, 1, 3),
      b: normalSample(10, 5, 1, 4),
    });
    const nodes = violinToScene(uneven, xBand, yLinear, { type: 'violin', violinScale: 'count' });
    const widthOf = (d: string) => Math.max(...pathXs(d)) - Math.min(...pathXs(d));
    expect(widthOf(nodes[1].d)).toBeLessThan(widthOf(nodes[0].d) / 2);
  });

  it('trim (default) keeps the violin inside the data range; trim=false extends it', () => {
    const ys = normalSample(60, 5, 1, 5);
    const pts = mkPoints({ a: ys });
    const yTop = (d: string) => Math.min(...[...d.matchAll(/[\d.eE+-]+,([\d.eE+-]+)/g)].map(m => Number(m[1])));
    const trimmed = violinToScene(pts, xBand, yLinear, { type: 'violin' });
    const untrimmed = violinToScene(pts, xBand, yLinear, { type: 'violin', trim: false });
    // Screen y is inverted: a smaller minimum y means the shape reaches higher.
    expect(yTop(untrimmed[0].d)).toBeLessThan(yTop(trimmed[0].d));
    expect(yTop(trimmed[0].d)).toBeCloseTo(yLinear(Math.max(...ys)), 4);
  });

  it('skips groups with fewer than 2 observations', () => {
    const nodes = violinToScene(
      mkPoints({ a: [1], b: [1, 2, 3, 4, 5] }),
      xBand, yLinear, { type: 'violin' },
    );
    expect(nodes).toHaveLength(1);
  });
});

describe('geom violin (rendered)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders violins on a categorical x axis without NaN', () => {
    const data = [
      ...normalSample(50, 10, 2, 7).map(v => ({ dose: 'low', len: v })),
      ...normalSample(50, 20, 3, 8).map(v => ({ dose: 'high', len: v })),
    ];

    const svg = ggpbi()
      .data(data as any)
      .aes({ x: 'dose', y: 'len' })
      .geom('violin')
      .size(500, 350)
      .renderTo(container);

    const violins = svg.querySelectorAll('.ggpbi-violin');
    expect(violins.length).toBe(2);
    expect(svg.innerHTML).not.toMatch(/NaN/);
  });

  it('renders a jitter overlay on top of violins (classic combo)', () => {
    const data = [
      ...normalSample(30, 10, 2, 9).map(v => ({ g: 'a', v })),
      ...normalSample(30, 14, 2, 10).map(v => ({ g: 'b', v })),
    ];

    const svg = ggpbi()
      .data(data as any)
      .aes({ x: 'g', y: 'v' })
      .geom('violin')
      .geom('point', { position: 'jitter', jitterWidth: 0.2, alpha: 0.5 })
      .size(500, 350)
      .renderTo(container);

    expect(svg.querySelectorAll('.ggpbi-violin').length).toBe(2);
    expect(svg.querySelectorAll('circle, path.ggpbi-point').length).toBeGreaterThan(30);
    expect(svg.innerHTML).not.toMatch(/NaN/);
  });
});
