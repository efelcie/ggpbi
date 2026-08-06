/**
 * Hostile-data robustness: the states a real report reaches by slicing.
 *
 * A measure that returns BLANK for the current selection, or a group with
 * a single observation, must fail with a message that names the real
 * cause — not with advice to swap a field that is perfectly fine.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ggpbi } from '../src/index';
import { createScale } from '../src/scales';

function container(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 800 });
  Object.defineProperty(el, 'clientHeight', { value: 600 });
  document.body.appendChild(el);
  return el;
}

describe('empty and undersized data', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('an all-blank measure is reported as a filter state', () => {
    const data = Array.from({ length: 50 }, (_, i) => ({ x: i, y: null }));
    expect(() =>
      ggpbi().data(data).aes({ x: 'x', y: 'y' }).geom('point').size(800, 600).renderTo(container()),
    ).toThrow(/field "y" has no values in the current filter context/);
  });

  it('the same holds for the x axis', () => {
    const data = Array.from({ length: 10 }, () => ({ x: null, y: null }));
    expect(() =>
      ggpbi().data(data).aes({ x: 'x', y: 'y' }).geom('point').size(800, 600).renderTo(container()),
    ).toThrow(/field "x" has no values in the current filter context/);
  });

  it('a field with real values keeps its type-specific message', () => {
    // Regression guard: the emptiness check must not swallow the case it
    // was carved out of — text in a numeric well still says so.
    expect(() => createScale([{ v: 'north' }, { v: 'south' }], 'v', 'linear', [0, 100]))
      .toThrow(/no numeric values in field "v" for linear scale/);
  });

  it('NaN counts as absent, but a mix still scales', () => {
    expect(() => createScale([{ v: NaN }, { v: NaN }], 'v', 'linear', [0, 100]))
      .toThrow(/has no values in the current filter context/);
    expect(() => createScale([{ v: NaN }, { v: 3 }], 'v', 'linear', [0, 100])).not.toThrow();
  });

  it('the empty string stays a category, so y-only pseudo bands survive', () => {
    // The y-only path builds its single band from a constant empty string;
    // treating that as "no values" would break every measure-only chart.
    expect(() => createScale([{ v: '' }, { v: '' }], 'v', 'category', [0, 100])).not.toThrow();
    const el = container();
    const svg = ggpbi().data([{ y: 1 }, { y: 2 }, { y: 3 }]).aes({ y: 'y' } as any)
      .geom('bar').size(800, 600).renderTo(el);
    expect(svg.querySelectorAll('.ggpbi-geom-clip rect').length).toBeGreaterThan(0);
    expect(svg.innerHTML).not.toMatch(/NaN/);
  });

  it('a density of one observation names the stat, not the field', () => {
    expect(() =>
      ggpbi().data([{ x: 5 }]).aes({ x: 'x' }).geom('density').size(800, 600).renderTo(container()),
    ).toThrow(/stat "density" needs at least 2 values per group/);
  });

  it('empty data renders an empty plot rather than throwing', () => {
    const el = container();
    expect(() =>
      ggpbi().data([]).aes({ x: 'x', y: 'y' }).geom('point').size(800, 600).renderTo(el),
    ).not.toThrow();
    expect(el.querySelector('svg')).toBeTruthy();
  });

  it('single rows, constant values and extreme magnitudes still render', () => {
    const cases: Array<[string, any[]]> = [
      ['single row', [{ x: 1, y: 2 }]],
      ['constant y', Array.from({ length: 20 }, (_, i) => ({ x: i, y: 7 }))],
      ['huge magnitudes', [{ x: 1e-12, y: 1e15 }, { x: 2e-12, y: 2e15 }]],
      ['NaN mixed in', [{ x: 1, y: NaN }, { x: 2, y: 4 }]],
    ];
    for (const [name, data] of cases) {
      const el = container();
      expect(() =>
        ggpbi().data(data).aes({ x: 'x', y: 'y' }).geom('point').size(800, 600).renderTo(el),
        name,
      ).not.toThrow();
      expect(el.querySelector('svg'), name).toBeTruthy();
    }
  });
});
