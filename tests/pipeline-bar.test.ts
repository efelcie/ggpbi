/**
 * Pipeline tests for bar charts — stacking, stat resolution, y-domain.
 * Pure tests (no JSDOM needed for buildPlot).
 */
import { describe, it, expect } from 'vitest';
import * as d3 from 'd3';
import { buildPlot } from '../src/pipeline';
import { resolveLayerStat } from '../src/pipeline';
import type { PlotSpec, Layer } from '../src/types';

describe('bar pipeline', () => {
  describe('stacked y-domain', () => {
    it('y-domain covers stacked totals (not just individual values)', () => {
      const spec: PlotSpec = {
        data: [
          { cat: 'A', val: 100, grp: 'X' },
          { cat: 'A', val: 80, grp: 'Y' },
          { cat: 'B', val: 50, grp: 'X' },
          { cat: 'B', val: 30, grp: 'Y' },
        ],
        aes: { x: 'cat', y: 'val', color: 'grp' },
        layers: [{ geom: { type: 'bar', position: 'stack' } }],
      };
      const built = buildPlot(spec);
      const yDomain = (built.scales.y as d3.ScaleLinear<number, number>).domain();
      // Stacked max for A = 100 + 80 = 180, so domain max must cover it
      expect(yDomain[1]).toBeGreaterThanOrEqual(180);
      // Domain min should include 0 (baseline)
      expect(yDomain[0]).toBeLessThanOrEqual(0);
    });

    it('y-domain covers negative stacked values', () => {
      const spec: PlotSpec = {
        data: [
          { cat: 'A', val: -50, grp: 'X' },
          { cat: 'A', val: -30, grp: 'Y' },
          { cat: 'B', val: 100, grp: 'X' },
          { cat: 'B', val: 50, grp: 'Y' },
        ],
        aes: { x: 'cat', y: 'val', color: 'grp' },
        layers: [{ geom: { type: 'bar', position: 'stack' } }],
      };
      const built = buildPlot(spec);
      const yDomain = (built.scales.y as d3.ScaleLinear<number, number>).domain();
      // Negative stack for A = -80
      expect(yDomain[0]).toBeLessThanOrEqual(-80);
      // Positive stack for B = 150
      expect(yDomain[1]).toBeGreaterThanOrEqual(150);
    });
  });

  describe('continuous x-axis padding', () => {
    it('x-domain expands for bars on continuous scale', () => {
      const spec: PlotSpec = {
        data: [
          { cyl: 4, count: 11 },
          { cyl: 6, count: 7 },
          { cyl: 8, count: 14 },
        ],
        aes: { x: 'cyl', y: 'count' },
        layers: [{ geom: { type: 'bar' } }],
      };
      const built = buildPlot(spec);
      const xDomain = (built.scales.x as d3.ScaleLinear<number, number>).domain();
      // Without bar padding domain would be ~3.8; with padding it should be ≤3.6
      expect(xDomain[0]).toBeLessThan(3.6);
      // Same for x=8 → domain max must extend well above 8
      expect(xDomain[1]).toBeGreaterThan(8.4);
    });
  });

  describe('stat resolution', () => {
    it('bar with y mapped → stat_identity', () => {
      const layer: Layer = { geom: { type: 'bar' } };
      expect(resolveLayerStat(layer, { x: 'cat', y: 'val' })).toBe('identity');
    });

    it('bar without y → stat_count', () => {
      const layer: Layer = { geom: { type: 'bar' } };
      expect(resolveLayerStat(layer, { x: 'cat' })).toBe('count');
    });

    it('col always → stat_identity (explicit stat on geom)', () => {
      const layer: Layer = { geom: { type: 'col', stat: 'identity' } };
      expect(resolveLayerStat(layer, { x: 'cat' })).toBe('identity');
    });
  });
});
