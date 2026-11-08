/**
 * Options that let ggpbi reproduce a native Power BI chart exactly — the
 * Mobile report's LTM line with area, the line over flat month columns,
 * the occupancy line — each with its ggplot2 counterpart:
 *
 * - scale position = "right", axis label colour, fixed display units
 *   ("1,500M", "0M"), date_breaks = "6 months"
 * - theme switches for grid directions, minor grid and tick marks, and the
 *   report font (base_family)
 * - facets without strips and with axes per row ("xy,none"): the month
 *   labels between a line panel and a flat column panel without scale
 * - geom_area with an outline (alpha thins only the fill)
 * - a blank axis title takes no room (labs(x = NULL))
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ggpbi } from '../src/index';
import { formatInUnit } from '../src/format';
import { formatBreaksAs } from '../src/breaks';
import { parseDateBreaks, formatLikeAxis } from '../src/panel';
import { linetypeToDasharray } from '../src/geoms/util';
import { parseRowAxes, parseRowAxesText } from '../src/facet-layout';
import { specToR } from '../src/r-codegen';
import { parseR } from '../src/r-parse';
import { parseCode, applyCodeEdit } from '../src/code-parse';
import { computePaneWriteback } from '../src/pane-writeback';
import { DEFAULT_FONT_FAMILY } from '../src/theme';
import { renderVisual } from './helpers/pbi-host';
import type { PlotSpec } from '../src/types';

const EN = { locale: 'en-US' };
const months = Array.from({ length: 33 }, (_, i) => new Date(2024, i + 1, 0));

describe('fixed display units', () => {
  it('reads like Power BI display units in millions', () => {
    expect(formatInUnit([0, 5e8, 1e9, 1.5e9], 'millions', EN, true))
      .toEqual(['0M', '500M', '1,000M', '1,500M']);
  });

  it('takes its decimals from the scaled breaks', () => {
    expect(formatInUnit([5.5e6, 6e6, 6.5e6, 7e6, 7.5e6], 'millions', EN))
      .toEqual(['5.5M', '6.0M', '6.5M', '7.0M', '7.5M']);
  });

  it('follows the locale', () => {
    const de = formatInUnit([0, 1.5e9], 'millions', { locale: 'de-DE' }, true)
      .map(s => s.replace(/ /g, ' '));
    expect(de).toEqual(['0 Mio.', '1.500 Mio.']);
    // German has no short thousands: the K fallback keeps the unit visible.
    expect(formatInUnit([0, 500, 1000].map(v => v * 1000), 'thousands', { locale: 'de-DE' }))
      .toEqual(['0K', '500K', '1000K']);
  });

  it('applies to auto and thousands, not to compact or percent', () => {
    expect(formatBreaksAs([0, 1e6], 'thousands', { ...EN, unit: 'thousands' })).toEqual(['0K', '1,000K']);
    expect(formatBreaksAs([0, 1e6], 'auto', { ...EN, unit: 'thousands' })).toEqual(['0K', '1000K']);
    expect(formatBreaksAs([0, 0.5], 'percent', { ...EN, unit: 'millions' })).toEqual(['0%', '50%']);
  });
});

describe('small parsers', () => {
  it('date breaks follow ggplot2 spelling', () => {
    const six = parseDateBreaks('6 months')!;
    const ticks = six.range(new Date(2024, 0, 1), new Date(2025, 0, 2));
    expect(ticks.map(d => d.getMonth())).toEqual([0, 6, 0]);
    expect(parseDateBreaks('1 year')).toBeDefined();
    expect(parseDateBreaks('2 weeks')).toBeDefined();
    expect(parseDateBreaks('quarter')).toBeDefined();
    expect(parseDateBreaks('soon')).toBeUndefined();
  });

  it('row axes read x, y, xy and none', () => {
    expect(parseRowAxes('xy')).toEqual({ x: true, y: true });
    expect(parseRowAxes('none')).toEqual({ x: false, y: false });
    expect(parseRowAxes('y')).toEqual({ x: false, y: true });
    expect(parseRowAxes('z')).toBeUndefined();
    expect(parseRowAxesText('xy,none')).toEqual(['xy', 'none']);
    expect(parseRowAxesText('xy, maybe')).toBeUndefined();
  });

  it('dash patterns grow with wide lines', () => {
    expect(linetypeToDasharray('dashed')).toBe('6 4');
    expect(linetypeToDasharray('dashed', 2)).toBe('6 4');
    expect(linetypeToDasharray('dashed', 4)).toBe('12 8');
  });
});

describe('the Mobile charts', () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const mobileTheme = {
    baseSize: 14, panelFill: '#FFFFFF', gridColor: '#E1DFDD',
    gridX: false, gridMinor: false, ticks: false,
  };

  const ltmArea = () => ggpbi()
    .data(months.map((m, i) => ({ month: m, y1: 1.5e9 + i * 9e6, y2: 1.76e9 })))
    .aes({ x: 'month', y: 'y1' })
    .layer({ geom: { type: 'area', color: '#416B84', alpha: 0.15, size: 2.7 }, aes: { y: 'y1' } } as any)
    .layer({ geom: { type: 'line', color: '#8A8886', size: 1.33, linetype: 'dashed' }, aes: { y: 'y2' } } as any)
    .scale({
      x: { dateLabels: 'monthYear', dateBreaks: '6 months', labelColor: '#8A8886' },
      y: { position: 'right', labels: 'thousands', labelUnit: 'millions', labelColor: '#8A8886' },
    } as any)
    .theme(mobileTheme as any)
    .labels(' ', ' ')
    .format(EN)
    .size(440, 200)
    .renderTo(container);

  it('LTM with area: right axis from 0 in fixed millions, y grid only', () => {
    const svg = ltmArea();
    const yAxis = svg.querySelector('.ggpbi-axis-y')!;
    expect(yAxis.getAttribute('transform')).toMatch(/^translate\([\d.]+,0\)$/);
    const yLabels = Array.from(yAxis.querySelectorAll('text')).map(t => t.textContent);
    expect(yLabels[0]).toBe('0M');
    expect(yLabels).toContain('1,500M');
    expect((yAxis.querySelector('text') as SVGTextElement).style.fill).toMatch(/#8A8886|rgb\(138, 136, 134\)/i);

    const xLabels = Array.from(svg.querySelectorAll('.ggpbi-axis-x text')).map(t => t.textContent);
    expect(xLabels.slice(0, 3)).toEqual(['Jan 2024', 'Jul 2024', 'Jan 2025']);

    // Horizontal grid only, no minor grid, no tick marks.
    const grid = Array.from(svg.querySelectorAll('.ggpbi-grid'));
    expect(grid.length).toBeGreaterThan(0);
    expect(grid.every(l => l.getAttribute('y1') === l.getAttribute('y2'))).toBe(true);
    expect(svg.querySelectorAll('.ggpbi-grid-minor').length).toBe(0);
    expect(svg.querySelector('.ggpbi-axis-y .tick line')?.getAttribute('x2')).toBe('0');

    // Area with its outline in one layer; the reference line dashed.
    expect(svg.querySelector('.ggpbi-area')?.getAttribute('opacity')).toBe('0.15');
    const outline = svg.querySelector('.ggpbi-area-outline')!;
    expect(outline.getAttribute('stroke')).toBe('#416B84');
    expect(outline.getAttribute('stroke-width')).toBe('2.7');
    expect(svg.querySelector('.ggpbi-layer-line path')?.getAttribute('stroke-dasharray')).toBe('6 4');

    // No titles, and no room for them: the panel starts at the plot margin.
    expect(svg.querySelector('.ggpbi-axis-label-x')).toBeNull();
    expect(svg.querySelector('.ggpbi-axis-label-y')).toBeNull();
    const g = svg.querySelector(':scope > g')!;
    expect(g.getAttribute('transform')).toBe('translate(14,14)');
  });

  it('the report font reaches every text', () => {
    const svg = ltmArea();
    expect(svg.style.fontFamily).toContain('Segoe UI');
    expect(svg.querySelector('.ggpbi-axis-x')?.getAttribute('font-family')).toBe(DEFAULT_FONT_FAMILY);
  });

  it('two-part: months between the panels, no strips, no scale on the columns', () => {
    const rows: Array<Record<string, unknown>> = [];
    months.forEach((m, i) => {
      rows.push({ month: m, Panel: 'LTM', y1: 5.4e6 + i * 6e4, y2: null, y3: 6.8e6 });
      rows.push({ month: m, Panel: 'Per month', y1: null, y2: 5.6e5 + (i % 7) * 1e4, y3: null });
    });
    const svg = ggpbi()
      .data(rows)
      .aes({ x: 'month', y: 'y1' })
      .layer({ geom: { type: 'line', color: '#416B84', size: 2.7 }, aes: { y: 'y1' } } as any)
      .layer({ geom: { type: 'bar', color: '#C8C6C4' }, aes: { y: 'y2' } } as any)
      .layer({ geom: { type: 'line', color: '#8A8886', linetype: 'dashed' }, aes: { y: 'y3' } } as any)
      .facet({ wrap: 'Panel', ncol: 1, freeY: true, heights: [120, 19], strips: false, rowAxes: ['xy', 'none'] } as any)
      .scale({
        x: { dateLabels: 'monthYear', dateBreaks: '6 months' },
        y: { position: 'right', labels: 'compact', labelColor: '#416B84' },
      } as any)
      .theme({ ...mobileTheme, gridY: false } as any)
      .labels(' ', ' ')
      .format(EN)
      .size(440, 230)
      .renderTo(container);

    expect(svg.querySelectorAll('[class^="ggpbi-facet-strip"]').length).toBe(0);
    const [line, bars] = Array.from(svg.querySelectorAll('.ggpbi-facet'));
    expect(line.querySelectorAll('.ggpbi-axis-x').length).toBe(1);
    expect(line.querySelectorAll('.ggpbi-axis-y').length).toBe(1);
    expect(bars.querySelectorAll('.ggpbi-axis-x, .ggpbi-axis-y').length).toBe(0);
    expect(bars.querySelectorAll('.ggpbi-bar').length).toBe(33);
    expect(svg.querySelectorAll('.ggpbi-grid').length).toBe(0);

    // Same x positions in both panels: same left edge and width.
    const [lp, bp] = Array.from(svg.querySelectorAll('.ggpbi-facet .ggpbi-panel'));
    expect(lp.getAttribute('width')).toBe(bp.getAttribute('width'));
    const tx = (el: Element) => el.getAttribute('transform')!.match(/translate\(([\d.]+)/)![1];
    expect(tx(line)).toBe(tx(bars));
    // Panel heights 120 : 19.
    const h = (el: Element) => parseFloat(el.getAttribute('height')!);
    expect(h(lp) / h(bp)).toBeCloseTo(120 / 19, 3);
    // The month labels sit between the panels; nothing is reserved below
    // the columns.
    const outer = svg.querySelector(':scope > g')!;
    const top = parseFloat(outer.getAttribute('transform')!.match(/,([\d.]+)\)/)![1]);
    const barsY = parseFloat(bars.getAttribute('transform')!.match(/,([\d.]+)\)/)![1]);
    expect(top + barsY + h(bp)).toBeCloseTo(230 - 14, 0);
    // Right-axis labels in the line colour.
    expect((line.querySelector('.ggpbi-axis-y text') as SVGTextElement).style.fill)
      .toMatch(/#416B84|rgb\(65, 107, 132\)/i);
  });
});

describe('dialects and the Format Pane', () => {
  const spec: PlotSpec = {
    data: [{ month: new Date(2024, 0, 31), y: 1, Panel: 'a' }],
    aes: { x: 'month', y: 'y' },
    layers: [{ geom: { type: 'line' } }],
    scales: {
      x: { dateBreaks: '6 months' },
      y: { position: 'right', labelUnit: 'millions', labelColor: '#416B84' },
    },
    theme: { gridX: false, gridMinor: false, ticks: false, fontFamily: 'Segoe UI' },
    facet: { wrap: 'Panel', ncol: 1, strips: false, rowAxes: ['xy', 'none'] },
  } as PlotSpec;

  it('the R code view round-trips every new option', () => {
    const code = specToR(spec, {});
    expect(code).toContain('date_breaks = "6 months"');
    expect(code).toContain('position = "right"');
    expect(code).toContain('label_unit = "millions"');
    expect(code).toContain('label_colour = "#416B84"');
    expect(code).toContain('strip = FALSE');
    expect(code).toContain('row_axes = c("xy", "none")');
    const parsed = parseR(code);
    expect(parsed.ok, parsed.ok === false ? parsed.error : '').toBe(true);
    if (parsed.ok !== true) return;
    expect(parsed.patch.scales).toEqual(spec.scales);
    expect(parsed.patch.facet).toEqual(spec.facet && { ...spec.facet });
    expect(parsed.patch.theme).toEqual(spec.theme);
  });

  it('editor edits write back to the pane', () => {
    const code = [
      'ggpbi()',
      "  .aes({ x: 'month', y: 'y' })",
      "  .geom('line')",
      "  .scale({ x: { dateBreaks: '6 months' }, y: { position: 'right', labelUnit: 'millions', labelColor: '#416B84' } })",
      "  .facet({ wrap: 'Panel', strips: false, rowAxes: ['xy', 'none'] })",
      '  .theme({ gridX: false, gridMinor: false, ticks: false, fontFamily: \'Segoe UI\' })',
      '  .renderTo(element);',
    ].join('\n');
    const parsed = parseCode(code);
    expect(parsed.ok).toBe(true);
    if (parsed.ok !== true) return;
    const live: PlotSpec = { data: spec.data, aes: spec.aes, layers: spec.layers, facet: { wrap: 'Panel' } };
    const result = computePaneWriteback(parsed.patch, live, applyCodeEdit(live, parsed.patch), {});
    const props = (name: string) => result.instances.find(i => i.objectName === name)?.properties;
    expect(props('scaleX')).toEqual({ dateBreaks: '6 months' });
    expect(props('scaleY')).toEqual({
      position: 'right', labelUnit: 'millions', labelColor: { solid: { color: '#416B84' } },
    });
    expect(props('facet')).toEqual({ strips: false, rowAxes: 'xy,none' });
    expect(props('theme')).toEqual({ gridX: false, gridMinor: false, ticks: false, fontFamily: 'Segoe UI' });
    expect(result.residual).toBe(false);
  });
});

describe('in the Power BI visual', () => {
  it('reads the new Format Pane properties', () => {
    const month: Date[] = [];
    const panel: string[] = [];
    const y1: Array<number | null> = [];
    const y2: Array<number | null> = [];
    months.forEach((m, i) => {
      month.push(m, m);
      panel.push('LTM', 'Per month');
      y1.push(5.4e6 + i * 6e4, null);
      y2.push(null, 5.6e5);
    });
    const lit = (v: string) => ({ expr: { Literal: { Value: v } } });
    const { container } = renderVisual({
      categories: [
        { name: 'Month End', role: 'x', values: month },
        { name: 'Panel', role: 'facet', values: panel },
      ],
      measures: [{ name: 'LTM', values: y1 }, { name: 'Per month', values: y2 }],
      objects: {
        layer1: { enabled: true, type: 'line', yField: 'y1' },
        layer2: { enabled: true, type: 'bar', yField: 'y2' },
        scaleX: { label: ' ', dateFormat: 'monthYear', dateBreaks: '6 months', labelColor: { solid: { color: lit("'#8A8886'") } } },
        scaleY: { label: ' ', position: 'right', labelUnit: 'millions', labelColor: { solid: { color: '#416B84' } } },
        theme: { preset: 'minimal', gridX: false, gridY: false, gridMinor: false, ticks: false },
        facet: { columns: 1, freeY: true, heights: '120,19', strips: false, rowAxes: 'xy,none' },
      },
    });
    const svg = container.querySelector('svg');
    expect(svg, container.textContent ?? '').not.toBeNull();
    const [line, bars] = Array.from(svg!.querySelectorAll('.ggpbi-facet'));
    expect(svg!.querySelectorAll('[class^="ggpbi-facet-strip"]').length).toBe(0);
    expect(line.querySelectorAll('.ggpbi-axis-x').length).toBe(1);
    expect(bars.querySelectorAll('.ggpbi-axis-x, .ggpbi-axis-y').length).toBe(0);
    const yText = Array.from(line.querySelectorAll('.ggpbi-axis-y text'));
    expect(yText.every(t => /M$/.test(t.textContent ?? ''))).toBe(true);
    expect((yText[0] as SVGTextElement).style.fill).toMatch(/#416B84|rgb\(65, 107, 132\)/i);
    expect(line.querySelector('.ggpbi-axis-y')?.getAttribute('transform')).toMatch(/^translate\(/);
    const xText = Array.from(line.querySelectorAll('.ggpbi-axis-x text')).map(t => t.textContent);
    expect(xText).toContain('Jul 2024');
    expect(svg!.querySelectorAll('.ggpbi-grid, .ggpbi-grid-minor').length).toBe(0);
    expect(svg!.querySelector('.ggpbi-axis-label-x')).toBeNull();
  });
});

describe('direct labels and the reporting month', () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const rows = months.map((m, i) => ({ month: m, ltm: 5.4e6 + i * 6.6e4, prior: 6.8e6, pm: 5.6e5 + (i % 5) * 2e4 }));

  it('formats an end value at the axis precision', () => {
    const ticks = [5.5e6, 6e6, 6.5e6, 7e6, 7.5e6];
    expect(formatLikeAxis(7_531_234, ticks, 'compact', EN)).toBe('7.5M');
    expect(formatLikeAxis(1_828_000_000, [0, 5e8, 1e9, 1.5e9], 'thousands', { ...EN, unit: 'millions' })).toBe('1,800M');
  });

  it('a dot and the value at the end of the line, the reference named on its line', () => {
    const svg = ggpbi()
      .data(rows)
      .aes({ x: 'month', y: 'ltm' })
      .layer({ geom: { type: 'line', color: '#416B84', size: 2, endPoint: true, endLabel: true }, aes: { y: 'ltm' } } as any)
      .layer({ geom: { type: 'line', color: '#8A8886', linetype: 'dashed', endLabel: true, labelTemplate: 'Prior year' }, aes: { y: 'prior' } } as any)
      .scale({ y: { position: 'right', labels: 'compact' } } as any)
      .format(EN)
      .size(440, 220)
      .renderTo(container);

    const dot = svg.querySelector('.ggpbi-end-point')!;
    expect(dot.getAttribute('fill')).toBe('#416B84');
    const labels = Array.from(svg.querySelectorAll('.ggpbi-end-label'));
    expect(labels.map(l => l.textContent)).toEqual(['7.5M', 'Prior year']);
    expect(labels.map(l => l.getAttribute('fill'))).toEqual(['#416B84', '#8A8886']);
    // The dot sits on the last point, the label ends there.
    expect(labels[0].getAttribute('x')).toBe(dot.getAttribute('cx'));
    expect(labels[0].getAttribute('text-anchor')).toBe('end');
    // A rising line gets its label above the point.
    expect(parseFloat(labels[0].getAttribute('y')!)).toBeLessThan(parseFloat(dot.getAttribute('cy')!));
  });

  it('the last bar takes its own colour', () => {
    const svg = ggpbi()
      .data(rows)
      .aes({ x: 'month', y: 'pm' })
      .geom('bar', { color: '#C8C6C4', lastFill: '#416B84' } as any)
      .size(440, 120)
      .renderTo(container);
    const fills = Array.from(svg.querySelectorAll('.ggpbi-bar')).map(b => b.getAttribute('fill'));
    expect(fills).toHaveLength(33);
    expect(fills.filter(f => f === '#416B84')).toHaveLength(1);
    // It is the rightmost one: the reporting month.
    const bars = Array.from(svg.querySelectorAll('.ggpbi-bar'));
    const rightmost = bars.reduce((a, b) => (parseFloat(b.getAttribute('x')!) > parseFloat(a.getAttribute('x')!) ? b : a));
    expect(rightmost.getAttribute('fill')).toBe('#416B84');
  });

  it('the Power BI visual reads the three options', () => {
    const { container: c } = renderVisual({
      categories: [{ name: 'Month End', role: 'x', values: rows.map(r => r.month) }],
      measures: [{ name: 'LTM', values: rows.map(r => r.ltm) }, { name: 'Per month', values: rows.map(r => r.pm) }],
      objects: {
        layer1: { enabled: true, type: 'line', yField: 'y1', endPoint: true, endLabel: true },
        layer2: { enabled: true, type: 'bar', yField: 'y2', lastFill: { solid: { color: '#416B84' } } },
        scaleY: { labelFormat: 'compact' },
      },
    });
    const svg = c.querySelector('svg');
    expect(svg, c.textContent ?? '').not.toBeNull();
    expect(svg!.querySelectorAll('.ggpbi-end-point').length).toBe(1);
    expect(svg!.querySelector('.ggpbi-end-label')?.textContent).toMatch(/M$/);
    const fills = Array.from(svg!.querySelectorAll('.ggpbi-bar')).map(b => b.getAttribute('fill'));
    expect(fills.filter(f => f === '#416B84')).toHaveLength(1);
  });
});
