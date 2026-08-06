import { describe, it, expect } from 'vitest';
import { extendedBreaks, precision, formatBreaks } from '../src/breaks';

describe('extendedBreaks (Wilkinson Extended algorithm)', () => {
  it('generates nice breaks for mtcars$hp (52–335)', () => {
    const breaks = extendedBreaks(52, 335, 5);
    expect(breaks).toEqual([50, 100, 150, 200, 250, 300, 350]);
  });

  it('generates nice breaks for mtcars$mpg (10.4–33.9)', () => {
    const breaks = extendedBreaks(10.4, 33.9, 5);
    expect(breaks).toEqual([10, 15, 20, 25, 30, 35]);
  });

  it('generates nice breaks for mtcars$gear (3–5)', () => {
    // Continuous scale: 0.5 step matches m=5 best (same as ggplot2)
    const breaks = extendedBreaks(3, 5, 5);
    expect(breaks).toEqual([3, 3.5, 4, 4.5, 5]);
  });

  it('generates nice breaks for 0–10', () => {
    const breaks = extendedBreaks(0, 10, 5);
    expect(breaks).toEqual([0, 2.5, 5, 7.5, 10]);
  });

  it('generates nice breaks for 0–1', () => {
    const breaks = extendedBreaks(0, 1, 5);
    expect(breaks).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('generates nice breaks for large range 0–1000000', () => {
    const breaks = extendedBreaks(0, 1000000, 5);
    expect(breaks).toEqual([0, 250000, 500000, 750000, 1000000]);
  });

  it('handles negative range symmetrically', () => {
    const breaks = extendedBreaks(-50, 50, 5);
    expect(breaks).toEqual([-50, -25, 0, 25, 50]);
    expect(breaks).toContain(0);
  });

  it('handles degenerate range (min === max)', () => {
    const breaks = extendedBreaks(5, 5, 5);
    expect(breaks.length).toBeGreaterThan(0);
  });

  it('respects m parameter for more breaks', () => {
    const breaks3 = extendedBreaks(0, 100, 3);
    const breaks10 = extendedBreaks(0, 100, 10);
    expect(breaks10.length).toBeGreaterThan(breaks3.length);
  });

  it('generates nice breaks for mtcars$wt (1.513–5.424)', () => {
    const breaks = extendedBreaks(1.513, 5.424, 5);
    expect(breaks).toEqual([2, 3, 4, 5]);
  });

  it('generates nice breaks for mtcars$qsec (14.5–22.9)', () => {
    const breaks = extendedBreaks(14.5, 22.9, 5);
    expect(breaks).toEqual([15, 17.5, 20, 22.5]);
  });

  it('always uses nice step sizes from Q set', () => {
    // Test various ranges — steps should always be q * 10^z where q ∈ {1,5,2,2.5,4,3}
    const niceSteps = [1, 2, 2.5, 3, 4, 5];
    for (const [lo, hi] of [[0, 7], [3, 18], [100, 900], [0.1, 0.9]]) {
      const breaks = extendedBreaks(lo, hi, 5);
      if (breaks.length >= 2) {
        const step = breaks[1] - breaks[0];
        const magnitude = Math.pow(10, Math.floor(Math.log10(step)));
        const normalized = Math.round(step / magnitude * 100) / 100;
        expect(niceSteps).toContain(normalized);
      }
    }
  });

  it('swaps dmin > dmax', () => {
    const a = extendedBreaks(0, 100, 5);
    const b = extendedBreaks(100, 0, 5);
    expect(a).toEqual(b);
  });
});

describe('precision', () => {
  it('detects integer precision', () => {
    expect(precision([0, 50, 100, 150, 200])).toBe(1);
  });

  it('detects 0.1 precision for 2.5 steps', () => {
    expect(precision([0, 2.5, 5, 7.5, 10])).toBe(0.1);
  });

  it('detects 0.01 precision', () => {
    expect(precision([0, 0.05, 0.10, 0.15, 0.20])).toBe(0.01);
  });

  it('returns 1 for single value', () => {
    expect(precision([5])).toBe(1);
  });
});

describe('formatBreaks', () => {
  it('formats integers without decimals', () => {
    expect(formatBreaks([50, 100, 150, 200, 250, 300, 350])).toEqual(
      ['50', '100', '150', '200', '250', '300', '350']
    );
  });

  it('formats 2.5-step breaks with one decimal', () => {
    expect(formatBreaks([0, 2.5, 5, 7.5, 10])).toEqual(
      ['0.0', '2.5', '5.0', '7.5', '10.0']
    );
  });

  it('formats 0.25-step breaks with two decimals', () => {
    expect(formatBreaks([0, 0.25, 0.5, 0.75, 1])).toEqual(
      ['0.00', '0.25', '0.50', '0.75', '1.00']
    );
  });
});
