import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ggpbi, computeBoxplotStats } from '../src/index';
import { bindData } from '../src/bind-data';

// --- Test data ---

// Known distribution: 1,2,3,4,5,6,7,8,9,10,100
// Q1=3, Q2=6, Q3=9, IQR=6
// Lower fence = 3 - 1.5*6 = -6, Upper fence = 9 + 1.5*6 = 18
// whiskerLow = 1 (smallest >= -6), whiskerHigh = 10 (largest <= 18)
// outlier = 100
const knownData = [
  { cat: 'A', val: 1 },
  { cat: 'A', val: 2 },
  { cat: 'A', val: 3 },
  { cat: 'A', val: 4 },
  { cat: 'A', val: 5 },
  { cat: 'A', val: 6 },
  { cat: 'A', val: 7 },
  { cat: 'A', val: 8 },
  { cat: 'A', val: 9 },
  { cat: 'A', val: 10 },
  { cat: 'A', val: 100 },
];

const groupedData = [
  { cat: 'A', val: 1 }, { cat: 'A', val: 2 }, { cat: 'A', val: 3 },
  { cat: 'A', val: 4 }, { cat: 'A', val: 5 },
  { cat: 'B', val: 10 }, { cat: 'B', val: 20 }, { cat: 'B', val: 30 },
  { cat: 'B', val: 40 }, { cat: 'B', val: 50 },
];

const dodgeData = [
  { cat: 'A', val: 1, grp: 'X' }, { cat: 'A', val: 2, grp: 'X' },
  { cat: 'A', val: 3, grp: 'X' }, { cat: 'A', val: 4, grp: 'X' },
  { cat: 'A', val: 10, grp: 'Y' }, { cat: 'A', val: 20, grp: 'Y' },
  { cat: 'A', val: 30, grp: 'Y' }, { cat: 'A', val: 40, grp: 'Y' },
];

const naData = [
  { cat: 'A', val: 1 }, { cat: 'A', val: null }, { cat: 'A', val: 3 },
  { cat: 'A', val: 5 }, { cat: 'A', val: 7 },
];

// --- Helpers ---

function getBoxes(container: HTMLElement) {
  return container.querySelectorAll('.ggpbi-boxplot-box');
}

function getMedians(container: HTMLElement) {
  return container.querySelectorAll('.ggpbi-boxplot-median');
}

function getWhiskers(container: HTMLElement) {
  return container.querySelectorAll('.ggpbi-boxplot-whisker');
}

function getStaples(container: HTMLElement) {
  return container.querySelectorAll('.ggpbi-boxplot-staple');
}

function getOutliers(container: HTMLElement) {
  return container.querySelectorAll('.ggpbi-boxplot-outlier');
}

// --- stat_boxplot tests ---

