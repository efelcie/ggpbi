import { describe, it, expect } from 'vitest';
import { bindData, validateAes } from '../src/bind-data';

const sampleData = [
  { x: 1, y: 10, color: 'a', size: 3 },
  { x: 2, y: 20, color: 'b', size: 5 },
  { x: 3, y: 30, color: 'a', size: 7 },
];

describe('bindData', () => {
  it('binds x and y from aes mapping', () => {
    const bound = bindData(sampleData, { x: 'x', y: 'y' });
    expect(bound).toHaveLength(3);
    expect(bound[0].x).toBe(1);
    expect(bound[0].y).toBe(10);
    expect(bound[1].x).toBe(2);
    expect(bound[2].y).toBe(30);
  });

  it('binds optional aesthetics (color, size)', () => {
    const bound = bindData(sampleData, { x: 'x', y: 'y', color: 'color', size: 'size' });
    expect(bound[0].color).toBe('a');
    expect(bound[1].size).toBe(5);
  });

  it('leaves optional aesthetics undefined when not mapped', () => {
    const bound = bindData(sampleData, { x: 'x', y: 'y' });
    expect(bound[0].color).toBeUndefined();
    expect(bound[0].size).toBeUndefined();
  });

  it('preserves original datum', () => {
    const bound = bindData(sampleData, { x: 'x', y: 'y' });
    expect(bound[0].datum).toBe(sampleData[0]);
  });

  it('returns empty array for empty data', () => {
    const bound = bindData([], { x: 'x', y: 'y' });
    expect(bound).toEqual([]);
  });

  it('handles missing aes.x/y gracefully', () => {
    const bound = bindData(sampleData, {} as any);
    expect(bound[0].x).toBeUndefined();
    expect(bound[0].y).toBeUndefined();
  });
});

describe('validateAes', () => {
  it('passes when aes.x and aes.y match data fields', () => {
    expect(() => validateAes(sampleData, { x: 'x', y: 'y' })).not.toThrow();
  });

  it('throws when aes.x is missing', () => {
    expect(() => validateAes(sampleData, { y: 'y' } as any)).toThrow(/aes\.x is not set/);
  });

  it('throws when aes.y is missing', () => {
    expect(() => validateAes(sampleData, { x: 'x' } as any)).toThrow(/aes\.y is not set/);
  });

  it('throws when aes.x field not in data — lists available fields', () => {
    expect(() => validateAes(sampleData, { x: 'nope', y: 'y' })).toThrow(/field "nope" not found in data/);
    expect(() => validateAes(sampleData, { x: 'nope', y: 'y' })).toThrow(/Available:/);
  });

  it('throws when aes.y field not in data', () => {
    expect(() => validateAes(sampleData, { x: 'x', y: 'revenue' })).toThrow(/field "revenue" not found in data/);
  });

  it('passes on empty data (no sample to check)', () => {
    expect(() => validateAes([], { x: 'x', y: 'y' })).not.toThrow();
  });
});
