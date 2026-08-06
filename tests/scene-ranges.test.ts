/**
 * Tests for segmentsToScene() and pointrangeToScene() — pure geometry, no JSDOM
 * — plus render-level integration for scale training over range aesthetics.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as d3 from 'd3';
import { segmentsToScene } from '../src/geoms/segment';
import { pointrangeToScene } from '../src/geoms/pointrange';
import { ggpbi } from '../src/index';
import type { BoundPoint } from '../src/bind-data';
import type { LineNode, PathNode } from '../src/scene-types';

const xScale = d3.scaleLinear().domain([0, 10]).range([0, 100]);
const yScale = d3.scaleLinear().domain([0, 10]).range([100, 0]);

const bp = (o: Record<string, any>): BoundPoint => ({ datum: o, ...o } as BoundPoint);

describe('segmentsToScene (pure)', () => {
  it('draws one line per row from (x, y) to (xend, yend)', () => {
    const nodes = segmentsToScene(
      [bp({ x: 1, y: 2, xend: 5, yend: 8 })], xScale, yScale, { type: 'segment' },
    );
    expect(nodes.length).toBe(1);
    const n = nodes[0];
    expect(n.x1).toBeCloseTo(10);
    expect(n.y1).toBeCloseTo(80);
    expect(n.x2).toBeCloseTo(50);
    expect(n.y2).toBeCloseTo(20);
  });

  it('missing yend falls back to y — horizontal dumbbell connector', () => {
    const nodes = segmentsToScene(
      [bp({ x: 2, y: 4, xend: 9 })], xScale, yScale, { type: 'segment' },
    );
    expect(nodes[0].y1).toBe(nodes[0].y2);
    expect(nodes[0].x2).toBe(90);
  });

  it('centres endpoints on band scales', () => {
    const band = d3.scaleBand().domain(['a', 'b']).range([0, 100]);
    const nodes = segmentsToScene(
      [bp({ x: 1, y: 'a', xend: 5 })], xScale, band, { type: 'segment' },
    );
    expect(nodes[0].y1).toBe(band('a')! + band.bandwidth() / 2);
  });

  it('skips rows with NA coordinates', () => {
    const nodes = segmentsToScene(
      [bp({ x: NaN, y: 2, xend: 5 }), bp({ x: 1, y: 2, xend: 5 })],
      xScale, yScale, { type: 'segment' },
    );
    expect(nodes.length).toBe(1);
  });

  it('uses the colour scale and supports arrows', () => {
    const cs = d3.scaleOrdinal<string, string>().domain(['g']).range(['#ff0000']);
    const nodes = segmentsToScene(
      [bp({ x: 1, y: 2, xend: 5, color: 'g' })], xScale, yScale,
      { type: 'segment', arrowShow: true }, cs,
    );
    expect(nodes[0].style.stroke).toBe('#ff0000');
    expect(nodes[0].markerEnd?.id).toContain('ggpbi-segment-arrow');
  });
});

describe('pointrangeToScene (pure)', () => {
  it('vertical: range line over ymin→ymax plus a midpoint dot', () => {
    const nodes = pointrangeToScene(
      [bp({ x: 5, y: 5, ymin: 2, ymax: 8 })], xScale, yScale, { type: 'pointrange' },
    );
    const line = nodes.find(n => n.type === 'line') as LineNode;
    const dot = nodes.find(n => n.type === 'path') as PathNode;
    expect(line.x1).toBe(50);
    expect(line.x2).toBe(50);
    const ys = [line.y1, line.y2].sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(20);
    expect(ys[1]).toBeCloseTo(80);
    expect(dot.transform).toBe('translate(50,50)');
  });

  it('horizontal: xmin/xmax draw the range along x', () => {
    const nodes = pointrangeToScene(
      [bp({ x: 5, y: 5, xmin: 1, xmax: 9 })], xScale, yScale, { type: 'pointrange' },
    );
    const line = nodes.find(n => n.type === 'line') as LineNode;
    expect(line.y1).toBe(line.y2);
    expect([line.x1, line.x2].sort((a, b) => a - b)).toEqual([10, 90]);
  });

  it('no range bounds → dot only', () => {
    const nodes = pointrangeToScene(
      [bp({ x: 5, y: 5 })], xScale, yScale, { type: 'pointrange' },
    );
    expect(nodes.filter(n => n.type === 'line').length).toBe(0);
    expect(nodes.filter(n => n.type === 'path').length).toBe(1);
  });

  it('skips rows with NA midpoints', () => {
    const nodes = pointrangeToScene(
      [bp({ x: NaN, y: 5, ymin: 2, ymax: 8 })], xScale, yScale, { type: 'pointrange' },
    );
    expect(nodes.length).toBe(0);
  });
});

describe('range aesthetics end to end', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const dumbbell = [
    { grp: 'Retail', lo: 0.08, hi: 0.35 },
    { grp: 'Grocery', lo: 0.03, hi: 0.09 },
  ];

  it('segment dumbbell: the x domain covers xend even beyond the x field', () => {
    const svg = ggpbi()
      .data(dumbbell as any)
      .aes({ x: 'lo', y: 'grp', xend: 'hi' })
      .geom('segment', { size: 2 })
      .geom('point', { size: 4 })
      .geom('point', { aes: { x: 'hi' }, size: 4 })
      .scale({ y: 'category' })
      .size(500, 300)
      .renderTo(container);

    expect(svg.querySelectorAll('.ggpbi-segment').length).toBe(2);
    expect(svg.querySelectorAll('.ggpbi-point').length).toBe(4);
    // Axis must reach hi=0.35 although aes.x (lo) tops out at 0.08.
    const ticks = Array.from(svg.querySelectorAll('.ggpbi-axis-x text'))
      .map(t => parseFloat(String(t.textContent)))
      .filter(Number.isFinite);
    expect(Math.max(...ticks)).toBeGreaterThanOrEqual(0.3);
  });

  it('pointrange: the y domain covers ymin/ymax', () => {
    const stats = [
      { g: 'a', mean: 5, lo: 1, hi: 9 },
      { g: 'b', mean: 6, lo: 4, hi: 8 },
    ];
    const svg = ggpbi()
      .data(stats as any)
      .aes({ x: 'g', y: 'mean', ymin: 'lo', ymax: 'hi' })
      .geom('pointrange')
      .scale({ x: 'category' })
      .size(500, 300)
      .renderTo(container);

    expect(svg.querySelectorAll('.ggpbi-pointrange-line').length).toBe(2);
    expect(svg.querySelectorAll('.ggpbi-pointrange-dot').length).toBe(2);
    const ticks = Array.from(svg.querySelectorAll('.ggpbi-axis-y text'))
      .map(t => parseFloat(String(t.textContent)))
      .filter(Number.isFinite);
    // Without the range fields the y domain would hug mean 5..6; ymin=1
    // and ymax=9 must widen it well beyond that.
    expect(Math.max(...ticks)).toBeGreaterThan(6);
    expect(Math.min(...ticks)).toBeLessThan(4);
  });
});
