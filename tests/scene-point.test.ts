/**
 * Tests for pointsToScene() — pure geometry computation, NO JSDOM needed.
 *
 * These tests prove the SceneGraph architecture: geom logic is testable
 * without a DOM. We only need D3 scales (which are pure functions).
 */
import { describe, it, expect } from 'vitest';
import * as d3 from 'd3';
import { pointsToScene } from '../src/geoms/point';
import { bindData, type BoundPoint } from '../src/bind-data';
import type { GeomConfig } from '../src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function linearScale(domain: [number, number], range: [number, number]) {
  return d3.scaleLinear().domain(domain).range(range);
}

function bindPointData(
  data: Record<string, any>[],
  xField: string,
  yField: string,
  colorField?: string,
): BoundPoint[] {
  return bindData(data, { x: xField, y: yField, color: colorField });
}

function parseTranslate(transform: string): [number, number] {
  const match = transform.match(/^translate\(([-\d.]+),([-\d.]+)\)$/);
  if (!match) throw new Error(`Invalid transform: ${transform}`);
  return [Number(match[1]), Number(match[2])];
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const scatterData = [
  { x: 1, y: 10 },
  { x: 2, y: 20 },
  { x: 3, y: 15 },
  { x: 4, y: 25 },
];

const coloredData = [
  { x: 1, y: 10, group: 'A' },
  { x: 2, y: 20, group: 'B' },
  { x: 3, y: 15, group: 'A' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pointsToScene (pure, no JSDOM)', () => {
  describe('basic rendering', () => {
    it('produces one PathNode per data point', () => {
      const points = bindPointData(scatterData, 'x', 'y');
      const xScale = linearScale([0, 5], [0, 300]);
      const yScale = linearScale([0, 30], [200, 0]);

      const nodes = pointsToScene(points, xScale, yScale, { type: 'point' });

      expect(nodes).toHaveLength(4);
      expect(nodes.every(n => n.type === 'path')).toBe(true);
      expect(nodes.every(n => n.class === 'ggpbi-point')).toBe(true);
    });

    it('each node has a valid SVG path string', () => {
      const points = bindPointData(scatterData, 'x', 'y');
      const xScale = linearScale([0, 5], [0, 300]);
      const yScale = linearScale([0, 30], [200, 0]);

      const nodes = pointsToScene(points, xScale, yScale, { type: 'point' });

      for (const n of nodes) {
        expect(n.d).toBeTruthy();
        expect(n.d.length).toBeGreaterThan(0);
        // d3.symbol paths start with 'M'
        expect(n.d[0]).toBe('M');
      }
    });

    it('each node has a translate transform', () => {
      const points = bindPointData(scatterData, 'x', 'y');
      const xScale = linearScale([0, 5], [0, 300]);
      const yScale = linearScale([0, 30], [200, 0]);

      const nodes = pointsToScene(points, xScale, yScale, { type: 'point' });

      for (const n of nodes) {
        expect(n.transform).toMatch(/^translate\(.+,.+\)$/);
      }
    });

    it('transforms reflect scaled data positions', () => {
      const points = bindPointData([{ x: 0, y: 0 }, { x: 5, y: 30 }], 'x', 'y');
      const xScale = linearScale([0, 5], [0, 300]);
      const yScale = linearScale([0, 30], [200, 0]);

      const nodes = pointsToScene(points, xScale, yScale, { type: 'point' });

      // First point at (0,0) → translate(0, 200)
      expect(nodes[0].transform).toBe('translate(0,200)');
      // Second point at (5,30) → translate(300, 0)
      expect(nodes[1].transform).toBe('translate(300,0)');
    });

    it('centers points on categorical y bands for horizontal strip plots', () => {
      const points = bindPointData([{ x: 25, y: 'Retail' }], 'x', 'y');
      const xScale = linearScale([0, 100], [0, 200]);
      const yScale = d3.scaleBand().domain(['Retail', 'Health']).range([0, 100]);

      const nodes = pointsToScene(points, xScale, yScale, { type: 'point' });

      expect(nodes[0].transform).toBe('translate(50,25)');
    });

    it('preserves original BoundPoint in .data', () => {
      const points = bindPointData(scatterData, 'x', 'y');
      const xScale = linearScale([0, 5], [0, 300]);
      const yScale = linearScale([0, 30], [200, 0]);

      const nodes = pointsToScene(points, xScale, yScale, { type: 'point' });

      expect(nodes[0].data).toBeDefined();
      expect(nodes[0].data!.x).toBe(1);
      expect(nodes[0].data!.y).toBe(10);
    });
  });

  describe('style', () => {
    it('applies default fill (steelblue) for filled shapes', () => {
      const points = bindPointData(scatterData, 'x', 'y');
      const xScale = linearScale([0, 5], [0, 300]);
      const yScale = linearScale([0, 30], [200, 0]);

      const nodes = pointsToScene(points, xScale, yScale, { type: 'point' });

      // Default shape is circle (filled) → fill = defaultColor
      for (const n of nodes) {
        expect(n.style.fill).toBe('#4682B4');
      }
    });

    it('applies custom color', () => {
      const points = bindPointData(scatterData, 'x', 'y');
      const xScale = linearScale([0, 5], [0, 300]);
      const yScale = linearScale([0, 30], [200, 0]);

      const nodes = pointsToScene(points, xScale, yScale, {
        type: 'point', color: '#FF0000',
      });

      for (const n of nodes) {
        expect(n.style.fill).toBe('#FF0000');
      }
    });

    it('open shapes have fill=none and stroke=colour', () => {
      const points = bindPointData(scatterData, 'x', 'y');
      const xScale = linearScale([0, 5], [0, 300]);
      const yScale = linearScale([0, 30], [200, 0]);

      const nodes = pointsToScene(points, xScale, yScale, {
        type: 'point', shape: 'circleOpen', color: '#00FF00',
      });

      for (const n of nodes) {
        expect(n.style.fill).toBe('none');
        expect(n.style.stroke).toBe('#00FF00');
      }
    });

    it('fillBorder shapes have fill=fillColor and stroke=colour', () => {
      const points = bindPointData(scatterData, 'x', 'y');
      const xScale = linearScale([0, 5], [0, 300]);
      const yScale = linearScale([0, 30], [200, 0]);

      const nodes = pointsToScene(points, xScale, yScale, {
        type: 'point', shape: 'circleFilled', color: '#0000FF', fill: '#FFFF00',
      });

      for (const n of nodes) {
        expect(n.style.fill).toBe('#FFFF00');
        expect(n.style.stroke).toBe('#0000FF');
        expect(n.style.strokeWidth).toBe(0.5); // default
      }
    });

    it('applies custom alpha', () => {
      const points = bindPointData(scatterData, 'x', 'y');
      const xScale = linearScale([0, 5], [0, 300]);
      const yScale = linearScale([0, 30], [200, 0]);

      const nodes = pointsToScene(points, xScale, yScale, {
        type: 'point', alpha: 0.3,
      });

      for (const n of nodes) {
        expect(n.style.opacity).toBe(0.3);
      }
    });

    it('uses colorScale when color aesthetic is mapped', () => {
      const points = bindPointData(coloredData, 'x', 'y', 'group');
      const xScale = linearScale([0, 5], [0, 300]);
      const yScale = linearScale([0, 30], [200, 0]);
      const colorScale = d3.scaleOrdinal<string>().domain(['A', 'B']).range(['#FF0000', '#0000FF']);

      const nodes = pointsToScene(points, xScale, yScale, { type: 'point' }, colorScale);

      const groupA = nodes.find(n => n.data?.color === 'A')!;
      const groupB = nodes.find(n => n.data?.color === 'B')!;
      expect(groupA.style.fill).toBe('#FF0000');
      expect(groupB.style.fill).toBe('#0000FF');
    });
  });

  describe('size', () => {
    it('different sizes produce different path data', () => {
      const data = [
        { x: 1, y: 10 },
        { x: 2, y: 20 },
      ];
      const points = bindData(data, { x: 'x', y: 'y' });
      // Manually set different sizes
      points[0].size = 2;
      points[1].size = 8;

      const xScale = linearScale([0, 5], [0, 300]);
      const yScale = linearScale([0, 30], [200, 0]);

      const nodes = pointsToScene(points, xScale, yScale, { type: 'point' });

      // Different sizes → different symbol paths
      expect(nodes[0].d).not.toBe(nodes[1].d);
    });
  });

  describe('jitter', () => {
    it('jitter offsets positions differently per point', () => {
      const data = [
        { x: 1, y: 10 },
        { x: 1, y: 20 },
        { x: 1, y: 15 },
      ];
      const points = bindPointData(data, 'x', 'y');
      const xScale = linearScale([0, 5], [0, 300]);
      const yScale = linearScale([0, 30], [200, 0]);

      const nodes = pointsToScene(points, xScale, yScale, {
        type: 'point', position: 'jitter',
      });

      // All have x=1, but jitter should make transforms differ
      const transforms = nodes.map(n => n.transform);
      const uniqueTransforms = new Set(transforms);
      expect(uniqueTransforms.size).toBeGreaterThan(1);
    });

    it('jitter is deterministic (same result on repeated calls)', () => {
      const data = [{ x: 1, y: 10 }, { x: 2, y: 20 }];
      const points = bindPointData(data, 'x', 'y');
      const xScale = linearScale([0, 5], [0, 300]);
      const yScale = linearScale([0, 30], [200, 0]);
      const config: GeomConfig = { type: 'point', position: 'jitter' };

      const nodes1 = pointsToScene(points, xScale, yScale, config);
      const nodes2 = pointsToScene(points, xScale, yScale, config);

      expect(nodes1[0].transform).toBe(nodes2[0].transform);
      expect(nodes1[1].transform).toBe(nodes2[1].transform);
    });

    it('jitters vertically within categorical y bands', () => {
      const points = bindPointData([
        { x: 25, y: 'Retail' },
        { x: 25, y: 'Retail' },
        { x: 25, y: 'Retail' },
      ], 'x', 'y');
      const xScale = linearScale([0, 100], [0, 200]);
      const yScale = d3.scaleBand().domain(['Retail']).range([0, 80]);

      const nodes = pointsToScene(points, xScale, yScale, {
        type: 'point',
        position: 'jitter',
        jitterWidth: 0,
        jitterHeight: 0.8,
      });

      const positions = nodes.map(n => parseTranslate(n.transform));
      expect(new Set(positions.map(([, y]) => y)).size).toBeGreaterThan(1);
      for (const [x, y] of positions) {
        expect(x).toBe(50);
        expect(y).toBeGreaterThanOrEqual(8);
        expect(y).toBeLessThanOrEqual(72);
      }
    });
  });

  describe('accessibility', () => {
    it('each node has aria attributes', () => {
      const points = bindPointData(scatterData, 'x', 'y');
      const xScale = linearScale([0, 5], [0, 300]);
      const yScale = linearScale([0, 30], [200, 0]);

      const nodes = pointsToScene(points, xScale, yScale, { type: 'point' });

      for (const n of nodes) {
        expect(n.aria).toBeDefined();
        expect(n.aria!.role).toBe('listitem');
        expect(n.aria!.tabindex).toBe('0');
        expect(n.aria!.label).toBeTruthy();
      }
    });
  });

  describe('NA handling', () => {
    it('filters out NA values', () => {
      const data = [
        { x: 1, y: 10 },
        { x: null, y: 20 },
        { x: 3, y: null },
        { x: 4, y: 25 },
      ];
      const points = bindPointData(data, 'x', 'y');
      const xScale = linearScale([0, 5], [0, 300]);
      const yScale = linearScale([0, 30], [200, 0]);

      const nodes = pointsToScene(points, xScale, yScale, {
        type: 'point', naRm: true,
      });

      expect(nodes).toHaveLength(2); // Only valid points
    });

    it('returns empty array for empty input', () => {
      const nodes = pointsToScene([], d3.scaleLinear(), d3.scaleLinear(), { type: 'point' });
      expect(nodes).toHaveLength(0);
    });
  });
});
