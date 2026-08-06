/**
 * NA robustness across position adjustments and geoms.
 *
 * A single missing value must never destroy surrounding output:
 * stacks keep accumulating, paths render without NaN coordinates,
 * labels are skipped instead of placed at NaN.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as d3 from 'd3';
import { applyStack } from '../src/position';
import { areaToScene } from '../src/geoms/area';
import { textToScene } from '../src/geoms/text';
import { barsToScene } from '../src/geoms/bar';
import { smoothToScene } from '../src/geoms/smooth';
import { filterNA } from '../src/geoms/util';
import { bindData, type BoundPoint } from '../src/bind-data';

afterEach(() => {
  vi.restoreAllMocks();
});

function linearScale(domain: [number, number], range: [number, number]) {
  return d3.scaleLinear().domain(domain).range(range);
}

function bandScale(domain: string[], range: [number, number]) {
  return d3.scaleBand().domain(domain).range(range).padding(0.1);
}

describe('applyStack with non-finite values', () => {
  it('does not poison later segments in the same category', () => {
    const points: BoundPoint[] = [
      { x: 'A', y: 10, color: 'a', datum: {} },
      { x: 'A', y: undefined, color: 'b', datum: {} },
      { x: 'A', y: 20, color: 'c', datum: {} },
    ];
    const stacked = applyStack(points);

    // First segment normal
    expect(stacked[0]._v0).toBe(0);
    expect(stacked[0]._v1).toBe(10);
    // Non-finite value → zero-height segment, finite edges
    expect(stacked[1]._v0).toBe(10);
    expect(stacked[1]._v1).toBe(10);
    // Later segment continues the stack unharmed
    expect(stacked[2]._v0).toBe(10);
    expect(stacked[2]._v1).toBe(30);
  });

  it('handles non-numeric strings the same way', () => {
    const points: BoundPoint[] = [
      { x: 'A', y: 'n/a', color: 'a', datum: {} },
      { x: 'A', y: 5, color: 'b', datum: {} },
    ];
    const stacked = applyStack(points);
    expect(stacked[0]._v0).toBe(0);
    expect(stacked[0]._v1).toBe(0);
    expect(stacked[1]._v1).toBe(5);
  });
});

describe('area with NA values', () => {
  it('renders a path without NaN coordinates when one y is missing', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const data = [
      { x: 1, y: 5 }, { x: 2, y: null }, { x: 3, y: 8 }, { x: 4, y: 6 },
    ];
    const points = bindData(data, { x: 'x', y: 'y' });
    const nodes = areaToScene(
      points, linearScale([1, 4], [0, 100]), linearScale([0, 10], [100, 0]),
      { type: 'area' },
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].d).not.toContain('NaN');
  });

  it('warns unless naRm is set', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const data = [{ x: 1, y: 5 }, { x: 2, y: null }, { x: 3, y: 8 }];
    const points = bindData(data, { x: 'x', y: 'y' });
    const xs = linearScale([1, 3], [0, 100]);
    const ys = linearScale([0, 10], [100, 0]);

    areaToScene(points, xs, ys, { type: 'area' });
    expect(warn).toHaveBeenCalledOnce();

    warn.mockClear();
    areaToScene(points, xs, ys, { type: 'area', naRm: true });
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('text with NA values', () => {
  it('skips labels at NaN positions instead of emitting them', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const data = [{ x: 1, y: 5 }, { x: 2, y: NaN }, { x: 3, y: 8 }];
    const points = bindData(data, { x: 'x', y: 'y' });
    const nodes = textToScene(
      points, linearScale([1, 3], [0, 100]), linearScale([0, 10], [100, 0]),
      { type: 'text' },
    );
    expect(nodes).toHaveLength(2);
    for (const n of nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });
});

describe('smooth with NA values', () => {
  it('renders line path without NaN coordinates', () => {
    const data = [{ x: 1, y: 5 }, { x: 2, y: NaN }, { x: 3, y: 8 }];
    const points = bindData(data, { x: 'x', y: 'y' });
    const nodes = smoothToScene(
      points, linearScale([1, 3], [0, 100]), linearScale([0, 10], [100, 0]),
      { type: 'smooth' },
    );
    expect(nodes.length).toBeGreaterThan(0);
    for (const n of nodes) {
      expect((n as any).d).not.toContain('NaN');
    }
  });
});

describe('horizontal bars with NA values', () => {
  it('filters missing x (value axis) for orientation=y', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const data = [
      { cat: 'A', val: 10 }, { cat: 'B', val: null }, { cat: 'C', val: 20 },
    ];
    // Horizontal: x = value, y = category
    const points = bindData(data, { x: 'val', y: 'cat' });
    const nodes = barsToScene(
      points,
      linearScale([0, 25], [0, 200]),
      bandScale(['A', 'B', 'C'], [0, 150]),
      { type: 'bar', orientation: 'y', position: 'identity' },
    );
    expect(nodes).toHaveLength(2);
    for (const n of nodes) {
      expect(Number.isFinite(n.width)).toBe(true);
      expect(Number.isFinite(n.x)).toBe(true);
    }
  });
});

describe('filterNA with Invalid Date', () => {
  it('treats Invalid Date as NA', () => {
    const points: BoundPoint[] = [
      { x: new Date('2024-01-01'), y: 1, datum: {} },
      { x: new Date('not a date'), y: 2, datum: {} },
    ];
    const filtered = filterNA(points, true, 'test');
    expect(filtered).toHaveLength(1);
  });
});
