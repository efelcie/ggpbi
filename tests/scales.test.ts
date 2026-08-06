import { describe, it, expect } from 'vitest';
import { createScale, inferScaleType } from '../src/scales';

const numericData = [
  { val: 10 },
  { val: 20 },
  { val: 50 },
];

const categoryData = [
  { cat: 'A', val: 1 },
  { cat: 'B', val: 2 },
  { cat: 'C', val: 3 },
];

describe('createScale', () => {
  describe('linear', () => {
    it('creates a linear scale with correct domain', () => {
      const scale = createScale(numericData, 'val', 'linear', [0, 100]);
      expect(scale(10)).toBe(0);
      expect(scale(50)).toBe(100);
    });

    it('accepts numeric strings (Power BI grouping values)', () => {
      const data = [{ val: '10' }, { val: '20' }, { val: '50' }];
      const scale = createScale(data as any, 'val', 'linear', [0, 100]);
      expect(scale(10)).toBe(0);
      expect(scale(50)).toBe(100);
    });

    it('throws when no numeric values exist', () => {
      const data = [{ val: 'a' }, { val: 'b' }];
      expect(() => createScale(data, 'val', 'linear', [0, 100]))
        .toThrow(/no numeric values/);
    });
  });

  describe('log', () => {
    it('creates a log scale for positive values', () => {
      const data = [{ val: 1 }, { val: 100 }];
      const scale = createScale(data, 'val', 'log', [0, 200]);
      expect(scale(1)).toBe(0);
      expect(scale(100)).toBe(200);
    });

    it('throws when no positive values exist', () => {
      const data = [{ val: 0 }, { val: -5 }];
      expect(() => createScale(data, 'val', 'log', [0, 100]))
        .toThrow(/no positive values/);
    });
  });

  describe('sqrt', () => {
    it('creates a sqrt scale for non-negative values', () => {
      const data = [{ val: 0 }, { val: 100 }];
      const scale = createScale(data, 'val', 'sqrt', [0, 200]);
      expect(scale(0)).toBe(0);
      expect(scale(100)).toBe(200);
    });

    it('throws when no non-negative values exist', () => {
      const data = [{ val: -1 }, { val: -10 }];
      expect(() => createScale(data, 'val', 'sqrt', [0, 100]))
        .toThrow(/no non-negative values/);
    });
  });

  describe('ordinal / category (bandScale)', () => {
    it('creates band scale with correct domain order', () => {
      const scale = createScale(categoryData, 'cat', 'ordinal', [0, 300]);
      const a = scale('A') as number;
      const b = scale('B') as number;
      const c = scale('C') as number;
      expect(a).toBeLessThan(b);
      expect(b).toBeLessThan(c);
    });

    it('works with "category" alias', () => {
      const scale = createScale(categoryData, 'cat', 'category', [0, 300]);
      expect(typeof scale('A')).toBe('number');
    });

    it('has bandwidth() method (d3.scaleBand)', () => {
      const scale = createScale(categoryData, 'cat', 'ordinal', [0, 300]);
      expect(typeof (scale as any).bandwidth).toBe('function');
      expect((scale as any).bandwidth()).toBeGreaterThan(0);
    });

    it('first bar is not at pixel 0 (outer padding)', () => {
      const scale = createScale(categoryData, 'cat', 'ordinal', [0, 300]);
      const a = scale('A') as number;
      // With paddingOuter the first band starts after the outer padding
      expect(a).toBeGreaterThan(0);
    });

    it('respects custom paddingInner/paddingOuter', () => {
      const defaultScale = createScale(categoryData, 'cat', 'ordinal', [0, 300]);
      const customScale = createScale(categoryData, 'cat', 'ordinal', [0, 300], {
        paddingInner: 0.4,
        paddingOuter: 1.0,
      });
      // Larger paddingOuter → more offset from edge
      expect((customScale as any)('A')).toBeGreaterThan((defaultScale as any)('A'));
      // Larger paddingInner → narrower bandwidth
      expect((customScale as any).bandwidth()).toBeLessThan((defaultScale as any).bandwidth());
    });
  });

  describe('time', () => {
    it('creates time scale from Date values', () => {
      const data = [
        { date: new Date('2024-01-01') },
        { date: new Date('2024-12-31') },
      ];
      const scale = createScale(data, 'date', 'time', [0, 365]);
      expect(scale(new Date('2024-01-01'))).toBe(0);
      expect(scale(new Date('2024-12-31'))).toBe(365);
    });

    it('throws when no Date values exist', () => {
      const data = [{ date: 'not-a-date' }];
      expect(() => createScale(data, 'date', 'time', [0, 100]))
        .toThrow(/no Date values/);
    });
  });

  it('throws for unknown scale type', () => {
    expect(() => createScale(numericData, 'val', 'banana' as any, [0, 100]))
      .toThrow(/Unknown scale type/);
  });
});

describe('inferScaleType', () => {
  it('infers linear for numeric data', () => {
    expect(inferScaleType(numericData, 'val')).toBe('linear');
  });

  it('infers ordinal for string data', () => {
    expect(inferScaleType(categoryData, 'cat')).toBe('ordinal');
  });

  it('infers linear for numeric strings', () => {
    const data = [{ val: '1' }, { val: '2' }];
    expect(inferScaleType(data as any, 'val')).toBe('linear');
  });

  it('infers time for Date data', () => {
    const data = [{ d: new Date() }];
    expect(inferScaleType(data, 'd')).toBe('time');
  });

  it('returns linear for empty data', () => {
    expect(inferScaleType([], 'x')).toBe('linear');
  });

  it('skips null/undefined samples', () => {
    const data = [{ val: null }, { val: undefined }, { val: 42 }];
    expect(inferScaleType(data as any, 'val')).toBe('linear');
  });
});
