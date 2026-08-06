import { describe, it, expect, beforeEach } from 'vitest';
import { formatBreaksAs } from '../src/breaks';
import { estimateYTickLabelWidth, estimateTextWidth } from '../src/pipeline';
import { resolveTheme } from '../src/theme';
import { renderWithState } from '../src/render';
import type { PlotSpec } from '../src/types';

const theme = resolveTheme();

describe('formatBreaksAs', () => {
  it('defaults to plain number formatting', () => {
    expect(formatBreaksAs([0, 0.1, 0.2])).toEqual(['0.0', '0.1', '0.2']);
    expect(formatBreaksAs([0, 10, 20], 'auto')).toEqual(['0', '10', '20']);
  });

  it('formats fractions as percent', () => {
    expect(formatBreaksAs([0, 0.1, 0.2, 0.3], 'percent')).toEqual(['0%', '10%', '20%', '30%']);
  });

  it('keeps decimals when breaks need them', () => {
    expect(formatBreaksAs([0, 0.025, 0.05], 'percent')).toEqual(['0.0%', '2.5%', '5.0%']);
  });

  it('supports a custom formatter function', () => {
    expect(formatBreaksAs([1, 2], v => `${v} EUR`)).toEqual(['1 EUR', '2 EUR']);
  });
});

describe('percent labels on axes', () => {
  const data = [
    { rate: 0.05, sector: 'Electronics' },
    { rate: 0.18, sector: 'Pharmacy' },
    { rate: 0.32, sector: 'Textile' },
    { rate: 0.44, sector: 'Shoes' },
  ];

  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders x-axis tick labels with % suffix', () => {
    const spec: PlotSpec = {
      data,
      aes: { x: 'rate', y: 'sector' },
      layers: [{ geom: { type: 'point' } }],
      scales: { x: { labels: 'percent' } },
    };
    const { svg } = renderWithState(container, spec);
    const texts = Array.from(svg.querySelectorAll('.ggpbi-axis-x text')).map(t => t.textContent ?? '');
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.every(t => t.endsWith('%'))).toBe(true);
  });

  it('renders y-axis tick labels with % suffix', () => {
    const spec: PlotSpec = {
      data,
      aes: { x: 'sector', y: 'rate' },
      layers: [{ geom: { type: 'point' } }],
      scales: { y: { labels: 'percent' } },
    };
    const { svg } = renderWithState(container, spec);
    const texts = Array.from(svg.querySelectorAll('.ggpbi-axis-y text')).map(t => t.textContent ?? '');
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.every(t => t.endsWith('%'))).toBe(true);
  });

  it('leaves category axes unaffected', () => {
    const spec: PlotSpec = {
      data,
      aes: { x: 'rate', y: 'sector' },
      layers: [{ geom: { type: 'point' } }],
      scales: { x: { labels: 'percent' } },
    };
    const { svg } = renderWithState(container, spec);
    const texts = Array.from(svg.querySelectorAll('.ggpbi-axis-y text')).map(t => t.textContent);
    expect(texts).toContain('Electronics');
  });

  it('margin estimation uses the formatted y labels', () => {
    const spec: PlotSpec = {
      data,
      aes: { x: 'sector', y: 'rate' },
      layers: [{ geom: { type: 'point' } }],
      scales: { y: { labels: 'percent' } },
    };
    const width = estimateYTickLabelWidth(spec, data, theme);
    // Percent labels ("40%") are wider than the raw fractions ("0.4")... at
    // minimum the estimate must account for the % suffix on the widest label
    expect(width).toBeGreaterThanOrEqual(estimateTextWidth('10%', theme.axisTextSize));
  });
});
