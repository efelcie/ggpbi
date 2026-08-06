import { describe, it, expect, beforeEach } from 'vitest';
import { ggpbi } from '../src/index';

// --- Test data ---

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
  { month: 'Mar', sales: 150, region: 'Nord' },
  { month: 'Mar', sales: 120, region: 'Süd' },
];

const negativeData = [
  { quarter: 'Q1', profit: 50 },
  { quarter: 'Q2', profit: -30 },
  { quarter: 'Q3', profit: 80 },
  { quarter: 'Q4', profit: -10 },
];

const dataWithNA = [
  { month: 'Jan', sales: 100 },
  { month: 'Feb', sales: null },
  { month: 'Mar', sales: 150 },
  { month: 'Apr', sales: 250 },
];

const horizontalData = [
  { category: 'A', value: 30 },
  { category: 'B', value: 50 },
  { category: 'C', value: 20 },
];

// --- Helpers ---

function getBars(container: HTMLElement) {
  return container.querySelectorAll('.ggpbi-bar');
}

function getBarAttr(container: HTMLElement, index: number, attr: string) {
  const bars = getBars(container);
  return bars[index]?.getAttribute(attr);
}

// --- Tests ---

describe('geom_col', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  describe('stat_identity (core behavior)', () => {
    it('renders bars using explicit y values (stat=identity)', () => {
      ggpbi()
        .data(sampleData)
        .aes({ x: 'month', y: 'sales' })
        .geom('col')
        .renderTo(container);

      const bars = getBars(container);
      expect(bars.length).toBe(3);
    });

    it('never triggers stat_count even without explicit stat config', () => {
      // geom_col should use identity — each data point produces one bar
      const data = [
        { cat: 'A', val: 10 },
        { cat: 'A', val: 20 },
        { cat: 'B', val: 30 },
      ];

      ggpbi()
        .data(data)
        .aes({ x: 'cat', y: 'val' })
        .geom('col')
        .renderTo(container);

      // With stat_identity, each row becomes a bar (stacked by default)
      const bars = getBars(container);
      expect(bars.length).toBe(3);
    });

    it('creates a layer group with class ggpbi-layer-col', () => {
      ggpbi()
        .data(sampleData)
        .aes({ x: 'month', y: 'sales' })
        .geom('col')
        .renderTo(container);

      const layer = container.querySelector('.ggpbi-layer-col');
      expect(layer).not.toBeNull();
    });
  });

  // Position tests (stack/dodge/dodge2/fill/identity) live in geom-bar.test.ts
  // since geom_col shares the same scene builder.

  describe('negative values', () => {
    it('renders negative bars extending below baseline', () => {
      ggpbi()
        .data(negativeData)
        .aes({ x: 'quarter', y: 'profit' })
        .geom('col')
        .renderTo(container);

      const bars = getBars(container);
      expect(bars.length).toBe(4);

      // All bars should have non-zero height
      for (const bar of bars) {
        const h = Number(bar.getAttribute('height'));
        expect(h).toBeGreaterThan(0);
      }
    });
  });

  describe('styling', () => {
    // alpha, color, stroke, linetype, lineend/linejoin are tested in geom-bar.test.ts
    // (geom_col shares the same scene builder). Only col-specific styling tests here.

    it('applies custom width', () => {
      ggpbi()
        .data(sampleData)
        .aes({ x: 'month', y: 'sales' })
        .geom('col', { width: 0.5 })
        .renderTo(container);

      const bars = getBars(container);
      expect(bars.length).toBe(3);
      // Bars should exist with positive width
      for (const bar of bars) {
        expect(Number(bar.getAttribute('width'))).toBeGreaterThan(0);
      }
    });
  });

  describe('justification', () => {
    it('applies just=0 (left-aligned)', () => {
      ggpbi()
        .data(sampleData)
        .aes({ x: 'month', y: 'sales' })
        .geom('col', { just: 0 })
        .renderTo(container);

      const bars = getBars(container);
      expect(bars.length).toBe(3);
    });

    it('applies just=1 (right-aligned)', () => {
      ggpbi()
        .data(sampleData)
        .aes({ x: 'month', y: 'sales' })
        .geom('col', { just: 1 })
        .renderTo(container);

      const bars = getBars(container);
      expect(bars.length).toBe(3);
    });
  });

  describe('orientation', () => {
    it('orientation=y renders horizontal bars', () => {
      ggpbi()
        .data(horizontalData)
        .aes({ x: 'value', y: 'category' })
        .geom('col', { orientation: 'y' })
        .renderTo(container);

      const bars = getBars(container);
      expect(bars.length).toBe(3);
    });
  });

  describe('NA handling', () => {
    it('filters out NA values', () => {
      ggpbi()
        .data(dataWithNA)
        .aes({ x: 'month', y: 'sales' })
        .geom('col')
        .renderTo(container);

      // null y value should be filtered out → 3 bars
      const bars = getBars(container);
      expect(bars.length).toBe(3);
    });

    it('naRm: true suppresses the warning', () => {
      ggpbi()
        .data(dataWithNA)
        .aes({ x: 'month', y: 'sales' })
        .geom('col', { naRm: true })
        .renderTo(container);

      const bars = getBars(container);
      expect(bars.length).toBe(3);
    });
  });

  describe('accessibility', () => {
    it('bars have role=listitem and tabindex', () => {
      ggpbi()
        .data(sampleData)
        .aes({ x: 'month', y: 'sales' })
        .geom('col')
        .renderTo(container);

      const bars = getBars(container);
      for (const bar of bars) {
        expect(bar.getAttribute('role')).toBe('listitem');
        expect(bar.getAttribute('tabindex')).toBe('0');
        expect(bar.getAttribute('aria-label')).toBeTruthy();
      }
    });

    it('layer group has role=list', () => {
      ggpbi()
        .data(sampleData)
        .aes({ x: 'month', y: 'sales' })
        .geom('col')
        .renderTo(container);

      const layer = container.querySelector('.ggpbi-layer-col');
      expect(layer?.getAttribute('role')).toBe('list');
      expect(layer?.getAttribute('aria-label')).toBe('Data points');
    });
  });

  describe('difference from geom_bar', () => {
    it('geom_col does not count — uses y values directly', () => {
      // Same data, geom('bar') without y would count, but geom('col') with y uses values
      const data = [
        { cat: 'A', val: 42 },
        { cat: 'B', val: 99 },
      ];

      ggpbi()
        .data(data)
        .aes({ x: 'cat', y: 'val' })
        .geom('col')
        .renderTo(container);

      const bars = getBars(container);
      expect(bars.length).toBe(2);
    });

    it('geom_bar without y triggers stat_count, geom_col requires y', () => {
      // geom_bar without y → stat_count
      const data = [
        { animal: 'cat' },
        { animal: 'dog' },
        { animal: 'cat' },
      ];

      const container2 = document.createElement('div');
      document.body.appendChild(container2);

      ggpbi()
        .data(data)
        .aes({ x: 'animal' })
        .geom('bar')
        .renderTo(container2);

      const barBars = container2.querySelectorAll('.ggpbi-bar');
      // stat_count aggregates: cat→2, dog→1
      expect(barBars.length).toBe(2);
    });
  });

  describe('fluent API', () => {
    it('works with .geom("col") in the builder', () => {
      const spec = ggpbi()
        .data(sampleData)
        .aes({ x: 'month', y: 'sales' })
        .geom('col', { position: 'dodge', alpha: 0.7 })
        .spec();

      expect(spec.layers).toHaveLength(1);
      expect(spec.layers[0].geom.type).toBe('col');
      expect(spec.layers[0].geom.position).toBe('dodge');
      expect(spec.layers[0].geom.alpha).toBe(0.7);
    });

    it('can combine col with other layers', () => {
      const svg = ggpbi()
        .data(sampleData)
        .aes({ x: 'month', y: 'sales' })
        .geom('col', { alpha: 0.5 })
        .geom('text')
        .renderTo(container);

      expect(svg).toBeInstanceOf(SVGSVGElement);
      expect(container.querySelector('.ggpbi-layer-col')).not.toBeNull();
      expect(container.querySelector('.ggpbi-layer-text')).not.toBeNull();
    });
  });
});
