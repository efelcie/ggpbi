import { describe, it, expect, beforeEach } from 'vitest';
import { renderLegend, estimateLegendWidth, type LegendEntry } from '../src/legend';
import { resolveTheme } from '../src/theme';
import { ggpbi } from '../src/index';
import * as d3 from 'd3';
import type { GeomConfig } from '../src/types';

// --- Test data ---

const colorData = [
  { x: 1, y: 10, grp: 'A' },
  { x: 2, y: 20, grp: 'A' },
  { x: 3, y: 15, grp: 'B' },
  { x: 4, y: 25, grp: 'B' },
  { x: 5, y: 30, grp: 'C' },
];

const entries: LegendEntry[] = [
  { label: 'Group A', color: '#e41a1c' },
  { label: 'Group B', color: '#377eb8' },
  { label: 'Group C', color: '#4daf4a' },
];

// ---------------------------------------------------------------------------
// estimateLegendWidth
// ---------------------------------------------------------------------------

describe('estimateLegendWidth', () => {
  const theme = resolveTheme({});

  it('returns positive width for entries', () => {
    const width = estimateLegendWidth(entries, 'grp', theme);
    expect(width).toBeGreaterThan(0);
  });

  it('width scales with label length', () => {
    const shortEntries: LegendEntry[] = [{ label: 'A', color: '#000' }];
    const longEntries: LegendEntry[] = [{ label: 'Very Long Label Here', color: '#000' }];
    const shortWidth = estimateLegendWidth(shortEntries, 'x', theme);
    const longWidth = estimateLegendWidth(longEntries, 'x', theme);
    expect(longWidth).toBeGreaterThan(shortWidth);
  });

  it('considers title length', () => {
    const widthShortTitle = estimateLegendWidth(
      [{ label: 'A', color: '#000' }],
      'x',
      theme
    );
    const widthLongTitle = estimateLegendWidth(
      [{ label: 'A', color: '#000' }],
      'A Very Long Title Indeed',
      theme
    );
    expect(widthLongTitle).toBeGreaterThan(widthShortTitle);
  });

  it('returns integer value', () => {
    const width = estimateLegendWidth(entries, 'grp', theme);
    expect(Number.isInteger(width)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// renderLegend — SVG output
// ---------------------------------------------------------------------------

describe('renderLegend', () => {
  let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  let g: d3.Selection<SVGGElement, unknown, null, undefined>;
  const theme = resolveTheme({});
  const innerWidth = 400;

  beforeEach(() => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    svg = d3.select(container).append('svg').attr('width', 600).attr('height', 400);
    g = svg.append('g');
  });

  it('renders a legend group with class ggpbi-legend', () => {
    renderLegend(g, entries, 'grp', [{ type: 'point' }], theme, innerWidth);
    const legendG = g.select('.ggpbi-legend');
    expect(legendG.empty()).toBe(false);
  });

  it('positions legend to the right of the chart area', () => {
    renderLegend(g, entries, 'grp', [{ type: 'point' }], theme, innerWidth);
    const legendG = g.select('.ggpbi-legend');
    const transform = legendG.attr('transform');
    // Should translate to the right of innerWidth
    const match = transform.match(/translate\((\d+\.?\d*)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThan(innerWidth);
  });

  it('renders title text', () => {
    renderLegend(g, entries, 'color_field', [{ type: 'point' }], theme, innerWidth);
    const texts = g.selectAll('.ggpbi-legend text').nodes();
    const titleText = d3.select(texts[0]).text();
    expect(titleText).toBe('color_field');
  });

  it('renders one label per entry', () => {
    renderLegend(g, entries, 'grp', [{ type: 'point' }], theme, innerWidth);
    const texts = g.selectAll('.ggpbi-legend text').nodes();
    // 1 title + 3 entry labels
    expect(texts.length).toBe(4);
    expect(d3.select(texts[1]).text()).toBe('Group A');
    expect(d3.select(texts[2]).text()).toBe('Group B');
    expect(d3.select(texts[3]).text()).toBe('Group C');
  });

  it('renders circles for point geom', () => {
    renderLegend(g, entries, 'grp', [{ type: 'point' }], theme, innerWidth);
    const circles = g.selectAll('.ggpbi-legend circle').nodes();
    expect(circles.length).toBe(3);
    expect(d3.select(circles[0]).attr('fill')).toBe('#e41a1c');
    expect(d3.select(circles[1]).attr('fill')).toBe('#377eb8');
  });

  it('renders lines for line geom', () => {
    renderLegend(g, entries, 'grp', [{ type: 'line' }], theme, innerWidth);
    const lines = g.selectAll('.ggpbi-legend line').nodes();
    expect(lines.length).toBe(3);
    expect(d3.select(lines[0]).attr('stroke')).toBe('#e41a1c');
  });

  it('renders rectangles for bar geom', () => {
    renderLegend(g, entries, 'grp', [{ type: 'bar' }], theme, innerWidth);
    const rects = g.selectAll('.ggpbi-legend rect').nodes();
    expect(rects.length).toBe(3);
    expect(d3.select(rects[0]).attr('fill')).toBe('#e41a1c');
  });

  it('renders rectangles for area geom', () => {
    renderLegend(g, entries, 'grp', [{ type: 'area' }], theme, innerWidth);
    const rects = g.selectAll('.ggpbi-legend rect').nodes();
    expect(rects.length).toBe(3);
  });

  it('uses first geom type for legend key shape', () => {
    // Mixed geoms: first is line, so legend should use lines
    const geoms: GeomConfig[] = [{ type: 'line' }, { type: 'point' }];
    renderLegend(g, entries, 'grp', geoms, theme, innerWidth);
    const lines = g.selectAll('.ggpbi-legend line').nodes();
    const circles = g.selectAll('.ggpbi-legend circle').nodes();
    expect(lines.length).toBe(3);
    expect(circles.length).toBe(0);
  });

  it('handles empty entries gracefully', () => {
    renderLegend(g, [], 'grp', [{ type: 'point' }], theme, innerWidth);
    const legendG = g.select('.ggpbi-legend');
    expect(legendG.empty()).toBe(false);
    // Only title text, no entries
    const texts = g.selectAll('.ggpbi-legend text').nodes();
    expect(texts.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Legend integration — rendered chart with color aesthetic
// ---------------------------------------------------------------------------

describe('Legend integration', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders legend when color aesthetic is mapped', () => {
    ggpbi()
      .data(colorData)
      .aes({ x: 'x', y: 'y', color: 'grp' })
      .geom('point')
      .renderTo(container);

    const legend = container.querySelector('.ggpbi-legend');
    expect(legend).not.toBeNull();
  });

  it('does not render legend when no color aesthetic', () => {
    ggpbi()
      .data(colorData)
      .aes({ x: 'x', y: 'y' })
      .geom('point')
      .renderTo(container);

    const legend = container.querySelector('.ggpbi-legend');
    expect(legend).toBeNull();
  });

  it('does not render legend when showLegend=false', () => {
    ggpbi()
      .data(colorData)
      .aes({ x: 'x', y: 'y', color: 'grp' })
      .geom('point')
      .legend(false)
      .renderTo(container);

    const legend = container.querySelector('.ggpbi-legend');
    expect(legend).toBeNull();
  });

  it('legend entries match unique color values', () => {
    ggpbi()
      .data(colorData)
      .aes({ x: 'x', y: 'y', color: 'grp' })
      .geom('point')
      .renderTo(container);

    const legendTexts = container.querySelectorAll('.ggpbi-legend text');
    // 1 title + 3 unique groups (A, B, C)
    expect(legendTexts.length).toBe(4);
    const labels = Array.from(legendTexts).slice(1).map(t => t.textContent);
    expect(labels).toContain('A');
    expect(labels).toContain('B');
    expect(labels).toContain('C');
  });

  it('legend uses circles for point geom in integrated chart', () => {
    ggpbi()
      .data(colorData)
      .aes({ x: 'x', y: 'y', color: 'grp' })
      .geom('point')
      .renderTo(container);

    const circles = container.querySelectorAll('.ggpbi-legend circle');
    expect(circles.length).toBe(3); // A, B, C
  });

  it('legend uses lines for line geom in integrated chart', () => {
    ggpbi()
      .data(colorData)
      .aes({ x: 'x', y: 'y', color: 'grp' })
      .geom('line')
      .renderTo(container);

    const lines = container.querySelectorAll('.ggpbi-legend line');
    expect(lines.length).toBe(3);
  });
});
