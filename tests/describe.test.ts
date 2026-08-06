/**
 * Auto description: the chart states its own transformation, so an
 * automatic stat or geom choice is never invisible.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { describePlot, hasHiddenTransform, fieldLabelsFor } from '../src/describe';
import { buildPlot } from '../src/pipeline';
import { ggpbi } from '../src/index';

describe('describePlot (pure)', () => {
  it('names the computed value and the grouping axis', () => {
    expect(describePlot(
      [{ geom: 'bar', stat: 'sum' }],
      { x: 'dose', y: 'len' },
    )).toBe('Sum of len by dose');
  });

  it('mentions colour, size and facet mappings', () => {
    expect(describePlot(
      [{ geom: 'point', stat: 'identity' }],
      { x: 'wt', y: 'mpg', color: 'cyl', size: 'hp', facetCol: 'gear' },
    )).toBe('mpg by wt, coloured by cyl, sized by hp, split by gear');
  });

  it('stats that consume x do not add a redundant "by x"', () => {
    expect(describePlot([{ geom: 'histogram', stat: 'bin' }], { x: 'psavert' }))
      .toBe('Histogram of psavert');
    expect(describePlot([{ geom: 'density', stat: 'density' }], { x: 'len', color: 'supp' }))
      .toBe('Density of len, coloured by supp');
  });

  it('counts are described without a value field', () => {
    expect(describePlot([{ geom: 'bar', stat: 'count' }], { x: 'cyl' }))
      .toBe('Count of rows by cyl');
  });

  it('secondary layers are appended, duplicates collapsed', () => {
    expect(describePlot(
      [
        { geom: 'point', stat: 'identity' },
        { geom: 'smooth', stat: 'smooth' },
        { geom: 'smooth', stat: 'smooth' },
      ],
      { x: 'wt', y: 'mpg' },
    )).toBe('mpg by wt · with trend line');
  });

  it('returns null without layers or without positional aesthetics', () => {
    expect(describePlot([], { x: 'a', y: 'b' })).toBeNull();
    expect(describePlot([{ geom: 'point', stat: 'identity' }], {})).toBeNull();
  });
});

describe('hasHiddenTransform', () => {
  it('is true for computed stats and auto-picked geoms', () => {
    expect(hasHiddenTransform([{ geom: 'bar', stat: 'sum' }])).toBe(true);
    expect(hasHiddenTransform([{ geom: 'bar', stat: 'count' }])).toBe(true);
    expect(hasHiddenTransform([{ geom: 'histogram', stat: 'bin' }])).toBe(true);
    expect(hasHiddenTransform([{ geom: 'point', stat: 'identity', autoGeom: true }])).toBe(true);
  });

  it('is false when the user chose everything and nothing is aggregated', () => {
    expect(hasHiddenTransform([{ geom: 'boxplot', stat: 'boxplot' }])).toBe(false);
    expect(hasHiddenTransform([{ geom: 'point', stat: 'identity' }])).toBe(false);
  });
});

describe('fieldLabelsFor', () => {
  it('hides synthetic internal fields', () => {
    const labels = fieldLabelsFor({ aes: { x: '__all', y: 'len' }, layers: [] } as any);
    expect(labels.x).toBeUndefined();
    expect(labels.y).toBe('len');
  });

  it('explicit display names win (Power BI well names)', () => {
    const labels = fieldLabelsFor(
      { aes: { x: 'dose', y: 'yRaw1' }, layers: [] } as any,
      { y: 'len' },
    );
    expect(labels).toMatchObject({ x: 'dose', y: 'len' });
  });
});

describe('subtitle resolution in buildPlot', () => {
  const rows = [0.5, 1].flatMap(dose =>
    [10, 12].flatMap(b => [{ dose, supp: 'OJ', len: b }, { dose, supp: 'VC', len: b + 1 }]));

  const build = (extra: Record<string, unknown>) => buildPlot({
    data: rows,
    aes: { x: 'dose', y: 'len', color: 'supp' },
    layers: [{ geom: { type: 'bar' } }],
    scales: { x: 'category' },
    width: 500,
    height: 350,
    ...extra,
  } as any);

  it('off by default', () => {
    expect(build({}).subtitleText).toBeUndefined();
  });

  it("'auto' describes an automatic aggregation", () => {
    expect(build({ subtitle: 'auto' }).subtitleText)
      .toBe('Sum of len by dose, coloured by supp');
  });

  it("'auto' stays quiet when nothing is computed", () => {
    const built = buildPlot({
      data: rows,
      aes: { x: 'len', y: 'dose' },
      layers: [{ geom: { type: 'point' } }],
      subtitle: 'auto',
      width: 500,
      height: 350,
    } as any);
    expect(built.subtitleText).toBeUndefined();
  });

  it("'always' describes even a plain plot", () => {
    const built = buildPlot({
      data: rows,
      aes: { x: 'len', y: 'dose' },
      layers: [{ geom: { type: 'point' } }],
      subtitle: 'always',
      width: 500,
      height: 350,
    } as any);
    expect(built.subtitleText).toBe('dose by len');
  });

  it('an explicit string passes through unchanged', () => {
    expect(build({ subtitle: 'Quarterly report' }).subtitleText).toBe('Quarterly report');
  });

  it('reserves layout space only when a subtitle exists', () => {
    const without = build({}).layout.margin.top;
    const withSub = build({ subtitle: 'always' }).layout.margin.top;
    expect(withSub).toBeGreaterThan(without);
  });
});

describe('subtitle rendering', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders above the panel and never overlaps it', () => {
    const svg = ggpbi()
      .data([{ g: 'a', v: 1 }, { g: 'a', v: 2 }, { g: 'b', v: 3 }] as any)
      .aes({ x: 'g', y: 'v' })
      .geom('bar')
      .scale({ x: 'category' })
      .subtitle('auto')
      .size(500, 350)
      .renderTo(container);

    const text = svg.querySelector('.ggpbi-subtitle');
    expect(text?.textContent).toBe('Sum of v by g');
    // Placed above the panel origin (negative y in panel coordinates).
    expect(parseFloat(text!.getAttribute('y')!)).toBeLessThan(0);
  });

  it('no subtitle element when the option is off', () => {
    const svg = ggpbi()
      .data([{ g: 'a', v: 1 }] as any)
      .aes({ x: 'g', y: 'v' })
      .geom('bar')
      .size(500, 350)
      .renderTo(container);
    expect(svg.querySelector('.ggpbi-subtitle')).toBeNull();
  });
});
