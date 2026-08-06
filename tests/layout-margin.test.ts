import { describe, it, expect, beforeEach } from 'vitest';
import { buildPlot, computeLayout, estimateYTickLabelWidth, estimateTextWidth } from '../src/pipeline';
import { resolveTheme } from '../src/theme';
import { renderWithState } from '../src/render';
import type { PlotSpec } from '../src/types';

const theme = resolveTheme();

const categoryData = [
  { x: 0.05, sector: 'Electronics' },
  { x: 0.08, sector: 'Pharmacy' },
  { x: 0.02, sector: 'Gastronomy' },
  { x: 0.12, sector: 'Home Furnishing' },
  { x: 0.2, sector: 'Food Retail' },
  { x: 0.07, sector: 'Perfumery' },
];

function specWith(overrides: Partial<PlotSpec> = {}): PlotSpec {
  return {
    data: categoryData,
    aes: { x: 'x', y: 'sector' },
    layers: [{ geom: { type: 'point' } }],
    ...overrides,
  };
}

describe('estimateYTickLabelWidth', () => {
  it('uses the longest category label for band scales', () => {
    const width = estimateYTickLabelWidth(specWith(), categoryData, theme);
    expect(width).toBe(estimateTextWidth('Home Furnishing', theme.axisTextSize));
  });

  it('uses formatted breaks for numeric scales', () => {
    const data = [{ x: 1, y: 10 }, { x: 2, y: 20 }, { x: 3, y: 30 }];
    const spec = specWith({ data, aes: { x: 'x', y: 'y' } });
    const width = estimateYTickLabelWidth(spec, data, theme);
    // Numeric labels like "10", "20", "30" — narrow
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThan(estimateTextWidth('10000', theme.axisTextSize));
  });

  it('returns 0 for empty data', () => {
    expect(estimateYTickLabelWidth(specWith({ data: [] }), [], theme)).toBe(0);
  });
});

describe('computeLayout dynamic left margin', () => {
  it('keeps the theme default for short numeric y labels', () => {
    const data = [{ x: 1, y: 1 }, { x: 2, y: 5 }];
    const layout = computeLayout(specWith({ data, aes: { x: 'x', y: 'y' } }), theme, 0);
    expect(layout.margin.left).toBe(theme.margin.left);
  });

  it('grows the left margin to fit wide category labels', () => {
    const layout = computeLayout(specWith(), theme, 0);
    const labelWidth = estimateTextWidth('Home Furnishing', theme.axisTextSize);
    expect(layout.margin.left).toBeGreaterThan(theme.margin.left);
    // Margin must fully contain the label plus tick + title strip
    expect(layout.margin.left).toBeGreaterThanOrEqual(labelWidth + theme.tickLength);
  });

  it('caps the left margin at 40% of chart width', () => {
    const longData = [{ x: 1, cat: 'An unreasonably long category label that goes on and on forever' }];
    const layout = computeLayout(specWith({ data: longData, aes: { x: 'x', y: 'cat' }, width: 600 }), theme, 0);
    expect(layout.margin.left).toBe(Math.floor(600 * 0.4));
  });

  it('respects an explicit external margin verbatim', () => {
    const external = { top: 1, right: 2, bottom: 3, left: 4 };
    const layout = computeLayout(specWith(), theme, 0, external);
    expect(layout.margin.left).toBe(4);
  });
});

describe('rendered y-axis labels fit inside the SVG', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('places the panel far enough right that category labels are not clipped', () => {
    const built = buildPlot(specWith());
    const labelWidth = estimateTextWidth('Home Furnishing', theme.axisTextSize);
    // Space left of the panel available for tick labels (title strip excluded)
    const available = built.layout.margin.left - theme.halfLine * 2
      - theme.axisTitleSize - theme.axisTitleMargin;
    expect(available).toBeGreaterThanOrEqual(labelWidth);
  });

  it('renders y-axis tick labels for every category', () => {
    const { svg } = renderWithState(container, specWith());
    const texts = Array.from(svg.querySelectorAll('.ggpbi-axis-y text')).map(t => t.textContent);
    for (const d of categoryData) {
      expect(texts).toContain(d.sector);
    }
  });

  it('positions the y-axis title at the left edge of the grown margin', () => {
    const spec = specWith({ yLabel: 'SectorNameEnglish' });
    const { svg } = renderWithState(container, spec);
    const title = svg.querySelector('.ggpbi-axis-label-y');
    expect(title).not.toBeNull();
    const built = buildPlot(spec);
    const y = parseFloat(title!.getAttribute('y')!);
    expect(y).toBeCloseTo(-built.layout.margin.left + theme.axisTitleSize + theme.axisTitleMargin, 5);
  });
});
