/**
 * Tests for linesToScene() — pure geometry computation, NO JSDOM needed.
 */
import { describe, it, expect } from 'vitest';
import * as d3 from 'd3';
import { linesToScene } from '../src/geoms/line';
import { bindData, type BoundPoint } from '../src/bind-data';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function linearScale(domain: [number, number], range: [number, number]) {
  return d3.scaleLinear().domain(domain).range(range);
}

function bind(data: Record<string, any>[], x: string, y: string, color?: string): BoundPoint[] {
  return bindData(data, { x, y, color });
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const timeSeriesData = [
  { t: 1, val: 10 },
  { t: 2, val: 20 },
  { t: 3, val: 15 },
  { t: 4, val: 25 },
];

const groupedData = [
  { t: 1, val: 10, grp: 'A' },
  { t: 2, val: 20, grp: 'A' },
  { t: 1, val: 5, grp: 'B' },
  { t: 2, val: 15, grp: 'B' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('linesToScene (pure, no JSDOM)', () => {
  it('produces one PathNode for a single line', () => {
    const points = bind(timeSeriesData, 't', 'val');
    const xScale = linearScale([0, 5], [0, 300]);
    const yScale = linearScale([0, 30], [200, 0]);

    const nodes = linesToScene(points, xScale, yScale, { type: 'line' });

    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('path');
    expect(nodes[0].class).toBe('ggpbi-line');
  });

  it('path string starts with M (valid SVG path)', () => {
    const points = bind(timeSeriesData, 't', 'val');
    const xScale = linearScale([0, 5], [0, 300]);
    const yScale = linearScale([0, 30], [200, 0]);

    const nodes = linesToScene(points, xScale, yScale, { type: 'line' });

    expect(nodes[0].d[0]).toBe('M');
    expect(nodes[0].d.length).toBeGreaterThan(10);
  });

  it('has fill=none and stroke styling', () => {
    const points = bind(timeSeriesData, 't', 'val');
    const xScale = linearScale([0, 5], [0, 300]);
    const yScale = linearScale([0, 30], [200, 0]);

    const nodes = linesToScene(points, xScale, yScale, {
      type: 'line', color: '#FF0000', size: 3,
    });

    expect(nodes[0].style.fill).toBe('none');
    expect(nodes[0].style.stroke).toBe('#FF0000');
    expect(nodes[0].style.strokeWidth).toBe(3);
  });

  it('applies dasharray for dashed linetype', () => {
    const points = bind(timeSeriesData, 't', 'val');
    const xScale = linearScale([0, 5], [0, 300]);
    const yScale = linearScale([0, 30], [200, 0]);

    const nodes = linesToScene(points, xScale, yScale, {
      type: 'line', linetype: 'dashed',
    });

    expect(nodes[0].style.strokeDasharray).toBe('6 4');
  });

  it('produces one PathNode per color group', () => {
    const points = bind(groupedData, 't', 'val', 'grp');
    const xScale = linearScale([0, 3], [0, 300]);
    const yScale = linearScale([0, 25], [200, 0]);
    const colorScale = d3.scaleOrdinal<string>().domain(['A', 'B']).range(['red', 'blue']);

    const nodes = linesToScene(points, xScale, yScale, { type: 'line' }, colorScale);

    expect(nodes).toHaveLength(2);
    const colors = nodes.map(n => n.style.stroke);
    expect(colors).toContain('red');
    expect(colors).toContain('blue');
  });

  it('centers horizontal strip lines on categorical y bands', () => {
    const points = bind([
      { x: 20, y: 'Retail' },
      { x: 80, y: 'Retail' },
    ], 'x', 'y');
    const xScale = linearScale([0, 100], [0, 200]);
    const yScale = d3.scaleBand().domain(['Retail', 'Health']).range([0, 100]);

    const nodes = linesToScene(points, xScale, yScale, { type: 'line' });

    expect(nodes).toHaveLength(1);
    expect(nodes[0].d).toBe('M40,25L160,25');
  });

  it('draws one line per categorical y group in horizontal strip plots', () => {
    const points = bind([
      { x: 20, y: 'Retail' },
      { x: 80, y: 'Retail' },
      { x: 10, y: 'Health' },
      { x: 60, y: 'Health' },
    ], 'x', 'y');
    const xScale = linearScale([0, 100], [0, 200]);
    const yScale = d3.scaleBand().domain(['Retail', 'Health']).range([0, 100]);

    const nodes = linesToScene(points, xScale, yScale, { type: 'line' });

    expect(nodes).toHaveLength(2);
    expect(nodes.map(n => n.d)).toContain('M40,25L160,25');
    expect(nodes.map(n => n.d)).toContain('M20,75L120,75');
  });

  it('NA values create gaps (multiple segments)', () => {
    const data = [
      { t: 1, val: 10 },
      { t: 2, val: null },
      { t: 3, val: 15 },
      { t: 4, val: 25 },
    ];
    const points = bind(data, 't', 'val');
    const xScale = linearScale([0, 5], [0, 300]);
    const yScale = linearScale([0, 30], [200, 0]);

    const nodes = linesToScene(points, xScale, yScale, { type: 'line' });

    // Should split into 2 segments: [t=1] and [t=3, t=4]
    // First segment has only 1 point → skipped (< 2 needed for a line)
    // Second segment has 2 points → one PathNode
    expect(nodes).toHaveLength(1);
  });

  it('naRm=true filters NA silently', () => {
    const data = [
      { t: 1, val: 10 },
      { t: 2, val: null },
      { t: 3, val: 15 },
      { t: 4, val: 25 },
    ];
    const points = bind(data, 't', 'val');
    const xScale = linearScale([0, 5], [0, 300]);
    const yScale = linearScale([0, 30], [200, 0]);

    const nodes = linesToScene(points, xScale, yScale, { type: 'line', naRm: true });

    // naRm: all valid points merged → one line through t=1,3,4
    expect(nodes).toHaveLength(1);
  });

  it('returns empty for empty input', () => {
    const nodes = linesToScene([], d3.scaleLinear(), d3.scaleLinear(), { type: 'line' });
    expect(nodes).toHaveLength(0);
  });

  it('needs at least 2 points to produce a line', () => {
    const points = bind([{ t: 1, val: 10 }], 't', 'val');
    const xScale = linearScale([0, 5], [0, 300]);
    const yScale = linearScale([0, 30], [200, 0]);

    const nodes = linesToScene(points, xScale, yScale, { type: 'line' });

    expect(nodes).toHaveLength(0); // single point = no line segment
  });
});
