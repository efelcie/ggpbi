/**
 * Tests for boxplotToScene() — pure geometry computation, NO JSDOM needed.
 */
import { describe, it, expect } from 'vitest';
import * as d3 from 'd3';
import { boxplotToScene, computeBoxplotStats } from '../src/geoms/boxplot';
import { bindData, type BoundPoint } from '../src/bind-data';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bandScale(domain: string[], range: [number, number]) {
  return d3.scaleBand().domain(domain).range(range).padding(0.1);
}

function linearScale(domain: [number, number], range: [number, number]) {
  return d3.scaleLinear().domain(domain).range(range);
}

function bind(data: Record<string, any>[], x: string, y: string, color?: string): BoundPoint[] {
  return bindData(data, { x, y, color });
}

/** Extract children by class from a GroupNode. */
function childrenByClass(group: ReturnType<typeof boxplotToScene>[0], cls: string) {
  return group.children.filter(c => c.class === cls);
}

// ---------------------------------------------------------------------------
// Test data — enough values for meaningful boxplot stats
// ---------------------------------------------------------------------------

const boxData = [
  { cat: 'A', val: 2 },
  { cat: 'A', val: 5 },
  { cat: 'A', val: 7 },
  { cat: 'A', val: 8 },
  { cat: 'A', val: 9 },
  { cat: 'A', val: 10 },
  { cat: 'A', val: 12 },
  { cat: 'A', val: 50 }, // outlier
  { cat: 'B', val: 1 },
  { cat: 'B', val: 3 },
  { cat: 'B', val: 4 },
  { cat: 'B', val: 5 },
  { cat: 'B', val: 6 },
  { cat: 'B', val: 7 },
  { cat: 'B', val: 8 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('boxplotToScene (pure, no JSDOM)', () => {
  describe('basic structure', () => {
    it('produces one GroupNode per category', () => {
      const points = bind(boxData, 'cat', 'val');
      const xScale = bandScale(['A', 'B'], [0, 200]);
      const yScale = linearScale([0, 55], [200, 0]);

      const groups = boxplotToScene(points, xScale, yScale, { type: 'boxplot' });

      expect(groups).toHaveLength(2);
      expect(groups.every(g => g.type === 'group')).toBe(true);
      expect(groups.every(g => g.class === 'ggpbi-boxplot')).toBe(true);
    });

    it('each group has aria label with stats', () => {
      const points = bind(boxData, 'cat', 'val');
      const xScale = bandScale(['A', 'B'], [0, 200]);
      const yScale = linearScale([0, 55], [200, 0]);

      const groups = boxplotToScene(points, xScale, yScale, { type: 'boxplot' });

      for (const g of groups) {
        expect(g.aria).toBeDefined();
        expect(g.aria!.role).toBe('listitem');
        expect(g.aria!.label).toMatch(/median/);
        expect(g.aria!.label).toMatch(/Q1/);
        expect(g.aria!.label).toMatch(/Q3/);
      }
    });
  });

  describe('children components', () => {
    it('has whisker lines (2 per box)', () => {
      const points = bind(boxData, 'cat', 'val');
      const xScale = bandScale(['A', 'B'], [0, 200]);
      const yScale = linearScale([0, 55], [200, 0]);

      const groups = boxplotToScene(points, xScale, yScale, { type: 'boxplot' });

      for (const g of groups) {
        const whiskers = childrenByClass(g, 'ggpbi-boxplot-whisker');
        expect(whiskers).toHaveLength(2);
        expect(whiskers.every(w => w.type === 'line')).toBe(true);
      }
    });

    it('has one box rect per group', () => {
      const points = bind(boxData, 'cat', 'val');
      const xScale = bandScale(['A', 'B'], [0, 200]);
      const yScale = linearScale([0, 55], [200, 0]);

      const groups = boxplotToScene(points, xScale, yScale, { type: 'boxplot' });

      for (const g of groups) {
        const boxes = childrenByClass(g, 'ggpbi-boxplot-box');
        expect(boxes).toHaveLength(1);
        expect(boxes[0].type).toBe('rect');
      }
    });

    it('has one median line per group', () => {
      const points = bind(boxData, 'cat', 'val');
      const xScale = bandScale(['A', 'B'], [0, 200]);
      const yScale = linearScale([0, 55], [200, 0]);

      const groups = boxplotToScene(points, xScale, yScale, { type: 'boxplot' });

      for (const g of groups) {
        const medians = childrenByClass(g, 'ggpbi-boxplot-median');
        expect(medians).toHaveLength(1);
        expect(medians[0].type).toBe('line');
      }
    });

    it('box has positive dimensions', () => {
      const points = bind(boxData, 'cat', 'val');
      const xScale = bandScale(['A', 'B'], [0, 200]);
      const yScale = linearScale([0, 55], [200, 0]);

      const groups = boxplotToScene(points, xScale, yScale, { type: 'boxplot' });

      for (const g of groups) {
        const box = childrenByClass(g, 'ggpbi-boxplot-box')[0];
        expect(box.type).toBe('rect');
        if (box.type === 'rect') {
          expect(box.width).toBeGreaterThan(0);
          expect(box.height).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('outliers', () => {
    it('shows outlier points by default', () => {
      const points = bind(boxData, 'cat', 'val');
      const xScale = bandScale(['A', 'B'], [0, 200]);
      const yScale = linearScale([0, 55], [200, 0]);

      const groups = boxplotToScene(points, xScale, yScale, { type: 'boxplot' });

      // Category A has val=50 as outlier
      const groupA = groups.find(g => g.aria?.label?.startsWith('A'))!;
      const outliers = childrenByClass(groupA, 'ggpbi-boxplot-outlier');
      expect(outliers.length).toBeGreaterThan(0);
      expect(outliers.every(o => o.type === 'path')).toBe(true);
    });

    it('hides outliers when boxOutlierShow=false', () => {
      const points = bind(boxData, 'cat', 'val');
      const xScale = bandScale(['A', 'B'], [0, 200]);
      const yScale = linearScale([0, 55], [200, 0]);

      const groups = boxplotToScene(points, xScale, yScale, {
        type: 'boxplot', boxOutlierShow: false,
      });

      for (const g of groups) {
        const outliers = childrenByClass(g, 'ggpbi-boxplot-outlier');
        expect(outliers).toHaveLength(0);
      }
    });
  });

  describe('staples', () => {
    it('no staples by default (stapleWidth=0)', () => {
      const points = bind(boxData, 'cat', 'val');
      const xScale = bandScale(['A', 'B'], [0, 200]);
      const yScale = linearScale([0, 55], [200, 0]);

      const groups = boxplotToScene(points, xScale, yScale, { type: 'boxplot' });

      for (const g of groups) {
        const staples = childrenByClass(g, 'ggpbi-boxplot-staple');
        expect(staples).toHaveLength(0);
      }
    });

    it('adds staples when stapleWidth > 0', () => {
      const points = bind(boxData, 'cat', 'val');
      const xScale = bandScale(['A', 'B'], [0, 200]);
      const yScale = linearScale([0, 55], [200, 0]);

      const groups = boxplotToScene(points, xScale, yScale, {
        type: 'boxplot', boxStapleWidth: 0.5,
      });

      for (const g of groups) {
        const staples = childrenByClass(g, 'ggpbi-boxplot-staple');
        expect(staples).toHaveLength(2); // low + high
      }
    });
  });

  describe('notched boxes', () => {
    it('produces path instead of rect for notch=true', () => {
      const points = bind(boxData, 'cat', 'val');
      const xScale = bandScale(['A', 'B'], [0, 200]);
      const yScale = linearScale([0, 55], [200, 0]);

      const groups = boxplotToScene(points, xScale, yScale, {
        type: 'boxplot', boxNotch: true,
      });

      for (const g of groups) {
        const boxes = childrenByClass(g, 'ggpbi-boxplot-box');
        expect(boxes).toHaveLength(1);
        expect(boxes[0].type).toBe('path');
      }
    });

    it('draws notch vertices strictly inside the box when the CI is within the hinges', () => {
      // Many tightly clustered values → narrow notch CI (median ± 1.58·IQR/√n)
      const data = Array.from({ length: 100 }, (_, i) => ({ cat: 'A', val: 10 + (i % 10) }));
      const points = bind(data, 'cat', 'val');
      const xScale = bandScale(['A'], [0, 100]);
      const yScale = linearScale([0, 25], [200, 0]);

      const stats = computeBoxplotStats(points, 1.5, false);
      const stat = stats[0];
      // Precondition: the CI really is inside the hinges for this data
      expect(stat.notchUpper).toBeLessThan(stat.q3);
      expect(stat.notchLower).toBeGreaterThan(stat.q1);

      const groups = boxplotToScene(points, xScale, yScale, {
        type: 'boxplot', boxNotch: true,
      });
      const box = childrenByClass(groups[0], 'ggpbi-boxplot-box')[0] as { d: string };

      // Path: M lx,q3y L lx,nuY L nlx,medY L lx,nlY L lx,q1y ...
      const ys = [...box.d.matchAll(/[ML][\d.-]+,([\d.-]+)/g)].map(m => parseFloat(m[1]));
      const [q3y, nuY, medY, nlY, q1y] = ys;

      // Screen y inverted: box top q3y < notch-upper nuY < median < notch-lower nlY < box bottom q1y
      expect(nuY).toBeGreaterThan(q3y);
      expect(nuY).toBeLessThan(medY);
      expect(nlY).toBeGreaterThan(medY);
      expect(nlY).toBeLessThan(q1y);
      // And they match the scaled CI bounds exactly (no clamping needed)
      expect(nuY).toBeCloseTo(yScale(stat.notchUpper), 6);
      expect(nlY).toBeCloseTo(yScale(stat.notchLower), 6);
    });

    it('clamps notch vertices to the box when the CI exceeds the hinges', () => {
      // Few, widely spread values → CI wider than the box
      const data = [
        { cat: 'A', val: 1 }, { cat: 'A', val: 9 }, { cat: 'A', val: 10 },
        { cat: 'A', val: 11 }, { cat: 'A', val: 19 },
      ];
      const points = bind(data, 'cat', 'val');
      const xScale = bandScale(['A'], [0, 100]);
      const yScale = linearScale([0, 25], [200, 0]);

      const stats = computeBoxplotStats(points, 1.5, false);
      const stat = stats[0];
      expect(stat.notchUpper).toBeGreaterThan(stat.q3);
      expect(stat.notchLower).toBeLessThan(stat.q1);

      const groups = boxplotToScene(points, xScale, yScale, {
        type: 'boxplot', boxNotch: true,
      });
      const box = childrenByClass(groups[0], 'ggpbi-boxplot-box')[0] as { d: string };
      const ys = [...box.d.matchAll(/[ML][\d.-]+,([\d.-]+)/g)].map(m => parseFloat(m[1]));
      const [q3y, nuY, , nlY, q1y] = ys;

      expect(nuY).toBeCloseTo(q3y, 6);
      expect(nlY).toBeCloseTo(q1y, 6);
    });
  });

  describe('styling', () => {
    it('box has default fill=white and stroke=grey', () => {
      const points = bind(boxData, 'cat', 'val');
      const xScale = bandScale(['A', 'B'], [0, 200]);
      const yScale = linearScale([0, 55], [200, 0]);

      const groups = boxplotToScene(points, xScale, yScale, { type: 'boxplot' });

      const box = childrenByClass(groups[0], 'ggpbi-boxplot-box')[0];
      expect(box.style.fill).toBe('#FFFFFF');
      expect(box.style.stroke).toBe('#333333');
    });

    it('uses colorScale for box fill', () => {
      const data = [
        ...boxData.map(d => ({ ...d, grp: 'X' })),
        ...boxData.map(d => ({ ...d, cat: 'C', grp: 'Y' })),
      ];
      const points = bind(data, 'cat', 'val', 'grp');
      const xScale = bandScale(['A', 'B', 'C'], [0, 300]);
      const yScale = linearScale([0, 55], [200, 0]);
      const colorScale = d3.scaleOrdinal<string>().domain(['X', 'Y']).range(['#FF0000', '#0000FF']);

      const groups = boxplotToScene(points, xScale, yScale, { type: 'boxplot' }, colorScale);

      const fills = groups.map(g => childrenByClass(g, 'ggpbi-boxplot-box')[0].style.fill);
      expect(fills).toContain('#FF0000');
      expect(fills).toContain('#0000FF');
    });

    it('median line is fattened (default 2x base)', () => {
      const points = bind(boxData, 'cat', 'val');
      const xScale = bandScale(['A', 'B'], [0, 200]);
      const yScale = linearScale([0, 55], [200, 0]);

      const groups = boxplotToScene(points, xScale, yScale, {
        type: 'boxplot', strokeWidth: 1,
      });

      const median = childrenByClass(groups[0], 'ggpbi-boxplot-median')[0];
      // fatten=2 default → medianLineWidth = 1 * 2 = 2
      expect(median.style.strokeWidth).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('returns empty for empty input', () => {
      const groups = boxplotToScene(
        [], bandScale(['A'], [0, 100]), linearScale([0, 10], [100, 0]),
        { type: 'boxplot' },
      );
      expect(groups).toHaveLength(0);
    });

    it('coef=Infinity means no outliers (whiskers to data range)', () => {
      const points = bind(boxData, 'cat', 'val');
      const xScale = bandScale(['A', 'B'], [0, 200]);
      const yScale = linearScale([0, 55], [200, 0]);

      const groups = boxplotToScene(points, xScale, yScale, {
        type: 'boxplot', boxCoef: Infinity,
      });

      for (const g of groups) {
        const outliers = childrenByClass(g, 'ggpbi-boxplot-outlier');
        expect(outliers).toHaveLength(0);
      }
    });
  });
});
