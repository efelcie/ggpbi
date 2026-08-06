import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ggpbi,
  statBin,
  STAT_BIN_COUNT,
  STAT_BIN_DENSITY,
  STAT_BIN_NCOUNT,
  STAT_BIN_NDENSITY,
  STAT_BIN_WIDTH,
  STAT_BIN_X,
  STAT_BIN_XMIN,
  STAT_BIN_XMAX,
  inferGeom,
  buildPlot,
  resolveLayerStat,
} from '../src/index';

// --- Test data ---

/** 100 normal-ish values for histogram testing */
const normalData = Array.from({ length: 100 }, (_, i) => ({
  value: Math.sin(i * 0.1) * 10 + 50,
}));

const simpleData = [
  { x: 1 }, { x: 2 }, { x: 3 }, { x: 4 }, { x: 5 },
  { x: 6 }, { x: 7 }, { x: 8 }, { x: 9 }, { x: 10 },
];

const groupedData = [
  { x: 1, g: 'A' }, { x: 2, g: 'A' }, { x: 3, g: 'A' }, { x: 4, g: 'A' }, { x: 5, g: 'A' },
  { x: 6, g: 'B' }, { x: 7, g: 'B' }, { x: 8, g: 'B' }, { x: 9, g: 'B' }, { x: 10, g: 'B' },
];

const weightedData = [
  { x: 1, w: 10 }, { x: 2, w: 20 }, { x: 3, w: 5 },
  { x: 4, w: 15 }, { x: 5, w: 30 },
];

const dataWithNA = [
  { x: 1 }, { x: null }, { x: 3 }, { x: undefined }, { x: 5 },
  { x: NaN }, { x: 7 }, { x: 9 },
];

// --- Helpers ---

function getBars(container: HTMLElement) {
  return container.querySelectorAll('.ggpbi-bar');
}

// ---------------------------------------------------------------------------
// stat_bin — core binning algorithm
// ---------------------------------------------------------------------------

