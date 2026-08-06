import { describe, it, expect } from 'vitest';
import {
  statSmooth,
  STAT_SMOOTH_X,
  STAT_SMOOTH_Y,
  STAT_SMOOTH_YMIN,
  STAT_SMOOTH_YMAX,
  STAT_SMOOTH_SE,
  buildPlot,
  resolveLayerStat,
} from '../src/index';
import { smoothToScene } from '../src/geoms/smooth';
import { bindData } from '../src/bind-data';
import * as d3 from 'd3';

// --- Test data ---

/** Simple linear data: y = 2x + 1 */
const linearData = Array.from({ length: 20 }, (_, i) => ({
  x: i,
  y: 2 * i + 1,
}));

/** Noisy linear data: y = 2x + noise */
const noisyLinearData = Array.from({ length: 50 }, (_, i) => ({
  x: i,
  y: 2 * i + Math.sin(i) * 5,
}));

/** Grouped data with two series */
const groupedData = [
  ...Array.from({ length: 20 }, (_, i) => ({ x: i, y: i * 2, group: 'A' })),
  ...Array.from({ length: 20 }, (_, i) => ({ x: i, y: i * 3 + 5, group: 'B' })),
];

/** Small dataset (< 1000) */
const smallData = Array.from({ length: 30 }, (_, i) => ({
  x: i,
  y: Math.sin(i * 0.3) * 10 + 50,
}));

/** Data with NA values */
const dataWithNA = [
  { x: 1, y: 10 }, { x: 2, y: null }, { x: 3, y: 30 },
  { x: null, y: 40 }, { x: 5, y: 50 }, { x: 6, y: NaN },
  { x: 7, y: 70 }, { x: 8, y: 80 }, { x: 9, y: 90 },
];

// ---------------------------------------------------------------------------
// stat_smooth — core smoothing algorithms
// ---------------------------------------------------------------------------

