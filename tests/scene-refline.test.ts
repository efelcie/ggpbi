import { describe, it, expect, beforeEach } from 'vitest';
import * as d3 from 'd3';
import { hlineToScene } from '../src/geoms/hline';
import { vlineToScene } from '../src/geoms/vline';
import { ablineToScene } from '../src/geoms/abline';
import { ggpbi } from '../src/index';

const xLinear = d3.scaleLinear().domain([0, 10]).range([0, 100]);
const yLinear = d3.scaleLinear().domain([0, 10]).range([100, 0]);
const band = d3.scaleBand<string>().domain(['a', 'b']).range([0, 100]);

describe('hlineToScene (pure, no JSDOM)', () => {
  it('draws one full-width line per intercept at the scaled y position', () => {
    const nodes = hlineToScene([], xLinear, yLinear, { type: 'hline', yintercept: 5 }, undefined, 80);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ type: 'line', x1: 0, x2: 80, y1: 50, y2: 50 });
  });

  it('accepts an array of intercepts', () => {
    const nodes = hlineToScene([], xLinear, yLinear, { type: 'hline', yintercept: [2, 8] }, undefined, 80);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].y1).toBeCloseTo(80);
    expect(nodes[1].y1).toBeCloseTo(20);
  });

  it('extrapolates outside the domain (panel clip cuts it, like ggplot2)', () => {
    const nodes = hlineToScene([], xLinear, yLinear, { type: 'hline', yintercept: 20 }, undefined, 80);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].y1).toBe(-100);
  });

  it('skips intercepts a band y scale cannot place', () => {
    const nodes = hlineToScene([], xLinear, band, { type: 'hline', yintercept: 5 }, undefined, 80);
    expect(nodes).toHaveLength(0);
  });

  it('applies color, size, linetype and alpha', () => {
    const [node] = hlineToScene(
      [], xLinear, yLinear,
      { type: 'hline', yintercept: 5, color: 'red', size: 2, linetype: 'dashed', alpha: 0.5 },
      undefined, 80,
    );
    expect(node.style.stroke).toBe('red');
    expect(node.style.strokeWidth).toBe(2);
    expect(node.style.strokeDasharray).toBeTruthy();
    expect(node.style.opacity).toBe(0.5);
  });
});

describe('vlineToScene (pure, no JSDOM)', () => {
  it('draws one full-height line per intercept at the scaled x position', () => {
    const nodes = vlineToScene([], xLinear, yLinear, { type: 'vline', xintercept: 5 }, undefined, 80, 60);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ type: 'line', x1: 50, x2: 50, y1: 0, y2: 60 });
  });

  it('accepts Date intercepts on time scales', () => {
    const time = d3.scaleTime()
      .domain([new Date('2020-01-01'), new Date('2020-12-31')])
      .range([0, 100]);
    const nodes = vlineToScene(
      [], time, yLinear,
      { type: 'vline', xintercept: new Date('2020-07-01') },
      undefined, 80, 60,
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].x1).toBeGreaterThan(40);
    expect(nodes[0].x1).toBeLessThan(60);
  });

  it('skips intercepts a band x scale cannot place', () => {
    const nodes = vlineToScene([], band, yLinear, { type: 'vline', xintercept: 5 }, undefined, 80, 60);
    expect(nodes).toHaveLength(0);
  });
});

describe('ablineToScene (pure, no JSDOM)', () => {
  it('draws y = intercept + slope·x across the x domain', () => {
    // slope 1, intercept 0 on symmetric scales: connects (0,0)→(10,10) in data space.
    const [node] = ablineToScene([], xLinear, yLinear, { type: 'abline', slope: 1, intercept: 0 });
    expect(node).toMatchObject({ x1: 0, y1: 100, x2: 100, y2: 0 });
  });

  it('defaults to slope 1, intercept 0', () => {
    const [node] = ablineToScene([], xLinear, yLinear, { type: 'abline' });
    expect(node).toMatchObject({ x1: 0, y1: 100, x2: 100, y2: 0 });
  });

  it('applies intercept and negative slope', () => {
    const [node] = ablineToScene([], xLinear, yLinear, { type: 'abline', slope: -1, intercept: 10 });
    // (0,10)→(10,0) in data space.
    expect(node).toMatchObject({ x1: 0, y1: 0, x2: 100, y2: 100 });
  });

  it('returns no nodes on band scales', () => {
    expect(ablineToScene([], band, yLinear, { type: 'abline' })).toHaveLength(0);
    expect(ablineToScene([], xLinear, band, { type: 'abline' })).toHaveLength(0);
  });
});

describe('reference lines (rendered)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders hline + vline as overlay layers on a scatter plot', () => {
    const data = [
      { x: 1, y: 1 },
      { x: 5, y: 5 },
      { x: 9, y: 9 },
    ];

    const svg = ggpbi()
      .data(data as any)
      .aes({ x: 'x', y: 'y' })
      .geom('point')
      .geom('hline', { yintercept: 5, linetype: 'dashed', color: 'red' })
      .geom('vline', { xintercept: 5 })
      .size(400, 300)
      .renderTo(container);

    const hline = svg.querySelector('.ggpbi-hline');
    const vline = svg.querySelector('.ggpbi-vline');
    expect(hline).toBeTruthy();
    expect(vline).toBeTruthy();
    expect(hline!.getAttribute('stroke')).toBe('red');
    expect(hline!.getAttribute('y1')).toBe(hline!.getAttribute('y2'));
    expect(vline!.getAttribute('x1')).toBe(vline!.getAttribute('x2'));
    expect(svg.innerHTML).not.toMatch(/NaN/);
  });

  it('renders an abline over a scatter plot', () => {
    const data = [
      { x: 1, y: 2 },
      { x: 5, y: 4 },
      { x: 9, y: 10 },
    ];

    const svg = ggpbi()
      .data(data as any)
      .aes({ x: 'x', y: 'y' })
      .geom('point')
      .geom('abline', { slope: 1, intercept: 0, linetype: 'dotted' })
      .size(400, 300)
      .renderTo(container);

    const abline = svg.querySelector('.ggpbi-abline');
    expect(abline).toBeTruthy();
    expect(svg.innerHTML).not.toMatch(/NaN/);
  });

  it('renders an hline on a bar chart (band x, continuous y)', () => {
    const data = [
      { cat: 'a', v: 3 },
      { cat: 'b', v: 7 },
    ];

    const svg = ggpbi()
      .data(data as any)
      .aes({ x: 'cat', y: 'v' })
      .geom('col')
      .geom('hline', { yintercept: 5 })
      .size(400, 300)
      .renderTo(container);

    expect(svg.querySelector('.ggpbi-hline')).toBeTruthy();
    expect(svg.innerHTML).not.toMatch(/NaN/);
  });
});
