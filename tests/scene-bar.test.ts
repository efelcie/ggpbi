/**
 * Tests for barsToScene() — pure geometry computation, NO JSDOM needed.
 *
 * These tests prove the SceneGraph architecture: geom logic is testable
 * without a DOM. We only need D3 scales (which are pure functions).
 */
import { describe, it, expect } from 'vitest';
import * as d3 from 'd3';
import { barsToScene } from '../src/geoms/bar';
import { bindData, type BoundPoint } from '../src/bind-data';
import { applyDodge, applyStack, applyFill } from '../src/position';
import type { GeomConfig } from '../src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a band scale for categories. */
function bandScale(domain: string[], range: [number, number]) {
  return d3.scaleBand().domain(domain).range(range).padding(0.1);
}

/** Create a linear scale. */
function linearScale(domain: [number, number], range: [number, number]) {
  return d3.scaleLinear().domain(domain).range(range);
}

/** Bind simple bar data to aesthetics. */
function bindBarData(
  data: Record<string, any>[],
  xField: string,
  yField: string,
  colorField?: string,
): BoundPoint[] {
  return bindData(data, { x: xField, y: yField, color: colorField });
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const sampleData = [
  { month: 'Jan', sales: 100 },
  { month: 'Feb', sales: 200 },
  { month: 'Mar', sales: 150 },
];

const groupedData = [
  { month: 'Jan', sales: 100, region: 'Nord' },
  { month: 'Jan', sales: 80, region: 'Süd' },
  { month: 'Feb', sales: 200, region: 'Nord' },
  { month: 'Feb', sales: 150, region: 'Süd' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('barsToScene (pure, no JSDOM)', () => {
  describe('identity position', () => {
    it('produces one RectNode per data point', () => {
      const points = bindBarData(sampleData, 'month', 'sales');
      const xScale = bandScale(['Jan', 'Feb', 'Mar'], [0, 300]);
      const yScale = linearScale([0, 200], [200, 0]);

      const nodes = barsToScene(points, xScale, yScale, { type: 'bar', position: 'identity' });

      expect(nodes).toHaveLength(3);
      expect(nodes.every(n => n.type === 'rect')).toBe(true);
      expect(nodes.every(n => n.class === 'ggpbi-bar')).toBe(true);
    });

    it('all bars have positive width and height', () => {
      const points = bindBarData(sampleData, 'month', 'sales');
      const xScale = bandScale(['Jan', 'Feb', 'Mar'], [0, 300]);
      const yScale = linearScale([0, 200], [200, 0]);

      const nodes = barsToScene(points, xScale, yScale, { type: 'bar', position: 'identity' });

      for (const n of nodes) {
        expect(n.width).toBeGreaterThan(0);
        expect(n.height).toBeGreaterThan(0);
      }
    });

    it('bar heights reflect data values (taller bar for larger value)', () => {
      const points = bindBarData(sampleData, 'month', 'sales');
      const xScale = bandScale(['Jan', 'Feb', 'Mar'], [0, 300]);
      const yScale = linearScale([0, 200], [200, 0]);

      const nodes = barsToScene(points, xScale, yScale, { type: 'bar', position: 'identity' });

      // Feb (200) should be tallest, Jan (100) shortest
      const jan = nodes.find(n => n.data?.x === 'Jan')!;
      const feb = nodes.find(n => n.data?.x === 'Feb')!;
      const mar = nodes.find(n => n.data?.x === 'Mar')!;

      expect(feb.height).toBeGreaterThan(mar.height);
      expect(mar.height).toBeGreaterThan(jan.height);
    });

    it('bars start from baseline (y=0)', () => {
      const points = bindBarData(sampleData, 'month', 'sales');
      const xScale = bandScale(['Jan', 'Feb', 'Mar'], [0, 300]);
      const yScale = linearScale([0, 200], [200, 0]);

      const nodes = barsToScene(points, xScale, yScale, { type: 'bar', position: 'identity' });

      // Each bar: y + height should equal yScale(0) = 200 (the baseline)
      for (const n of nodes) {
        expect(n.y + n.height).toBeCloseTo(200, 0);
      }
    });

    it('preserves original BoundPoint in .data', () => {
      const points = bindBarData(sampleData, 'month', 'sales');
      const xScale = bandScale(['Jan', 'Feb', 'Mar'], [0, 300]);
      const yScale = linearScale([0, 200], [200, 0]);

      const nodes = barsToScene(points, xScale, yScale, { type: 'bar', position: 'identity' });

      expect(nodes[0].data).toBeDefined();
      expect(nodes[0].data!.x).toBe('Jan');
      expect(nodes[0].data!.y).toBe(100);
    });
  });

  describe('style', () => {
    it('applies default fill color', () => {
      const points = bindBarData(sampleData, 'month', 'sales');
      const xScale = bandScale(['Jan', 'Feb', 'Mar'], [0, 300]);
      const yScale = linearScale([0, 200], [200, 0]);

      const nodes = barsToScene(points, xScale, yScale, { type: 'bar', position: 'identity' });

      // Default color is steelblue (#4682B4)
      for (const n of nodes) {
        expect(n.style.fill).toBe('#4682B4');
      }
    });

    it('applies custom color', () => {
      const points = bindBarData(sampleData, 'month', 'sales');
      const xScale = bandScale(['Jan', 'Feb', 'Mar'], [0, 300]);
      const yScale = linearScale([0, 200], [200, 0]);

      const nodes = barsToScene(points, xScale, yScale, {
        type: 'bar', position: 'identity', color: '#FF0000',
      });

      for (const n of nodes) {
        expect(n.style.fill).toBe('#FF0000');
      }
    });

    it('uses colorScale when color aesthetic is mapped', () => {
      const points = bindBarData(groupedData, 'month', 'sales', 'region');
      const xScale = bandScale(['Jan', 'Feb'], [0, 200]);
      const yScale = linearScale([0, 200], [200, 0]);
      const colorScale = d3.scaleOrdinal<string>().domain(['Nord', 'Süd']).range(['#0000FF', '#FF0000']);

      const nodes = barsToScene(points, xScale, yScale,
        { type: 'bar', position: 'identity' }, colorScale);

      const nord = nodes.find(n => n.data?.color === 'Nord')!;
      const sued = nodes.find(n => n.data?.color === 'Süd')!;
      expect(nord.style.fill).toBe('#0000FF');
      expect(sued.style.fill).toBe('#FF0000');
    });

    it('applies alpha/opacity', () => {
      const points = bindBarData(sampleData, 'month', 'sales');
      const xScale = bandScale(['Jan', 'Feb', 'Mar'], [0, 300]);
      const yScale = linearScale([0, 200], [200, 0]);

      const nodes = barsToScene(points, xScale, yScale, {
        type: 'bar', position: 'identity', alpha: 0.5,
      });

      for (const n of nodes) {
        expect(n.style.opacity).toBe(0.5);
      }
    });

    it('applies stroke styling', () => {
      const points = bindBarData(sampleData, 'month', 'sales');
      const xScale = bandScale(['Jan', 'Feb', 'Mar'], [0, 300]);
      const yScale = linearScale([0, 200], [200, 0]);

      const nodes = barsToScene(points, xScale, yScale, {
        type: 'bar', position: 'identity', stroke: '#000000', strokeWidth: 2,
      });

      for (const n of nodes) {
        expect(n.style.stroke).toBe('#000000');
        expect(n.style.strokeWidth).toBe(2);
      }
    });
  });

  describe('accessibility', () => {
    it('each node has aria attributes', () => {
      const points = bindBarData(sampleData, 'month', 'sales');
      const xScale = bandScale(['Jan', 'Feb', 'Mar'], [0, 300]);
      const yScale = linearScale([0, 200], [200, 0]);

      const nodes = barsToScene(points, xScale, yScale, { type: 'bar', position: 'identity' });

      for (const n of nodes) {
        expect(n.aria).toBeDefined();
        expect(n.aria!.role).toBe('listitem');
        expect(n.aria!.tabindex).toBe('0');
        expect(n.aria!.label).toBeTruthy();
      }
    });
  });

  describe('dodge position', () => {
    it('dodged bars are narrower and offset by group', () => {
      const points = bindBarData(groupedData, 'month', 'sales', 'region');
      const dodged = applyDodge(points);
      const xScale = bandScale(['Jan', 'Feb'], [0, 200]);
      const yScale = linearScale([0, 200], [200, 0]);

      const nodes = barsToScene(dodged, xScale, yScale, { type: 'bar', position: 'dodge' });

      // 4 bars: 2 months × 2 regions
      expect(nodes).toHaveLength(4);

      // Same-month bars should have different x positions
      const janBars = nodes.filter(n => n.data?.x === 'Jan');
      expect(janBars).toHaveLength(2);
      expect(janBars[0].x).not.toBe(janBars[1].x);

      // Dodged bars are narrower than full bandwidth
      const fullWidth = xScale.bandwidth() * 0.9; // default widthFraction
      expect(janBars[0].width).toBeLessThan(fullWidth);
    });
  });

  describe('stack position', () => {
    it('stacked bars share the same x but different y ranges', () => {
      const points = bindBarData(groupedData, 'month', 'sales', 'region');
      const stacked = applyStack(points);
      const xScale = bandScale(['Jan', 'Feb'], [0, 200]);
      const yScale = linearScale([0, 400], [200, 0]);

      const nodes = barsToScene(stacked, xScale, yScale, { type: 'bar', position: 'stack' });

      expect(nodes).toHaveLength(4);

      // Same-month bars should have same x
      const janBars = nodes.filter(n => n.data?.x === 'Jan');
      expect(janBars[0].x).toBe(janBars[1].x);

      // But different y positions (stacked on top of each other)
      expect(janBars[0].y).not.toBe(janBars[1].y);

      // The bottom of one bar should meet the top of the other
      const sorted = janBars.sort((a, b) => b.y - a.y); // higher y = lower on screen
      expect(sorted[0].y).toBeCloseTo(sorted[1].y + sorted[1].height, 0);
    });
  });

  describe('fill position', () => {
    it('fill bars span the full scale range', () => {
      const points = bindBarData(groupedData, 'month', 'sales', 'region');
      const filled = applyFill(points);
      const xScale = bandScale(['Jan', 'Feb'], [0, 200]);
      const yScale = linearScale([0, 1], [200, 0]);

      const nodes = barsToScene(filled, xScale, yScale, { type: 'bar', position: 'fill' });

      // Per-month bars should sum to full height
      const janBars = nodes.filter(n => n.data?.x === 'Jan');
      const totalHeight = janBars.reduce((sum, n) => sum + n.height, 0);
      expect(totalHeight).toBeCloseTo(200, 0); // full inner height
    });
  });

  describe('NA handling', () => {
    it('filters out NA values', () => {
      const data = [
        { month: 'Jan', sales: 100 },
        { month: 'Feb', sales: null },
        { month: 'Mar', sales: 150 },
      ];
      const points = bindBarData(data, 'month', 'sales');
      const xScale = bandScale(['Jan', 'Feb', 'Mar'], [0, 300]);
      const yScale = linearScale([0, 200], [200, 0]);

      const nodes = barsToScene(points, xScale, yScale, {
        type: 'bar', position: 'identity', naRm: true,
      });

      expect(nodes).toHaveLength(2); // Jan and Mar, Feb filtered
    });

    it('returns empty array for empty input', () => {
      const nodes = barsToScene([], d3.scaleLinear(), d3.scaleLinear(), { type: 'bar' });
      expect(nodes).toHaveLength(0);
    });
  });

  describe('horizontal bars', () => {
    it('produces horizontal bars with swapped dimensions', () => {
      const data = [
        { category: 'A', value: 30 },
        { category: 'B', value: 50 },
      ];
      const points = bindBarData(data, 'value', 'category');
      const xScale = linearScale([0, 50], [0, 200]);
      const yScale = bandScale(['A', 'B'], [0, 100]);

      const nodes = barsToScene(points, xScale, yScale, {
        type: 'bar', position: 'identity', orientation: 'y',
      });

      expect(nodes).toHaveLength(2);
      // Horizontal bars: width represents the value, height is band thickness
      const barA = nodes.find(n => n.data?.y === 'A')!;
      const barB = nodes.find(n => n.data?.y === 'B')!;
      expect(barB.width).toBeGreaterThan(barA.width);
    });
  });
});