describe('stat_smooth', () => {
  describe('basic operation', () => {
    it('produces n evaluation points (default 80)', () => {
      const result = statSmooth(linearData, 'x', 'y');
      expect(result).toHaveLength(80);
    });

    it('produces custom n evaluation points', () => {
      const result = statSmooth(linearData, 'x', 'y', { n: 50 });
      expect(result).toHaveLength(50);
    });

    it('all rows have computed variables', () => {
      const result = statSmooth(linearData, 'x', 'y');
      for (const r of result) {
        expect(r[STAT_SMOOTH_X]).toBeDefined();
        expect(r[STAT_SMOOTH_Y]).toBeDefined();
        expect(r[STAT_SMOOTH_YMIN]).toBeDefined();
        expect(r[STAT_SMOOTH_YMAX]).toBeDefined();
        expect(r[STAT_SMOOTH_SE]).toBeDefined();
      }
    });

    it('evaluation points span the data range', () => {
      const result = statSmooth(linearData, 'x', 'y');
      const xs = result.map(r => r[STAT_SMOOTH_X] as number);
      expect(Math.min(...xs)).toBeCloseTo(0, 5);
      expect(Math.max(...xs)).toBeCloseTo(19, 5);
    });

    it('returns empty for fewer than 2 unique x values', () => {
      const sameX = [{ x: 5, y: 10 }, { x: 5, y: 20 }, { x: 5, y: 30 }];
      const result = statSmooth(sameX, 'x', 'y');
      expect(result).toHaveLength(0);
    });

    it('filters NA values from input', () => {
      const result = statSmooth(dataWithNA, 'x', 'y');
      // Should produce results from the valid points only
      expect(result.length).toBeGreaterThan(0);
      // All fitted values should be finite
      for (const r of result) {
        expect(Number.isFinite(r[STAT_SMOOTH_Y])).toBe(true);
      }
    });
  });

  describe('linear regression (method=lm)', () => {
    it('perfectly fits a linear relationship', () => {
      const result = statSmooth(linearData, 'x', 'y', { method: 'lm', n: 20 });
      // For y = 2x + 1, fitted values should be very close
      for (const r of result) {
        const xVal = r[STAT_SMOOTH_X] as number;
        const yFit = r[STAT_SMOOTH_Y] as number;
        expect(yFit).toBeCloseTo(2 * xVal + 1, 5);
      }
    });

    it('SE is near zero for perfect linear data', () => {
      const result = statSmooth(linearData, 'x', 'y', { method: 'lm' });
      for (const r of result) {
        expect(r[STAT_SMOOTH_SE] as number).toBeCloseTo(0, 5);
      }
    });

    it('confidence band is narrow for perfect data', () => {
      const result = statSmooth(linearData, 'x', 'y', { method: 'lm' });
      for (const r of result) {
        const yFit = r[STAT_SMOOTH_Y] as number;
        const yMin = r[STAT_SMOOTH_YMIN] as number;
        const yMax = r[STAT_SMOOTH_YMAX] as number;
        expect(yMin).toBeCloseTo(yFit, 3);
        expect(yMax).toBeCloseTo(yFit, 3);
      }
    });

    it('confidence band widens for noisy data', () => {
      const result = statSmooth(noisyLinearData, 'x', 'y', { method: 'lm' });
      // Band should be wider at edges
      const first = result[0];
      const middle = result[Math.floor(result.length / 2)];
      const edgeSE = first[STAT_SMOOTH_SE] as number;
      const midSE = middle[STAT_SMOOTH_SE] as number;
      expect(edgeSE).toBeGreaterThan(midSE);
    });

    it('wider confidence level = wider band', () => {
      const result95 = statSmooth(noisyLinearData, 'x', 'y', { method: 'lm', level: 0.95 });
      const result99 = statSmooth(noisyLinearData, 'x', 'y', { method: 'lm', level: 0.99 });
      // 99% band should be wider than 95%
      const width95 = (result95[0][STAT_SMOOTH_YMAX] as number) - (result95[0][STAT_SMOOTH_YMIN] as number);
      const width99 = (result99[0][STAT_SMOOTH_YMAX] as number) - (result99[0][STAT_SMOOTH_YMIN] as number);
      expect(width99).toBeGreaterThan(width95);
    });
  });

  describe('loess', () => {
    it('follows data more closely than lm for nonlinear data', () => {
      // Quadratic data — loess should fit better than lm
      const quadData = Array.from({ length: 50 }, (_, i) => ({
        x: i, y: i * i,
      }));
      const loessResult = statSmooth(quadData, 'x', 'y', { method: 'loess', n: 50 });
      const lmResult = statSmooth(quadData, 'x', 'y', { method: 'lm', n: 50 });

      // Compute total squared error for both
      let loessError = 0;
      let lmError = 0;
      for (let i = 0; i < 50; i++) {
        const xVal = loessResult[i][STAT_SMOOTH_X] as number;
        const trueY = xVal * xVal;
        const loessY = loessResult[i][STAT_SMOOTH_Y] as number;
        const lmY = lmResult[i][STAT_SMOOTH_Y] as number;
        loessError += (loessY - trueY) * (loessY - trueY);
        lmError += (lmY - trueY) * (lmY - trueY);
      }
      expect(loessError).toBeLessThan(lmError);
    });

    it('smaller span = more wiggle', () => {
      const sinData = Array.from({ length: 100 }, (_, i) => ({
        x: i * 0.1, y: Math.sin(i * 0.1) * 10,
      }));
      const smooth = statSmooth(sinData, 'x', 'y', { method: 'loess', span: 0.9, n: 50 });
      const wiggly = statSmooth(sinData, 'x', 'y', { method: 'loess', span: 0.3, n: 50 });

      // Compute roughness (sum of squared second differences)
      const roughness = (pts: any[]) => {
        let sum = 0;
        for (let i = 1; i < pts.length - 1; i++) {
          const d2 = (pts[i + 1][STAT_SMOOTH_Y] as number) - 2 * (pts[i][STAT_SMOOTH_Y] as number) + (pts[i - 1][STAT_SMOOTH_Y] as number);
          sum += d2 * d2;
        }
        return sum;
      };
      expect(roughness(wiggly)).toBeGreaterThan(roughness(smooth));
    });

    it('produces confidence bands', () => {
      const result = statSmooth(noisyLinearData, 'x', 'y', { method: 'loess' });
      for (const r of result) {
        const yFit = r[STAT_SMOOTH_Y] as number;
        const yMin = r[STAT_SMOOTH_YMIN] as number;
        const yMax = r[STAT_SMOOTH_YMAX] as number;
        expect(yMin).toBeLessThanOrEqual(yFit + 1e-10);
        expect(yMax).toBeGreaterThanOrEqual(yFit - 1e-10);
      }
    });
  });

  describe('moving average', () => {
    it('smooths data with moving average', () => {
      const result = statSmooth(noisyLinearData, 'x', 'y', { method: 'movingAverage', window: 5, n: 20 });
      expect(result).toHaveLength(20);
      for (const r of result) {
        expect(Number.isFinite(r[STAT_SMOOTH_Y] as number)).toBe(true);
      }
    });

    it('larger window = smoother curve', () => {
      const sinData = Array.from({ length: 100 }, (_, i) => ({
        x: i, y: Math.sin(i * 0.1) * 10 + Math.random(),
      }));
      const small = statSmooth(sinData, 'x', 'y', { method: 'movingAverage', window: 3, n: 50 });
      const large = statSmooth(sinData, 'x', 'y', { method: 'movingAverage', window: 15, n: 50 });

      const roughness = (pts: any[]) => {
        let sum = 0;
        for (let i = 1; i < pts.length - 1; i++) {
          const d2 = (pts[i + 1][STAT_SMOOTH_Y] as number) - 2 * (pts[i][STAT_SMOOTH_Y] as number) + (pts[i - 1][STAT_SMOOTH_Y] as number);
          sum += d2 * d2;
        }
        return sum;
      };
      expect(roughness(large)).toBeLessThan(roughness(small));
    });
  });

  describe('auto method selection', () => {
    it('uses loess for < 1000 observations', () => {
      const result = statSmooth(smallData, 'x', 'y', { method: 'auto', n: 10 });
      expect(result).toHaveLength(10);
      // Should behave like loess (we verify by checking it's not a straight line for curved data)
      const loessResult = statSmooth(smallData, 'x', 'y', { method: 'loess', n: 10 });
      for (let i = 0; i < 10; i++) {
        expect(result[i][STAT_SMOOTH_Y]).toBeCloseTo(loessResult[i][STAT_SMOOTH_Y] as number, 5);
      }
    });
  });

  describe('se=false suppresses confidence band', () => {
    it('omits ymin/ymax when se=false', () => {
      const result = statSmooth(linearData, 'x', 'y', { se: false });
      for (const r of result) {
        expect(r[STAT_SMOOTH_Y]).toBeDefined();
        expect(r[STAT_SMOOTH_YMIN]).toBeUndefined();
        expect(r[STAT_SMOOTH_YMAX]).toBeUndefined();
        expect(r[STAT_SMOOTH_SE]).toBeUndefined();
      }
    });
  });

  describe('fullrange parameter', () => {
    it('fullrange=false limits eval points to group data range', () => {
      const result = statSmooth(groupedData, 'x', 'y', { n: 10, fullrange: false }, 'group');
      const groupA = result.filter(r => r.group === 'A');
      const groupB = result.filter(r => r.group === 'B');
      const aXs = groupA.map(r => r[STAT_SMOOTH_X] as number);
      const bXs = groupB.map(r => r[STAT_SMOOTH_X] as number);
      // Group A: x 0-19, Group B: x 0-19 (same range in this data)
      expect(Math.min(...aXs)).toBeCloseTo(0, 5);
      expect(Math.min(...bXs)).toBeCloseTo(0, 5);
    });

    it('fullrange=true extends eval to full data range', () => {
      // Groups with different x ranges
      const splitData = [
        ...Array.from({ length: 10 }, (_, i) => ({ x: i, y: i * 2, g: 'A' })),
        ...Array.from({ length: 10 }, (_, i) => ({ x: i + 20, y: i * 3, g: 'B' })),
      ];
      const result = statSmooth(splitData, 'x', 'y', { n: 10, fullrange: true }, 'g');
      const groupA = result.filter(r => r.g === 'A');
      const aXs = groupA.map(r => r[STAT_SMOOTH_X] as number);
      // With fullrange, group A should extend to ~29 (max of B's range)
      expect(Math.max(...aXs)).toBeGreaterThan(15);
    });
  });

  describe('LOESS degree 2 (local quadratic)', () => {
    it('fits a quadratic relationship more accurately than degree 1 would', () => {
      // Quadratic data: y = x²
      const quadData = Array.from({ length: 50 }, (_, i) => ({
        x: i * 0.5, y: (i * 0.5) * (i * 0.5),
      }));
      const result = statSmooth(quadData, 'x', 'y', { method: 'loess', span: 0.5, n: 20 });
      // Check a mid-range point: x=12.5, expected y=156.25
      const midPoint = result.find(r => Math.abs((r[STAT_SMOOTH_X] as number) - 12.5) < 1);
      if (midPoint) {
        const yFit = midPoint[STAT_SMOOTH_Y] as number;
        const expected = 12.5 * 12.5;
        // Degree 2 should fit within ~15% for smooth quadratic data with span=0.5
        expect(Math.abs(yFit - expected) / expected).toBeLessThan(0.15);
      }
    });
  });

  describe('error handling', () => {
    it('handles degenerate data gracefully', () => {
      // All same y values — should not throw
      const flatData = Array.from({ length: 10 }, (_, i) => ({ x: i, y: 5 }));
      const result = statSmooth(flatData, 'x', 'y', { method: 'lm' });
      expect(result.length).toBe(80);
      // All fitted values should be ~5
      for (const r of result) {
        expect(r[STAT_SMOOTH_Y]).toBeCloseTo(5, 5);
      }
    });
  });

  describe('grouped smoothing', () => {
    it('produces separate curves per color group', () => {
      const result = statSmooth(groupedData, 'x', 'y', { n: 10 }, 'group');
      // 2 groups × 10 points = 20 rows
      expect(result).toHaveLength(20);
      // Check groups are present
      const groups = new Set(result.map(r => r.group));
      expect(groups.size).toBe(2);
      expect(groups.has('A')).toBe(true);
      expect(groups.has('B')).toBe(true);
    });

    it('group B has higher fitted values than group A', () => {
      const result = statSmooth(groupedData, 'x', 'y', { method: 'lm', n: 10 }, 'group');
      const groupA = result.filter(r => r.group === 'A');
      const groupB = result.filter(r => r.group === 'B');
      // At x=10, B should be higher (y=3*10+5=35 vs y=2*10=20)
      const midA = groupA[5][STAT_SMOOTH_Y] as number;
      const midB = groupB[5][STAT_SMOOTH_Y] as number;
      expect(midB).toBeGreaterThan(midA);
    });
  });
});

