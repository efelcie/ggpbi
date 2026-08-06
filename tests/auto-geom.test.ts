import { describe, it, expect, beforeEach } from 'vitest';
import { inferScaleLevel, inferGeom } from '../src/auto-geom';
import { ggpbi } from '../src/index';

// --- inferScaleLevel ---

describe('inferScaleLevel', () => {
  it('returns "numeric" for number values', () => {
    expect(inferScaleLevel([{ x: 42 }], 'x')).toBe('numeric');
  });

  it('returns "time" for Date values', () => {
    expect(inferScaleLevel([{ x: new Date('2024-01-01') }], 'x')).toBe('time');
  });

  it('returns "categorical" for string values', () => {
    expect(inferScaleLevel([{ x: 'foo' }], 'x')).toBe('categorical');
  });

  it('returns "numeric" for numeric strings', () => {
    expect(inferScaleLevel([{ x: '42' }], 'x')).toBe('numeric');
  });

  it('returns "categorical" for boolean values', () => {
    expect(inferScaleLevel([{ x: true }], 'x')).toBe('categorical');
  });

  it('skips null/undefined and finds first real value', () => {
    expect(inferScaleLevel([{ x: null }, { x: undefined }, { x: 99 }], 'x')).toBe('numeric');
  });

  it('returns "categorical" when all values are null', () => {
    expect(inferScaleLevel([{ x: null }, { x: undefined }], 'x')).toBe('categorical');
  });

  it('returns "categorical" for empty data', () => {
    expect(inferScaleLevel([], 'x')).toBe('categorical');
  });
});

// --- inferGeom ---

describe('inferGeom', () => {
  describe('y-only (no x)', () => {
    it('numeric y → boxplot', () => {
      const data = [{ y: 10 }, { y: 20 }, { y: 30 }];
      expect(inferGeom(data, { y: 'y' }).type).toBe('boxplot');
    });

    it('numeric y + color → boxplot', () => {
      const data = [{ y: 10, g: 'A' }, { y: 20, g: 'B' }];
      expect(inferGeom(data, { y: 'y', color: 'g' }).type).toBe('boxplot');
    });
  });

  describe('x-only (no y)', () => {
    it('categorical x → bar (stat_count)', () => {
      const data = [{ x: 'A' }, { x: 'B' }, { x: 'A' }];
      expect(inferGeom(data, { x: 'x' }).type).toBe('bar');
    });

    it('categorical x + color → bar', () => {
      const data = [{ x: 'A', g: 'X' }, { x: 'B', g: 'Y' }];
      expect(inferGeom(data, { x: 'x', color: 'g' }).type).toBe('bar');
    });

    it('numeric x → histogram (stat_bin)', () => {
      const data = [{ x: 1 }, { x: 2 }, { x: 3 }];
      expect(inferGeom(data, { x: 'x' }).type).toBe('histogram');
    });
  });

  describe('categorical x + numeric y', () => {
    it('→ bar (auto-detects stat_identity when y is mapped)', () => {
      const data = [
        { cat: 'A', val: 10 },
        { cat: 'B', val: 20 },
      ];
      expect(inferGeom(data, { x: 'cat', y: 'val' }).type).toBe('bar');
    });

    it('+ color → bar', () => {
      const data = [
        { cat: 'A', val: 10, g: 'X' },
        { cat: 'B', val: 20, g: 'Y' },
      ];
      expect(inferGeom(data, { x: 'cat', y: 'val', color: 'g' }).type).toBe('bar');
    });
  });

  describe('numeric x + numeric y', () => {
    it('→ point (scatter)', () => {
      const data = [
        { x: 1, y: 10 },
        { x: 2, y: 20 },
      ];
      expect(inferGeom(data, { x: 'x', y: 'y' }).type).toBe('point');
    });

    it('+ color → point', () => {
      const data = [
        { x: 1, y: 10, g: 'A' },
        { x: 2, y: 20, g: 'B' },
      ];
      expect(inferGeom(data, { x: 'x', y: 'y', color: 'g' }).type).toBe('point');
    });
  });

  describe('time x + numeric y', () => {
    it('→ line (time series)', () => {
      const data = [
        { date: new Date('2024-01'), val: 100 },
        { date: new Date('2024-02'), val: 200 },
      ];
      expect(inferGeom(data, { x: 'date', y: 'val' }).type).toBe('line');
    });

    it('+ color → line (multi-line)', () => {
      const data = [
        { date: new Date('2024-01'), val: 100, g: 'A' },
        { date: new Date('2024-02'), val: 200, g: 'B' },
      ];
      expect(inferGeom(data, { x: 'date', y: 'val', color: 'g' }).type).toBe('line');
    });
  });

  describe('edge cases', () => {
    it('no x, no y → point (fallback)', () => {
      expect(inferGeom([], {}).type).toBe('point');
    });

    it('time x, no y → bar (fallback)', () => {
      const data = [{ t: new Date('2024-01') }];
      expect(inferGeom(data, { x: 't' }).type).toBe('bar');
    });

    // "returns a valid GeomConfig object" removed — tautological (already tested by type-specific tests above).
  });
});

// --- Integration: builder without .geom() ---

describe('ggpbi builder auto-geom', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders without .geom() — auto-selects bar for categorical x + numeric y', () => {
    const svg = ggpbi()
      .data([
        { monat: 'Jan', umsatz: 100 },
        { monat: 'Feb', umsatz: 200 },
      ])
      .aes({ x: 'monat', y: 'umsatz' })
      .renderTo(container);

    expect(svg).toBeInstanceOf(SVGSVGElement);
    expect(svg.querySelector('.ggpbi-layer-bar')).not.toBeNull();
  });

  it('renders without .geom() — auto-selects point for numeric x + numeric y', () => {
    const svg = ggpbi()
      .data([
        { x: 1, y: 10 },
        { x: 2, y: 20 },
      ])
      .aes({ x: 'x', y: 'y' })
      .renderTo(container);

    expect(svg).toBeInstanceOf(SVGSVGElement);
    expect(svg.querySelector('.ggpbi-layer-point')).not.toBeNull();
  });

  it('renders without .geom() — auto-selects line for time x + numeric y', () => {
    const svg = ggpbi()
      .data([
        { t: new Date('2024-01-01'), v: 100 },
        { t: new Date('2024-02-01'), v: 200 },
      ])
      .aes({ x: 't', y: 'v' })
      .renderTo(container);

    expect(svg).toBeInstanceOf(SVGSVGElement);
    expect(svg.querySelector('.ggpbi-layer-line')).not.toBeNull();
  });

  it('explicit .geom() still overrides auto-selection', () => {
    const svg = ggpbi()
      .data([
        { monat: 'Jan', umsatz: 100 },
        { monat: 'Feb', umsatz: 200 },
      ])
      .aes({ x: 'monat', y: 'umsatz' })
      .geom('point')
      .renderTo(container);

    expect(svg.querySelector('.ggpbi-layer-point')).not.toBeNull();
    expect(svg.querySelector('.ggpbi-layer-bar')).toBeNull();
  });
});