describe('computeBoxplotStats', () => {
  const aes = { x: 'cat', y: 'val' };

  it('computes Q1, Q2, Q3, IQR correctly for known data', () => {
    const bound = bindData(knownData, aes);
    const stats = computeBoxplotStats(bound);
    expect(stats).toHaveLength(1);
    const s = stats[0];
    // d3.quantileSorted uses type-7 (R default) linear interpolation
    // For 11 values [1,2,3,4,5,6,7,8,9,10,100]:
    // Q1 = 3.5, Q2 = 6, Q3 = 8.5, IQR = 5
    expect(s.q1).toBe(3.5);
    expect(s.median).toBe(6);
    expect(s.q3).toBe(8.5);
    expect(s.iqr).toBe(5);
    expect(s.n).toBe(11);
  });

  it('identifies whisker bounds correctly', () => {
    const bound = bindData(knownData, aes);
    const stats = computeBoxplotStats(bound);
    const s = stats[0];
    expect(s.whiskerLow).toBe(1);
    expect(s.whiskerHigh).toBe(10);
  });

  it('identifies outliers correctly', () => {
    const bound = bindData(knownData, aes);
    const stats = computeBoxplotStats(bound);
    const s = stats[0];
    expect(s.outliers).toHaveLength(1);
    expect(Number(s.outliers[0].y)).toBe(100);
  });

  it('computes notch bounds', () => {
    const bound = bindData(knownData, aes);
    const stats = computeBoxplotStats(bound);
    const s = stats[0];
    const expected = 1.58 * s.iqr / Math.sqrt(s.n);
    expect(s.notchLower).toBeCloseTo(s.median - expected, 5);
    expect(s.notchUpper).toBeCloseTo(s.median + expected, 5);
  });

  it('groups by x value', () => {
    const bound = bindData(groupedData, aes);
    const stats = computeBoxplotStats(bound);
    expect(stats).toHaveLength(2);
    const a = stats.find(s => s.x === 'A')!;
    const b = stats.find(s => s.x === 'B')!;
    expect(a.median).toBe(3);
    expect(b.median).toBe(30);
  });

  it('coef=0 makes all points outside Q1/Q3 outliers', () => {
    const bound = bindData(knownData, aes);
    const stats = computeBoxplotStats(bound, 0);
    const s = stats[0];
    // With coef=0, fence = Q1/Q3 exactly.
    // Q1=3.5, Q3=8.5. whiskerLow = smallest >= 3.5 = 4, whiskerHigh = largest <= 8.5 = 8
    expect(s.whiskerLow).toBe(4);
    expect(s.whiskerHigh).toBe(8);
    // Points outside whisker range are outliers (1,2,3 below; 9,10,100 above)
    expect(s.outliers.length).toBeGreaterThan(0);
  });

  it('coef=Infinity has no outliers', () => {
    const bound = bindData(knownData, aes);
    const stats = computeBoxplotStats(bound, Infinity);
    const s = stats[0];
    expect(s.whiskerLow).toBe(1);
    expect(s.whiskerHigh).toBe(100);
    expect(s.outliers).toHaveLength(0);
  });

  it('coef=3 extends whiskers further', () => {
    const bound = bindData(knownData, aes);
    const stats15 = computeBoxplotStats(bound, 1.5);
    const stats3 = computeBoxplotStats(bound, 3);
    // With coef=3, upper fence = 9 + 3*6 = 27, so 100 is still outlier
    expect(stats3[0].outliers.length).toBeLessThanOrEqual(stats15[0].outliers.length);
  });

  it('filters NA values', () => {
    const bound = bindData(naData, aes);
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stats = computeBoxplotStats(bound, 1.5, false);
    expect(stats[0].n).toBe(4); // null filtered
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('naRm=true suppresses warning', () => {
    const bound = bindData(naData, aes);
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    computeBoxplotStats(bound, 1.5, true);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// --- Rendering tests ---

describe('geom_boxplot rendering', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders box, median, and whiskers for basic data', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'cat', y: 'val' })
      .geom('boxplot')
      .renderTo(container);

    expect(getBoxes(container).length).toBe(2);
    expect(getMedians(container).length).toBe(2);
    expect(getWhiskers(container).length).toBe(4); // 2 per box (lower + upper)
  });

  it('renders outlier points', () => {
    ggpbi()
      .data(knownData)
      .aes({ x: 'cat', y: 'val' })
      .geom('boxplot')
      .renderTo(container);

    expect(getOutliers(container).length).toBe(1);
  });

  it('hides outliers when boxOutlierShow=false', () => {
    ggpbi()
      .data(knownData)
      .aes({ x: 'cat', y: 'val' })
      .geom('boxplot', { boxOutlierShow: false })
      .renderTo(container);

    expect(getOutliers(container).length).toBe(0);
  });

  it('does not render staples by default (stapleWidth=0)', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'cat', y: 'val' })
      .geom('boxplot')
      .renderTo(container);

    expect(getStaples(container).length).toBe(0);
  });

  it('renders staples when stapleWidth > 0', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'cat', y: 'val' })
      .geom('boxplot', { boxStapleWidth: 0.5 })
      .renderTo(container);

    expect(getStaples(container).length).toBe(4); // 2 per box (low + high)
  });

  it('uses ggplot2 default fill (white)', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'cat', y: 'val' })
      .geom('boxplot')
      .renderTo(container);

    const box = getBoxes(container)[0];
    expect(box?.getAttribute('fill')).toBe('#FFFFFF');
  });

  it('uses ggplot2 default alpha (1.0)', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'cat', y: 'val' })
      .geom('boxplot')
      .renderTo(container);

    const box = getBoxes(container)[0];
    expect(box?.getAttribute('opacity')).toBe('1');
  });

  it('renders notched boxes when boxNotch=true', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'cat', y: 'val' })
      .geom('boxplot', { boxNotch: true })
      .renderTo(container);

    const boxes = getBoxes(container);
    expect(boxes.length).toBe(2);
    // Notched boxes use <path> not <rect>
    expect(boxes[0]?.tagName.toLowerCase()).toBe('path');
    expect(boxes[0]?.getAttribute('d')).toContain('M');
  });

  it('applies fatten to median line stroke-width', () => {
    // Default fatten=2, default strokeWidth=0.5, so median should be 1.0
    ggpbi()
      .data(groupedData)
      .aes({ x: 'cat', y: 'val' })
      .geom('boxplot')
      .renderTo(container);

    const median = getMedians(container)[0];
    expect(parseFloat(median?.getAttribute('stroke-width') ?? '0')).toBe(1.0);
  });

  it('applies custom fatten', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'cat', y: 'val' })
      .geom('boxplot', { boxFatten: 4 })
      .renderTo(container);

    const median = getMedians(container)[0];
    // 0.5 * 4 = 2.0
    expect(parseFloat(median?.getAttribute('stroke-width') ?? '0')).toBe(2.0);
  });

  it('renders dodged boxes with color aesthetic', () => {
    ggpbi()
      .data(dodgeData)
      .aes({ x: 'cat', y: 'val', color: 'grp' })
      .geom('boxplot')
      .renderTo(container);

    const boxes = getBoxes(container);
    expect(boxes.length).toBe(2); // X group + Y group
  });

  it('handles single data point without error', () => {
    const singleData = [{ cat: 'A', val: 42 }];
    expect(() => {
      ggpbi()
        .data(singleData)
        .aes({ x: 'cat', y: 'val' })
        .geom('boxplot')
        .renderTo(container);
    }).not.toThrow();

    expect(getBoxes(container).length).toBe(1);
  });

  it('handles IQR=0 (all same values) without error', () => {
    const sameData = [
      { cat: 'A', val: 5 }, { cat: 'A', val: 5 },
      { cat: 'A', val: 5 }, { cat: 'A', val: 5 },
    ];
    expect(() => {
      ggpbi()
        .data(sameData)
        .aes({ x: 'cat', y: 'val' })
        .geom('boxplot')
        .renderTo(container);
    }).not.toThrow();
  });

  it('renders with varwidth', () => {
    // Group A has 5 points, group B has 5 points → same width
    // Create uneven groups to test varwidth
    const unevenData = [
      { cat: 'A', val: 1 }, { cat: 'A', val: 2 },
      { cat: 'B', val: 1 }, { cat: 'B', val: 2 }, { cat: 'B', val: 3 },
      { cat: 'B', val: 4 }, { cat: 'B', val: 5 }, { cat: 'B', val: 6 },
      { cat: 'B', val: 7 }, { cat: 'B', val: 8 },
    ];

    ggpbi()
      .data(unevenData)
      .aes({ x: 'cat', y: 'val' })
      .geom('boxplot', { boxVarWidth: true })
      .renderTo(container);

    const boxes = getBoxes(container);
    expect(boxes.length).toBe(2);

    const widthA = parseFloat(boxes[0]?.getAttribute('width') ?? '0');
    const widthB = parseFloat(boxes[1]?.getAttribute('width') ?? '0');
    // B has more data points, so it should be wider
    expect(widthB).toBeGreaterThan(widthA);
  });

  it('renders custom outlier shape as path elements', () => {
    ggpbi()
      .data(knownData)
      .aes({ x: 'cat', y: 'val' })
      .geom('boxplot', { boxOutlierShape: 'square' })
      .renderTo(container);

    const outliers = getOutliers(container);
    expect(outliers.length).toBe(1);
    // Outliers are now rendered as <path> elements directly (via scene builder)
    expect(outliers[0].tagName.toLowerCase()).toBe('path');
  });

  it('outlier fill matches ggplot2 defaults (filled shape: fill=colour, stroke=none)', () => {
    ggpbi()
      .data(knownData)
      .aes({ x: 'cat', y: 'val' })
      .geom('boxplot') // default shape='circle' (pch 19, category='filled')
      .renderTo(container);

    const outlier = getOutliers(container)[0];
    expect(outlier).toBeTruthy();
    // 'filled' shapes: fill = outlierColor, stroke = none (no border)
    expect(outlier?.getAttribute('fill')).toBe('#333333');
    expect(outlier?.getAttribute('stroke')).toBe('none');
  });

  it('outlier fill=none for open shapes (ggplot2 fill=NA)', () => {
    ggpbi()
      .data(knownData)
      .aes({ x: 'cat', y: 'val' })
      .geom('boxplot', { boxOutlierShape: 'circleOpen' })
      .renderTo(container);

    const outlier = getOutliers(container)[0];
    expect(outlier).toBeTruthy();
    expect(outlier?.getAttribute('fill')).toBe('none');
    expect(outlier?.getAttribute('stroke')).toBe('#333333');
  });

  it('whiskers and staples are always opaque (ggplot2 alpha=NA)', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'cat', y: 'val' })
      .geom('boxplot', { alpha: 0.5, boxStapleWidth: 0.5 })
      .renderTo(container);

    const whisker = getWhiskers(container)[0];
    expect(whisker?.getAttribute('opacity')).toBe('1');

    const staple = getStaples(container)[0];
    expect(staple?.getAttribute('opacity')).toBe('1');
  });

  it('sets stroke-linecap=butt on whiskers and median (ggplot2 lineend)', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'cat', y: 'val' })
      .geom('boxplot')
      .renderTo(container);

    const whisker = getWhiskers(container)[0];
    expect(whisker?.getAttribute('stroke-linecap')).toBe('butt');

    const median = getMedians(container)[0];
    expect(median?.getAttribute('stroke-linecap')).toBe('butt');
  });

  it('sets stroke-linejoin=miter on box (ggplot2 linejoin)', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'cat', y: 'val' })
      .geom('boxplot')
      .renderTo(container);

    const box = getBoxes(container)[0];
    expect(box?.getAttribute('stroke-linejoin')).toBe('miter');
  });

  it('applies per-component styling', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'cat', y: 'val' })
      .geom('boxplot', {
        boxBorderColor: '#FF0000',
        boxWhiskerColor: '#00FF00',
        boxMedianColor: '#0000FF',
      })
      .renderTo(container);

    const box = getBoxes(container)[0];
    expect(box?.getAttribute('stroke')).toBe('#FF0000');

    const whisker = getWhiskers(container)[0];
    expect(whisker?.getAttribute('stroke')).toBe('#00FF00');

    const median = getMedians(container)[0];
    expect(median?.getAttribute('stroke')).toBe('#0000FF');
  });
});
