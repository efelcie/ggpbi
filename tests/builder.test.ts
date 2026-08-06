import { describe, it, expect, beforeEach } from 'vitest';
import { ggpbi } from '../src/index';

const sampleData = [
  { month: 'Jan', sales: 100 },
  { month: 'Feb', sales: 200 },
  { month: 'Mar', sales: 150 },
];

describe('ggpbi builder', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('builds and renders a basic bar chart', () => {
    const svg = ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .renderTo(container);

    expect(svg).toBeInstanceOf(SVGSVGElement);
    expect(container.querySelector('svg')).toBe(svg);
  });

  it('supports chaining multiple geoms', () => {
    const svg = ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('point')
      .geom('line')
      .renderTo(container);

    expect(svg.querySelector('.ggpbi-layer-point')).not.toBeNull();
    expect(svg.querySelector('.ggpbi-layer-line')).not.toBeNull();
  });

  it('auto-selects geom when none is set', () => {
    const svg = ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .renderTo(container);

    // Auto-geom: categorical x + numeric y → bar (stat_identity auto-detected)
    expect(svg).toBeInstanceOf(SVGSVGElement);
    expect(svg.querySelector('.ggpbi-layer-bar')).not.toBeNull();
  });

  it('renders y-only specs on a single pseudo band instead of throwing', () => {
    // "Always show something": a lone y mapping used to throw
    // "aes.x is not set" — now every row lands on one unlabelled band.
    const svg = ggpbi()
      .data(sampleData)
      .aes({ y: 'sales' } as any)
      .geom('bar')
      .renderTo(container);

    expect(svg.querySelectorAll('.ggpbi-geom-clip rect').length).toBeGreaterThan(0);
    expect(svg.innerHTML).not.toMatch(/NaN/);
  });

  it('throws when field name is wrong', () => {
    expect(() =>
      ggpbi()
        .data(sampleData)
        .aes({ x: 'month', y: 'Umsatz' })
        .geom('bar')
        .renderTo(container)
    ).toThrow(/field "Umsatz" not found in data/);
  });

  it('render() is an alias for renderTo()', () => {
    const svg = ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('point')
      .render(container);

    expect(svg).toBeInstanceOf(SVGSVGElement);
  });

  it('sets custom size', () => {
    const svg = ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .size(1200, 800)
      .renderTo(container);

    expect(svg.getAttribute('width')).toBe('1200');
    expect(svg.getAttribute('height')).toBe('800');
  });

  it('sets axis labels', () => {
    const svg = ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .labels('Monat', 'Umsatz')
      .renderTo(container);

    const xLabel = svg.querySelector('.ggpbi-axis-label-x');
    const yLabel = svg.querySelector('.ggpbi-axis-label-y');
    expect(xLabel?.textContent).toBe('Monat');
    expect(yLabel?.textContent).toBe('Umsatz');
  });

  it('handles empty data without crashing', () => {
    const svg = ggpbi()
      .data([])
      .aes({ x: 'x', y: 'y' })
      .geom('point')
      .renderTo(container);

    expect(svg).toBeInstanceOf(SVGSVGElement);
  });

  describe('expand (ggplot2 padding)', () => {
    const numData = [
      { x: 1, y: 10 },
      { x: 5, y: 50 },
    ];

    it('adds expand padding — first bar center is offset from Y-axis', () => {
      const svg = ggpbi()
        .data(numData)
        .aes({ x: 'x', y: 'y' })
        .geom('bar')
        .renderTo(container);

      // The center of the first bar should NOT be at pixel 0 (the Y-axis)
      const bar = svg.querySelector('.ggpbi-bar') as SVGRectElement;
      expect(bar).not.toBeNull();
      const barX = parseFloat(bar.getAttribute('x')!);
      const barW = parseFloat(bar.getAttribute('width')!);
      const barCenter = barX + barW / 2;
      // With expand, x=1 maps to a positive pixel offset (not at 0 / Y-axis)
      expect(barCenter).toBeGreaterThan(0);
    });

    it('adds expand padding — points have breathing room from axis', () => {
      const svg = ggpbi()
        .data(numData)
        .aes({ x: 'x', y: 'y' })
        .geom('point')
        .renderTo(container);

      const points = svg.querySelectorAll('.ggpbi-point');
      expect(points.length).toBe(2);
    });
  });

  describe('scale limits', () => {
    const numData = [
      { x: 1, y: 10 },
      { x: 5, y: 50 },
    ];

    it('accepts { min, max } config for x axis', () => {
      const svg = ggpbi()
        .data(numData)
        .aes({ x: 'x', y: 'y' })
        .scale({ x: { min: 0, max: 10 } })
        .geom('point')
        .renderTo(container);

      expect(svg).toBeInstanceOf(SVGSVGElement);
    });

    it('accepts { min } only — max from data + expand', () => {
      const svg = ggpbi()
        .data(numData)
        .aes({ x: 'x', y: 'y' })
        .scale({ x: { min: 0 } })
        .geom('point')
        .renderTo(container);

      expect(svg).toBeInstanceOf(SVGSVGElement);
    });

    it('accepts { type, min } combo', () => {
      const svg = ggpbi()
        .data(numData)
        .aes({ x: 'x', y: 'y' })
        .scale({ x: { type: 'linear', min: 0 }, y: { max: 100 } })
        .geom('point')
        .renderTo(container);

      expect(svg).toBeInstanceOf(SVGSVGElement);
    });

    it('backward compatible with plain string scale type', () => {
      const svg = ggpbi()
        .data(numData)
        .aes({ x: 'x', y: 'y' })
        .scale({ x: 'linear', y: 'linear' })
        .geom('point')
        .renderTo(container);

      expect(svg).toBeInstanceOf(SVGSVGElement);
    });

    it('mixes object and string config', () => {
      const svg = ggpbi()
        .data(numData)
        .aes({ x: 'x', y: 'y' })
        .scale({ x: { min: 0 }, y: 'linear' })
        .geom('bar')
        .renderTo(container);

      expect(svg).toBeInstanceOf(SVGSVGElement);
    });
  });
});
