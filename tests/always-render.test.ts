import { describe, it, expect, beforeEach } from 'vitest';
import { ggpbi, inferGeom } from '../src/index';
import type { AesMapping } from '../src/types';

/**
 * The "always show something" guarantee (Power BI field wells).
 *
 * Whatever combination of measures, dimensions and dates lands in the
 * x / y / color wells, the auto-geom (Grammar of Graphics scale-level
 * rules, like ggplot2's qplot) must pick a sensible geom and the render
 * must produce visible marks — never a blank panel, never an exception,
 * never NaN geometry. Explicit geoms always override the auto choice.
 */

// 24 deterministic rows: 4 categories × 2 colour groups × 3 repeats.
const cats = ['North', 'South', 'East', 'West'];
const data = Array.from({ length: 24 }, (_, i) => ({
  cat: cats[i % 4],
  cat2: i % 2 === 0 ? 'g1' : 'g2',
  num: 10 + (i * 7) % 23,
  num2: 50 + (i * 13) % 31,
  time: new Date(Date.UTC(2024, i % 12, 1 + (i % 3))),
}));

const X_OPTIONS: Array<{ label: string; field?: string }> = [
  { label: 'none' },
  { label: 'categorical', field: 'cat' },
  { label: 'numeric', field: 'num' },
  { label: 'time', field: 'time' },
];
const Y_OPTIONS: Array<{ label: string; field?: string }> = [
  { label: 'none' },
  { label: 'numeric', field: 'num2' },
  { label: 'categorical', field: 'cat' },
];
const COLOR_OPTIONS: Array<{ label: string; field?: string }> = [
  { label: 'none' },
  { label: 'categorical', field: 'cat2' },
];

/** Count visible geometry marks inside the panel clip group. */
function countMarks(svg: SVGSVGElement): number {
  const clip = svg.querySelectorAll('.ggpbi-geom-clip rect, .ggpbi-geom-clip circle, .ggpbi-geom-clip path, .ggpbi-geom-clip line, .ggpbi-geom-clip g > *');
  return clip.length;
}

describe('always render: auto-geom matrix over field-well combinations', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  for (const x of X_OPTIONS) {
    for (const y of Y_OPTIONS) {
      // No positional aesthetic at all → Power BI shows the landing page
      // instead of rendering; not a chart case.
      if (!x.field && !y.field) continue;
      // y mapped to the same field as x is not a distinct well combination.
      if (x.field && y.field && x.field === y.field) continue;

      for (const color of COLOR_OPTIONS) {
        const label = `x=${x.label}, y=${y.label}, color=${color.label}`;

        it(`renders visible marks for ${label}`, () => {
          const aes: AesMapping = {};
          if (x.field) aes.x = x.field;
          if (y.field) aes.y = y.field;
          if (color.field) aes.color = color.field;

          const geom = inferGeom(data, aes);

          const svg = ggpbi()
            .data(data as any)
            .aes(aes)
            .geom(geom.type as any, geom as any)
            .size(500, 350)
            .renderTo(container);

          expect(countMarks(svg), `no visible marks for ${label} (auto geom: ${geom.type})`).toBeGreaterThan(0);
          expect(svg.innerHTML, `NaN geometry for ${label} (auto geom: ${geom.type})`).not.toMatch(/NaN/);
        });
      }
    }
  }
});

describe('always render: solo measure in X (horizontal value bar)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('one aggregated value against the pseudo y group renders a visible mark', () => {
    // The shape pbi-visual builds for "a measure in X, nothing else":
    // one row, x = the value, __all = synthesized single y group.
    // One row per category → horizontal value bar (geom_col semantics).
    const rows = [{ x: 995.68, __all: 'All' }];
    const auto = inferGeom(rows as any, { x: 'x', y: '__all' });
    expect(auto).toEqual({ type: 'bar', orientation: 'y' });

    const svg = ggpbi()
      .data(rows as any)
      .aes({ x: 'x', y: '__all' })
      .geom(auto.type as any, auto as any)
      .size(400, 300)
      .renderTo(container);

    const bars = Array.from(svg.querySelectorAll('.ggpbi-bar'));
    expect(bars.length).toBe(1);
    // Horizontal: the bar spans width, not height.
    const bar = bars[0] as SVGRectElement;
    expect(parseFloat(bar.getAttribute('width')!)).toBeGreaterThan(
      parseFloat(bar.getAttribute('height')!),
    );
    // The x axis must be numeric (the value axis), not the pseudo band.
    const xTicks = Array.from(svg.querySelectorAll('.ggpbi-axis-x text')).map(t => t.textContent);
    expect(xTicks.length).toBeGreaterThan(0);
    expect(xTicks.every(t => Number.isFinite(parseFloat(String(t))))).toBe(true);
  });

  it('value in X + grouping in Y: auto gives horizontal bars, bar flips itself', () => {
    // "Reported Sales by ShopName": one value per shop.
    const rows = [
      { sales: 120, shop: 'SPAR' },
      { sales: 90, shop: 'dm' },
      { sales: 45, shop: 'Mercator' },
    ];
    expect(inferGeom(rows as any, { x: 'sales', y: 'shop' }))
      .toEqual({ type: 'bar', orientation: 'y' });

    // Explicit bar WITHOUT orientation must infer horizontal (geom_col).
    const svg = ggpbi()
      .data(rows as any)
      .aes({ x: 'sales', y: 'shop' })
      .geom('bar')
      .size(400, 300)
      .renderTo(container);
    const widths = Array.from(svg.querySelectorAll('.ggpbi-bar'))
      .map(b => parseFloat(b.getAttribute('width')!));
    expect(widths.length).toBe(3);
    // Bar lengths differ (value-driven), so this is not a band-thickness axis.
    expect(new Set(widths.map(w => Math.round(w))).size).toBe(3);
  });

  it('multiple rows per category still auto-pick the strip plot', () => {
    const rows = [
      { v: 1, g: 'a' }, { v: 2, g: 'a' }, { v: 3, g: 'b' },
    ];
    expect(inferGeom(rows as any, { x: 'v', y: 'g' }).type).toBe('point');
  });
});
