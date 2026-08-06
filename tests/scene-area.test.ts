/**
 * Tests for areaToScene() — pure geometry computation, NO JSDOM needed.
 */
import { describe, it, expect } from 'vitest';
import * as d3 from 'd3';
import { areaToScene } from '../src/geoms/area';
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

const areaData = [
  { t: 1, val: 10 },
  { t: 2, val: 20 },
  { t: 3, val: 15 },
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

describe('areaToScene (pure, no JSDOM)', () => {
  it('produces one PathNode for a single area', () => {
    const points = bind(areaData, 't', 'val');
    const xScale = linearScale([0, 4], [0, 300]);
    const yScale = linearScale([0, 25], [200, 0]);

    const nodes = areaToScene(points, xScale, yScale, { type: 'area' });

    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('path');
    expect(nodes[0].class).toBe('ggpbi-area');
  });

  it('has fill (no stroke) and alpha=0.3 default', () => {
    const points = bind(areaData, 't', 'val');
    const xScale = linearScale([0, 4], [0, 300]);
    const yScale = linearScale([0, 25], [200, 0]);

    const nodes = areaToScene(points, xScale, yScale, { type: 'area' });

    expect(nodes[0].style.fill).toBe('#4682B4'); // GEOM_DEFAULT_COLOR
    expect(nodes[0].style.opacity).toBe(0.3);
  });

  it('applies custom color', () => {
    const points = bind(areaData, 't', 'val');
    const xScale = linearScale([0, 4], [0, 300]);
    const yScale = linearScale([0, 25], [200, 0]);

    const nodes = areaToScene(points, xScale, yScale, {
      type: 'area', color: '#FF0000', alpha: 0.5,
    });

    expect(nodes[0].style.fill).toBe('#FF0000');
    expect(nodes[0].style.opacity).toBe(0.5);
  });

  it('produces one PathNode per color group', () => {
    const points = bind(groupedData, 't', 'val', 'grp');
    const xScale = linearScale([0, 3], [0, 300]);
    const yScale = linearScale([0, 25], [200, 0]);
    const colorScale = d3.scaleOrdinal<string>().domain(['A', 'B']).range(['red', 'blue']);

    const nodes = areaToScene(points, xScale, yScale, { type: 'area' }, colorScale);

    expect(nodes).toHaveLength(2);
    expect(nodes.map(n => n.style.fill)).toContain('red');
    expect(nodes.map(n => n.style.fill)).toContain('blue');
  });

  it('returns empty for empty input', () => {
    const nodes = areaToScene([], d3.scaleLinear(), d3.scaleLinear(), { type: 'area' });
    expect(nodes).toHaveLength(0);
  });

  // "path starts with M" removed — tests SVG format detail, not behavior.
});