describe('stat_bin', () => {
  describe('basic binning', () => {
    it('bins 10 values into 30 bins (default)', () => {
      const result = statBin(simpleData, 'x');
      // ggplot2 default: 30 bins. For range [1,10], width = 9/(30-1) ≈ 0.31
      expect(result.length).toBeGreaterThan(0);
      // All rows should have computed variables
      for (const r of result) {
        expect(r[STAT_BIN_COUNT]).toBeDefined();
        expect(r[STAT_BIN_DENSITY]).toBeDefined();
        expect(r[STAT_BIN_NCOUNT]).toBeDefined();
        expect(r[STAT_BIN_NDENSITY]).toBeDefined();
        expect(r[STAT_BIN_WIDTH]).toBeDefined();
        expect(r[STAT_BIN_X]).toBeDefined();
        expect(r[STAT_BIN_XMIN]).toBeDefined();
        expect(r[STAT_BIN_XMAX]).toBeDefined();
      }
    });

    it('total count equals input count', () => {
      const result = statBin(simpleData, 'x');
      const total = result.reduce((s, r) => s + (r[STAT_BIN_COUNT] as number), 0);
      expect(total).toBe(10);
    });

    it('bins respect specified number of bins', () => {
      const result = statBin(simpleData, 'x', { bins: 5 });
      // 5 bins → width = 9/4 = 2.25; several bins
      expect(result.length).toBeGreaterThanOrEqual(5);
      const total = result.reduce((s, r) => s + (r[STAT_BIN_COUNT] as number), 0);
      expect(total).toBe(10);
    });

    it('bins=1 puts all data in one bin', () => {
      const result = statBin(simpleData, 'x', { bins: 1 });
      // Should have bins, but all data in effectively one range
      const nonEmpty = result.filter(r => (r[STAT_BIN_COUNT] as number) > 0);
      expect(nonEmpty.length).toBeGreaterThanOrEqual(1);
      const total = result.reduce((s, r) => s + (r[STAT_BIN_COUNT] as number), 0);
      expect(total).toBe(10);
    });
  });

  describe('binwidth parameter', () => {
    it('uses specified bin width', () => {
      const result = statBin(simpleData, 'x', { binwidth: 2 });
      // With width=2, bins span 2 units each
      for (const r of result) {
        expect(r[STAT_BIN_WIDTH]).toBeCloseTo(2, 10);
      }
    });

    it('binwidth overrides bins', () => {
      const result = statBin(simpleData, 'x', { bins: 3, binwidth: 5 });
      // binwidth takes priority over bins
      for (const r of result) {
        expect(r[STAT_BIN_WIDTH]).toBeCloseTo(5, 10);
      }
    });
  });

  describe('breaks parameter', () => {
    it('uses explicit breaks', () => {
      const result = statBin(simpleData, 'x', { breaks: [0, 3, 6, 10] });
      // 3 bins: [0,3], [3,6], [6,10]
      expect(result.length).toBe(3);
      expect(result[0][STAT_BIN_XMIN]).toBe(0);
      expect(result[0][STAT_BIN_XMAX]).toBe(3);
      expect(result[1][STAT_BIN_XMIN]).toBe(3);
      expect(result[1][STAT_BIN_XMAX]).toBe(6);
      expect(result[2][STAT_BIN_XMIN]).toBe(6);
      expect(result[2][STAT_BIN_XMAX]).toBe(10);
    });

    it('breaks override bins and binwidth', () => {
      const result = statBin(simpleData, 'x', { bins: 100, binwidth: 0.1, breaks: [0, 5, 10] });
      expect(result.length).toBe(2);
    });
  });

  describe('center and boundary', () => {
    it('boundary aligns bin edges', () => {
      const result = statBin(simpleData, 'x', { binwidth: 2, boundary: 0 });
      // With boundary=0 and width=2, breaks at 0, 2, 4, 6, 8, 10
      for (const r of result) {
        const xmin = r[STAT_BIN_XMIN] as number;
        expect(xmin % 2).toBeCloseTo(0, 10);
      }
    });

    it('center aligns bin centers', () => {
      const result = statBin(simpleData, 'x', { binwidth: 2, center: 5 });
      // center=5, width=2 → boundary=4, breaks at 4, 6, 8, etc.
      // Bin centers should be at 5, 7, etc.
      const centers = result.map(r => r[STAT_BIN_X] as number);
      // At least one center should be 5
      const has5 = centers.some(c => Math.abs(c - 5) < 0.01);
      expect(has5).toBe(true);
    });
  });

  describe('closed parameter', () => {
    it('closed="right" (default): intervals are (a, b]', () => {
      const data = [{ x: 5 }]; // boundary value
      const result = statBin(data, 'x', { breaks: [0, 5, 10], closed: 'right' });
      // x=5 should be in bin (0, 5] (first bin)
      expect(result[0][STAT_BIN_COUNT]).toBe(1);
      expect(result[1][STAT_BIN_COUNT]).toBe(0);
    });

    it('closed="left": intervals are [a, b)', () => {
      const data = [{ x: 5 }];
      const result = statBin(data, 'x', { breaks: [0, 5, 10], closed: 'left' });
      // x=5 should be in bin [5, 10) (second bin)
      expect(result[0][STAT_BIN_COUNT]).toBe(0);
      expect(result[1][STAT_BIN_COUNT]).toBe(1);
    });
  });

  describe('computed variables', () => {
    it('density integrates to 1', () => {
      const result = statBin(normalData, 'value', { bins: 10 });
      // density * width should sum to ~1
      const integral = result.reduce(
        (s, r) => s + (r[STAT_BIN_DENSITY] as number) * (r[STAT_BIN_WIDTH] as number),
        0,
      );
      expect(integral).toBeCloseTo(1, 5);
    });

    it('ncount max is 1', () => {
      const result = statBin(simpleData, 'x', { bins: 5 });
      const maxNcount = Math.max(...result.map(r => r[STAT_BIN_NCOUNT] as number));
      expect(maxNcount).toBeCloseTo(1, 10);
    });

    it('ndensity max is 1', () => {
      const result = statBin(simpleData, 'x', { bins: 5 });
      const maxNdensity = Math.max(...result.map(r => r[STAT_BIN_NDENSITY] as number));
      expect(maxNdensity).toBeCloseTo(1, 10);
    });

    it('xmin < x < xmax for each bin', () => {
      const result = statBin(simpleData, 'x', { bins: 5 });
      for (const r of result) {
        expect(r[STAT_BIN_XMIN]).toBeLessThan(r[STAT_BIN_X] as number);
        expect(r[STAT_BIN_X]).toBeLessThan(r[STAT_BIN_XMAX] as number);
      }
    });

    it('x is the midpoint of [xmin, xmax]', () => {
      const result = statBin(simpleData, 'x', { bins: 5 });
      for (const r of result) {
        const mid = ((r[STAT_BIN_XMIN] as number) + (r[STAT_BIN_XMAX] as number)) / 2;
        expect(r[STAT_BIN_X]).toBeCloseTo(mid, 10);
      }
    });
  });

  describe('pad parameter', () => {
    it('pad=true adds zero-count bins at edges', () => {
      const result = statBin(simpleData, 'x', { bins: 5, pad: true });
      const resultNoPad = statBin(simpleData, 'x', { bins: 5, pad: false });
      expect(result.length).toBe(resultNoPad.length + 2);
      // First and last padded bins have count=0
      expect(result[0][STAT_BIN_COUNT]).toBe(0);
      expect(result[result.length - 1][STAT_BIN_COUNT]).toBe(0);
    });
  });

  describe('drop parameter', () => {
    const sparseData = [{ x: 1 }, { x: 5 }];
    const breaks = [0, 2, 3, 4, 6, 8];

    it('drop="none" keeps all empty bins', () => {
      const result = statBin(sparseData, 'x', { breaks, drop: 'none' });
      expect(result.map(r => r[STAT_BIN_COUNT])).toEqual([1, 0, 0, 1, 0]);
    });

    it('drop="all" removes every empty bin', () => {
      const result = statBin(sparseData, 'x', { breaks, drop: 'all' });
      expect(result.map(r => r[STAT_BIN_COUNT])).toEqual([1, 1]);
    });

    it('drop="extremes" preserves internal empty bins and trims empty edges', () => {
      const result = statBin(sparseData, 'x', { breaks, drop: 'extremes' });
      expect(result.map(r => r[STAT_BIN_COUNT])).toEqual([1, 0, 0, 1]);
    });
  });

  describe('color grouping', () => {
    it('produces bins for each color group', () => {
      const result = statBin(groupedData, 'x', { bins: 5 }, 'g');
      // Should have bins for both 'A' and 'B'
      const groups = new Set(result.map(r => r['g']));
      expect(groups.size).toBe(2);
      expect(groups.has('A')).toBe(true);
      expect(groups.has('B')).toBe(true);
    });

    it('shares bin breaks across groups', () => {
      const result = statBin(groupedData, 'x', { bins: 5 }, 'g');
      const groupA = result.filter(r => r['g'] === 'A');
      const groupB = result.filter(r => r['g'] === 'B');
      // Same number of bins per group (shared breaks)
      expect(groupA.length).toBe(groupB.length);
    });
  });

  describe('weighted binning', () => {
    it('uses weight field for counts', () => {
      const result = statBin(weightedData, 'x', { breaks: [0, 3, 6] }, undefined, 'w');
      // closed='right' (default): (0,3] and (3,6]
      // Bin (0,3]: x=1 (w=10), x=2 (w=20), x=3 (w=5) = 35
      // Bin (3,6]: x=4 (w=15), x=5 (w=30) = 45
      expect(result.length).toBe(2);
      expect(result[0][STAT_BIN_COUNT]).toBe(35);
      expect(result[1][STAT_BIN_COUNT]).toBe(45);
    });
  });

  describe('NA handling', () => {
    it('ignores NA/null/undefined/NaN values', () => {
      const result = statBin(dataWithNA, 'x');
      const total = result.reduce((s, r) => s + (r[STAT_BIN_COUNT] as number), 0);
      // Only finite values: 1, 3, 5, 7, 9 = 5
      expect(total).toBe(5);
    });

    it('returns empty for all-NA data', () => {
      const result = statBin([{ x: null }, { x: NaN }], 'x');
      expect(result.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('single value', () => {
      const result = statBin([{ x: 5 }], 'x');
      expect(result.length).toBeGreaterThan(0);
      const total = result.reduce((s, r) => s + (r[STAT_BIN_COUNT] as number), 0);
      expect(total).toBe(1);
    });

    it('all same values', () => {
      const data = Array.from({ length: 10 }, () => ({ x: 42 }));
      const result = statBin(data, 'x');
      const total = result.reduce((s, r) => s + (r[STAT_BIN_COUNT] as number), 0);
      expect(total).toBe(10);
    });

    it('empty data', () => {
      const result = statBin([], 'x');
      expect(result.length).toBe(0);
    });

    it('throws for zero binwidth', () => {
      expect(() => statBin(simpleData, 'x', { binwidth: 0 })).toThrow();
    });

    it('throws for negative binwidth', () => {
      expect(() => statBin(simpleData, 'x', { binwidth: -1 })).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// auto-geom detection
// ---------------------------------------------------------------------------

describe('auto-geom: histogram', () => {
  it('numeric x only → histogram', () => {
    const data = [{ x: 1 }, { x: 2 }, { x: 3 }];
    expect(inferGeom(data, { x: 'x' }).type).toBe('histogram');
  });

  it('numeric string x only → histogram', () => {
    const data = [{ x: '1.5' }, { x: '2.3' }, { x: '3.7' }];
    expect(inferGeom(data, { x: 'x' }).type).toBe('histogram');
  });

  it('categorical x only → bar (not histogram)', () => {
    const data = [{ x: 'A' }, { x: 'B' }, { x: 'C' }];
    expect(inferGeom(data, { x: 'x' }).type).toBe('bar');
  });

  it('numeric x + numeric y → point (not histogram)', () => {
    const data = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
    expect(inferGeom(data, { x: 'x', y: 'y' }).type).toBe('point');
  });
});

// ---------------------------------------------------------------------------
// pipeline integration
// ---------------------------------------------------------------------------

describe('pipeline: histogram', () => {
  it('resolves stat_bin for histogram geom', () => {
    const layer = { geom: { type: 'histogram' as const } };
    const stat = resolveLayerStat(layer, { x: 'x' });
    expect(stat).toBe('bin');
  });

  it('stat_bin overrides y in aes', () => {
    const built = buildPlot({
      data: simpleData,
      aes: { x: 'x' },
      layers: [{ geom: { type: 'histogram' } }],
      width: 600,
      height: 400,
    });
    // After stat_bin, y should be mapped to __bin_count
    expect(built.spec.aes.y).toBe(STAT_BIN_COUNT);
  });

  it.each([
    ['count', STAT_BIN_COUNT],
    ['density', STAT_BIN_DENSITY],
    ['ncount', STAT_BIN_NCOUNT],
    ['ndensity', STAT_BIN_NDENSITY],
  ] as const)('maps yAxis=%s to its computed statistic', (yAxis, expectedField) => {
    const built = buildPlot({
      data: simpleData,
      aes: { x: 'x' },
      layers: [{ geom: { type: 'histogram', yAxis } }],
      width: 600,
      height: 400,
    });

    expect(built.spec.aes.y).toBe(expectedField);
  });

  it('builds histogram layers with data', () => {
    const built = buildPlot({
      data: simpleData,
      aes: { x: 'x' },
      layers: [{ geom: { type: 'histogram', bins: 5 } }],
      width: 600,
      height: 400,
    });
    expect(built.layers.length).toBe(1);
    expect(built.layers[0].data.length).toBeGreaterThan(0);
  });

  it('histogram with custom binwidth', () => {
    const built = buildPlot({
      data: simpleData,
      aes: { x: 'x' },
      layers: [{ geom: { type: 'histogram', binwidth: 2 } }],
      width: 600,
      height: 400,
    });
    expect(built.layers[0].data.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// DOM rendering (JSDOM)
// ---------------------------------------------------------------------------

describe('geom_histogram: DOM rendering', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders histogram bars', () => {
    ggpbi()
      .data(simpleData)
      .aes({ x: 'x' })
      .geom('histogram', { bins: 5 })
      .size(600, 400)
      .renderTo(container);

    const bars = getBars(container);
    expect(bars.length).toBeGreaterThan(0);
  });

  it('bars have correct SVG attributes', () => {
    ggpbi()
      .data(simpleData)
      .aes({ x: 'x' })
      .geom('histogram', { bins: 5 })
      .size(600, 400)
      .renderTo(container);

    const bars = getBars(container);
    for (const bar of bars) {
      expect(bar.getAttribute('x')).toBeTruthy();
      expect(bar.getAttribute('y')).toBeTruthy();
      expect(bar.getAttribute('width')).toBeTruthy();
      expect(bar.getAttribute('height')).toBeTruthy();
    }
  });

  it('histogram with color grouping renders bars for each group', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'x', color: 'g' })
      .geom('histogram', { bins: 5 })
      .size(600, 400)
      .renderTo(container);

    const bars = getBars(container);
    expect(bars.length).toBeGreaterThan(5); // Multiple groups
  });

  it('histogram auto-detection works (no explicit geom)', () => {
    ggpbi()
      .data(simpleData)
      .aes({ x: 'x' })
      .size(600, 400)
      .renderTo(container);

    const bars = getBars(container);
    expect(bars.length).toBeGreaterThan(0);
  });

  it('histogram with position=stack', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'x', color: 'g' })
      .geom('histogram', { bins: 5, position: 'stack' })
      .size(600, 400)
      .renderTo(container);

    const bars = getBars(container);
    expect(bars.length).toBeGreaterThan(0);
  });

  it('histogram with custom alpha', () => {
    ggpbi()
      .data(simpleData)
      .aes({ x: 'x' })
      .geom('histogram', { bins: 5, alpha: 0.5 })
      .size(600, 400)
      .renderTo(container);

    const bars = getBars(container);
    for (const bar of bars) {
      const opacity = bar.getAttribute('opacity');
      if (opacity) expect(parseFloat(opacity)).toBeCloseTo(0.5, 1);
    }
  });

  it('histogram accessibility: aria attributes', () => {
    ggpbi()
      .data(simpleData)
      .aes({ x: 'x' })
      .geom('histogram', { bins: 5 })
      .size(600, 400)
      .renderTo(container);

    const bars = getBars(container);
    for (const bar of bars) {
      expect(bar.getAttribute('role')).toBe('listitem');
      expect(bar.getAttribute('tabindex')).toBe('0');
      expect(bar.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('histogram with breaks parameter', () => {
    ggpbi()
      .data(simpleData)
      .aes({ x: 'x' })
      .geom('histogram', { breaks: [0, 3, 6, 10] })
      .size(600, 400)
      .renderTo(container);

    const bars = getBars(container);
    // 3 bins from breaks
    expect(bars.length).toBe(3);
  });

  it('histogram fluent API type safety', () => {
    // This should compile without errors
    const spec = ggpbi()
      .data(simpleData)
      .aes({ x: 'x' })
      .geom('histogram', {
        bins: 20,
        binwidth: 1,
        boundary: 0,
        closed: 'left',
        pad: true,
        drop: 'extremes',
        alpha: 0.7,
        color: '#ff0000',
      })
      .spec();

    expect(spec.layers[0].geom.type).toBe('histogram');
  });
});
