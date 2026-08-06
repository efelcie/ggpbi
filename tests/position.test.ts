/**
 * Tests for position adjustments — pure data transforms, NO JSDOM needed.
 *
 * applyDodge, applyStack, applyFill, computePosition are all pure functions
 * that operate on BoundPoint arrays without any DOM or scale dependency.
 */
import { describe, it, expect } from 'vitest';
import { applyDodge, applyStack, applyFill, computePosition } from '../src/position';
import { bindData, type BoundPoint } from '../src/bind-data';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bind(data: Record<string, any>[], x: string, y: string, color?: string): BoundPoint[] {
  return bindData(data, { x, y, color });
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const groupedData = [
  { cat: 'A', val: 10, grp: 'X' },
  { cat: 'A', val: 20, grp: 'Y' },
  { cat: 'B', val: 30, grp: 'X' },
  { cat: 'B', val: 15, grp: 'Y' },
];

const negativeData = [
  { cat: 'A', val: 10, grp: 'X' },
  { cat: 'A', val: -5, grp: 'Y' },
  { cat: 'B', val: -20, grp: 'X' },
  { cat: 'B', val: 15, grp: 'Y' },
];

// ---------------------------------------------------------------------------
// applyDodge
// ---------------------------------------------------------------------------

describe('applyDodge (pure, no JSDOM)', () => {
  it('annotates each point with _dodgeIndex and _dodgeN', () => {
    const points = bind(groupedData, 'cat', 'val', 'grp');
    const dodged = applyDodge(points);

    expect(dodged).toHaveLength(4);
    for (const d of dodged) {
      expect(d._dodgeIndex).toBeDefined();
      expect(d._dodgeN).toBeDefined();
      expect(typeof d._dodgeIndex).toBe('number');
      expect(typeof d._dodgeN).toBe('number');
    }
  });

  it('_dodgeN equals number of unique color groups', () => {
    const points = bind(groupedData, 'cat', 'val', 'grp');
    const dodged = applyDodge(points);

    for (const d of dodged) {
      expect(d._dodgeN).toBe(2); // X and Y
    }
  });

  it('same color group gets same _dodgeIndex', () => {
    const points = bind(groupedData, 'cat', 'val', 'grp');
    const dodged = applyDodge(points);

    const groupX = dodged.filter(d => d.color === 'X');
    const groupY = dodged.filter(d => d.color === 'Y');

    expect(groupX[0]._dodgeIndex).toBe(groupX[1]._dodgeIndex);
    expect(groupY[0]._dodgeIndex).toBe(groupY[1]._dodgeIndex);
    expect(groupX[0]._dodgeIndex).not.toBe(groupY[0]._dodgeIndex);
  });

  it('padded flag set for dodge2', () => {
    const points = bind(groupedData, 'cat', 'val', 'grp');
    const dodged = applyDodge(points, true);

    for (const d of dodged) {
      expect(d._dodgePadded).toBe(true);
    }
  });

  it('does not mutate original points', () => {
    const points = bind(groupedData, 'cat', 'val', 'grp');
    const original = points.map(p => ({ ...p }));
    applyDodge(points);

    for (let i = 0; i < points.length; i++) {
      expect(points[i]).toEqual(original[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// applyStack
// ---------------------------------------------------------------------------

describe('applyStack (pure, no JSDOM)', () => {
  it('computes _v0 and _v1 for each point', () => {
    const points = bind(groupedData, 'cat', 'val', 'grp');
    const stacked = applyStack(points);

    expect(stacked).toHaveLength(4);
    for (const d of stacked) {
      expect(d._v0).toBeDefined();
      expect(d._v1).toBeDefined();
      expect(typeof d._v0).toBe('number');
      expect(typeof d._v1).toBe('number');
    }
  });

  it('first item in each group starts at _v0=0', () => {
    const points = bind(groupedData, 'cat', 'val', 'grp');
    const stacked = applyStack(points);

    // Group by x, first item per group should have _v0=0
    const catA = stacked.filter(d => d.x === 'A');
    expect(catA[0]._v0).toBe(0);
  });

  it('stacks correctly: second item starts where first ends', () => {
    const points = bind(groupedData, 'cat', 'val', 'grp');
    const stacked = applyStack(points);

    const catA = stacked.filter(d => d.x === 'A');
    // First: _v0=0, _v1=10
    expect(catA[0]._v0).toBe(0);
    expect(catA[0]._v1).toBe(10);
    // Second: _v0=10, _v1=30
    expect(catA[1]._v0).toBe(10);
    expect(catA[1]._v1).toBe(30);
  });

  it('handles negative values (diverging stacks)', () => {
    const points = bind(negativeData, 'cat', 'val', 'grp');
    const stacked = applyStack(points);

    const catA = stacked.filter(d => d.x === 'A');
    // First item: val=10 (positive), _v0=0, _v1=10
    expect(catA[0]._v0).toBe(0);
    expect(catA[0]._v1).toBe(10);
    // Second item: val=-5 (negative), stacks downward
    expect(catA[1]._v0).toBe(-5);
    expect(catA[1]._v1).toBe(0);
  });

  it('does not mutate original points', () => {
    const points = bind(groupedData, 'cat', 'val', 'grp');
    const original = points.map(p => ({ ...p }));
    applyStack(points);

    for (let i = 0; i < points.length; i++) {
      expect(points[i]).toEqual(original[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// applyFill
// ---------------------------------------------------------------------------

describe('applyFill (pure, no JSDOM)', () => {
  it('normalizes _v0 and _v1 to [0, 1] per category', () => {
    const points = bind(groupedData, 'cat', 'val', 'grp');
    const filled = applyFill(points);

    const catA = filled.filter(d => d.x === 'A');
    // Total for A: 10 + 20 = 30
    // First: 0 → 10/30 ≈ 0.333
    expect(catA[0]._v0).toBeCloseTo(0, 5);
    expect(catA[0]._v1).toBeCloseTo(10 / 30, 5);
    // Second: 10/30 → 30/30 = 1.0
    expect(catA[1]._v0).toBeCloseTo(10 / 30, 5);
    expect(catA[1]._v1).toBeCloseTo(1.0, 5);
  });

  it('each category sums to 1.0', () => {
    const points = bind(groupedData, 'cat', 'val', 'grp');
    const filled = applyFill(points);

    // Group by x and check max _v1
    const catA = filled.filter(d => d.x === 'A');
    const catB = filled.filter(d => d.x === 'B');

    const maxA = Math.max(...catA.map(d => d._v1!));
    const maxB = Math.max(...catB.map(d => d._v1!));
    expect(maxA).toBeCloseTo(1.0, 5);
    expect(maxB).toBeCloseTo(1.0, 5);
  });

  it('normalizes diverging stacks independently (ggplot2 behavior)', () => {
    // Positive values normalize to [0, 1], negative to [-1, 0]
    const data = [
      { cat: 'A', val: 100, grp: 'X' },
      { cat: 'A', val: -50, grp: 'Y' },
    ];
    const points = bind(data, 'cat', 'val', 'grp');
    const filled = applyFill(points);

    const pos = filled.find(d => d.y === 100)!;
    const neg = filled.find(d => d.y === -50)!;

    // Positive: 100 is the only positive value → fills [0, 1]
    expect(pos._v0).toBeCloseTo(0, 5);
    expect(pos._v1).toBeCloseTo(1.0, 5);

    // Negative: -50 is the only negative value → fills [-1, 0]
    expect(neg._v0).toBeCloseTo(-1.0, 5);
    expect(neg._v1).toBeCloseTo(0, 5);
  });

  it('normalizes multiple negative values to [-1, 0]', () => {
    const data = [
      { cat: 'A', val: -30, grp: 'X' },
      { cat: 'A', val: -70, grp: 'Y' },
    ];
    const points = bind(data, 'cat', 'val', 'grp');
    const filled = applyFill(points);

    // Total negative = -100
    // First: [-30/100, 0] = [-0.3, 0]
    // Second: [-100/100, -30/100] = [-1.0, -0.3]
    const minV0 = Math.min(...filled.map(d => d._v0!));
    expect(minV0).toBeCloseTo(-1.0, 5);
  });
});

// ---------------------------------------------------------------------------
// computePosition (dispatcher)
// ---------------------------------------------------------------------------

describe('computePosition (pure, no JSDOM)', () => {
  it('dispatches to applyDodge for dodge position', () => {
    const points = bind(groupedData, 'cat', 'val', 'grp');
    const result = computePosition(points, { type: 'bar', position: 'dodge' });

    expect(result[0]._dodgeIndex).toBeDefined();
    expect(result[0]._dodgeN).toBeDefined();
  });

  it('dispatches to applyStack for stack position', () => {
    const points = bind(groupedData, 'cat', 'val', 'grp');
    const result = computePosition(points, { type: 'bar', position: 'stack' });

    expect(result[0]._v0).toBeDefined();
    expect(result[0]._v1).toBeDefined();
  });

  it('dispatches to applyFill for fill position', () => {
    const points = bind(groupedData, 'cat', 'val', 'grp');
    const result = computePosition(points, { type: 'bar', position: 'fill' });

    expect(result[0]._v0).toBeDefined();
    // Fill should normalize
    const catA = result.filter(d => d.x === 'A');
    const maxV1 = Math.max(...catA.map(d => d._v1!));
    expect(maxV1).toBeCloseTo(1.0, 5);
  });

  it('identity position returns copies (no position metadata)', () => {
    const points = bind(groupedData, 'cat', 'val', 'grp');
    const result = computePosition(points, { type: 'bar', position: 'identity' });

    expect(result).toHaveLength(4);
    expect(result[0]._v0).toBeUndefined();
    expect(result[0]._dodgeIndex).toBeUndefined();
  });
});