// ---------------------------------------------------------------------------
// smooth scene builder
// ---------------------------------------------------------------------------

describe('smoothToScene', () => {
  const makeScaleAndData = () => {
    const smoothed = statSmooth(noisyLinearData, 'x', 'y', { method: 'lm', n: 20 });
    const bound = bindData(smoothed, { x: 'x', y: STAT_SMOOTH_Y });
    // Attach original datum for CI access
    const boundWithDatum = bound.map((bp, i) => ({
      ...bp,
      datum: smoothed[i],
    }));

    const xScale = d3.scaleLinear().domain([0, 49]).range([0, 500]);
    const yScale = d3.scaleLinear().domain([0, 120]).range([400, 0]);
    return { boundWithDatum, xScale, yScale };
  };

  it('produces line + ribbon for default config', () => {
    const { boundWithDatum, xScale, yScale } = makeScaleAndData();
    const nodes = smoothToScene(boundWithDatum, xScale, yScale, { type: 'smooth' });
    // Should have ribbon + line
    expect(nodes.length).toBe(2);
    const ribbon = nodes.find(n => (n as any).class === 'ggpbi-smooth-ribbon');
    const line = nodes.find(n => (n as any).class === 'ggpbi-smooth-line');
    expect(ribbon).toBeDefined();
    expect(line).toBeDefined();
  });

  it('ribbon has fill, no stroke', () => {
    const { boundWithDatum, xScale, yScale } = makeScaleAndData();
    const nodes = smoothToScene(boundWithDatum, xScale, yScale, { type: 'smooth' });
    const ribbon = nodes.find(n => (n as any).class === 'ggpbi-smooth-ribbon')!;
    expect(ribbon.style.fill).toBeDefined();
    expect(ribbon.style.stroke).toBe('none');
  });

  it('line is fully opaque', () => {
    const { boundWithDatum, xScale, yScale } = makeScaleAndData();
    const nodes = smoothToScene(boundWithDatum, xScale, yScale, { type: 'smooth' });
    const line = nodes.find(n => (n as any).class === 'ggpbi-smooth-line')!;
    expect(line.style.opacity).toBe(1);
  });

  it('ribbon is semi-transparent (alpha=0.4)', () => {
    const { boundWithDatum, xScale, yScale } = makeScaleAndData();
    const nodes = smoothToScene(boundWithDatum, xScale, yScale, { type: 'smooth' });
    const ribbon = nodes.find(n => (n as any).class === 'ggpbi-smooth-ribbon')!;
    expect(ribbon.style.opacity).toBe(0.4);
  });

  it('no ribbon when se=false', () => {
    const { boundWithDatum, xScale, yScale } = makeScaleAndData();
    const nodes = smoothToScene(boundWithDatum, xScale, yScale, { type: 'smooth', se: false });
    const ribbon = nodes.find(n => (n as any).class === 'ggpbi-smooth-ribbon');
    expect(ribbon).toBeUndefined();
    const line = nodes.find(n => (n as any).class === 'ggpbi-smooth-line');
    expect(line).toBeDefined();
  });

  it('uses custom line color', () => {
    const { boundWithDatum, xScale, yScale } = makeScaleAndData();
    const nodes = smoothToScene(boundWithDatum, xScale, yScale, { type: 'smooth', color: '#FF0000' });
    const line = nodes.find(n => (n as any).class === 'ggpbi-smooth-line')!;
    expect(line.style.stroke).toBe('#FF0000');
  });

  it('uses custom fill color for ribbon', () => {
    const { boundWithDatum, xScale, yScale } = makeScaleAndData();
    const nodes = smoothToScene(boundWithDatum, xScale, yScale, { type: 'smooth', fill: '#00FF00' });
    const ribbon = nodes.find(n => (n as any).class === 'ggpbi-smooth-ribbon')!;
    expect(ribbon.style.fill).toBe('#00FF00');
  });

  it('default fill is grey (ggplot2: col_mix(ink, paper, 0.6))', () => {
    const { boundWithDatum, xScale, yScale } = makeScaleAndData();
    const nodes = smoothToScene(boundWithDatum, xScale, yScale, { type: 'smooth' });
    const ribbon = nodes.find(n => (n as any).class === 'ggpbi-smooth-ribbon')!;
    expect(ribbon.style.fill).toBe('#999999');
  });

  it('returns empty for empty points', () => {
    const xScale = d3.scaleLinear().domain([0, 10]).range([0, 500]);
    const yScale = d3.scaleLinear().domain([0, 100]).range([400, 0]);
    const nodes = smoothToScene([], xScale, yScale, { type: 'smooth' });
    expect(nodes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Pipeline integration
// ---------------------------------------------------------------------------

describe('pipeline integration', () => {
  it('resolves stat_smooth for smooth geom', () => {
    const statType = resolveLayerStat(
      { geom: { type: 'smooth' } },
      { x: 'x', y: 'y' },
    );
    expect(statType).toBe('smooth');
  });

  it('buildPlot produces layers for smooth geom', () => {
    const plot = buildPlot({
      data: noisyLinearData,
      aes: { x: 'x', y: 'y' },
      layers: [{ geom: { type: 'smooth' } }],
    });
    expect(plot.layers).toHaveLength(1);
    expect(plot.layers[0].geom.type).toBe('smooth');
    // Smooth layer should have evaluation points, not raw data
    expect(plot.layers[0].data.length).toBe(80); // default n=80
  });

  it('buildPlot handles point + smooth multi-layer', () => {
    const plot = buildPlot({
      data: noisyLinearData,
      aes: { x: 'x', y: 'y' },
      layers: [
        { geom: { type: 'point' } },
        { geom: { type: 'smooth' } },
      ],
    });
    expect(plot.layers).toHaveLength(2);
    // Point layer has raw data
    expect(plot.layers[0].data.length).toBe(50);
    expect(plot.layers[0].geom.type).toBe('point');
    // Smooth layer has evaluation points
    expect(plot.layers[1].data.length).toBe(80);
    expect(plot.layers[1].geom.type).toBe('smooth');
  });

  it('smooth with custom method=lm', () => {
    const plot = buildPlot({
      data: noisyLinearData,
      aes: { x: 'x', y: 'y' },
      layers: [{ geom: { type: 'smooth', method: 'lm' } }],
    });
    expect(plot.layers[0].data.length).toBe(80);
  });

  it('smooth with se=false', () => {
    const plot = buildPlot({
      data: noisyLinearData,
      aes: { x: 'x', y: 'y' },
      layers: [{ geom: { type: 'smooth', se: false } }],
    });
    expect(plot.layers[0].data.length).toBe(80);
  });
});
