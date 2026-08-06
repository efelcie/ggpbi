import { describe, it, expect, beforeEach } from 'vitest';
import { ggpbi } from '../src/index';
import { shapeToSymbol } from '../src/geoms/util';
import * as d3 from 'd3';

const sampleData = [
  { month: 'Jan', sales: 100 },
  { month: 'Feb', sales: 200 },
  { month: 'Mar', sales: 150 },
];

describe('shapeToSymbol', () => {
  it('returns circle by default', () => {
    expect(shapeToSymbol(undefined)).toBe(d3.symbolCircle);
    expect(shapeToSymbol('circle')).toBe(d3.symbolCircle);
  });

  it('returns correct symbol for each shape', () => {
    expect(shapeToSymbol('square')).toBe(d3.symbolSquare);
    expect(shapeToSymbol('triangle')).toBe(d3.symbolTriangle);
    expect(shapeToSymbol('diamond')).toBe(d3.symbolDiamond);
  });
});

describe('linetype rendering', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('solid line has no stroke-dasharray', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('line', { linetype: 'solid' })
      .renderTo(container);

    const line = container.querySelector('.ggpbi-line');
    expect(line).not.toBeNull();
    expect(line?.getAttribute('stroke-dasharray')).toBeNull();
  });

  it('dashed line has stroke-dasharray', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('line', { linetype: 'dashed' })
      .renderTo(container);

    const line = container.querySelector('.ggpbi-line');
    expect(line?.getAttribute('stroke-dasharray')).toBe('6 4');
  });

  it('dotted line has stroke-dasharray', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('line', { linetype: 'dotted' })
      .renderTo(container);

    const line = container.querySelector('.ggpbi-line');
    expect(line?.getAttribute('stroke-dasharray')).toBe('2 3');
  });
});

describe('shape rendering', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders points as <path> elements (not <circle>)', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('point')
      .renderTo(container);

    const points = container.querySelectorAll('.ggpbi-point');
    expect(points.length).toBe(3);
    // Should be <path>, not <circle>
    expect(points[0].tagName.toLowerCase()).toBe('path');
  });

  it('renders points with transform for positioning', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('point', { shape: 'diamond' })
      .renderTo(container);

    const points = container.querySelectorAll('.ggpbi-point');
    expect(points.length).toBe(3);
    for (const p of points) {
      expect(p.getAttribute('transform')).toContain('translate');
      expect(p.getAttribute('d')).toBeTruthy();
    }
  });
});

// Position dodge/stack/fill tests live in geom-bar.test.ts and scene-bar.test.ts

describe('bar border styling (ggplot2 colour/linewidth/linetype)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('default: no stroke on bars', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .renderTo(container);

    const bar = container.querySelector('.ggpbi-bar') as SVGRectElement;
    expect(bar.getAttribute('stroke')).toBeNull();
    expect(bar.getAttribute('stroke-width')).toBeNull();
  });

  it('stroke sets bar outline colour', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar', { stroke: 'black' })
      .renderTo(container);

    const bar = container.querySelector('.ggpbi-bar') as SVGRectElement;
    expect(bar.getAttribute('stroke')).toBe('black');
  });

  it('strokeWidth sets bar outline width', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar', { strokeWidth: 2 })
      .renderTo(container);

    const bar = container.querySelector('.ggpbi-bar') as SVGRectElement;
    expect(bar.getAttribute('stroke-width')).toBe('2');
    // fallback stroke colour when only strokeWidth is set
    expect(bar.getAttribute('stroke')).toBe('#333333');
  });

  it('linetype applies stroke-dasharray to bars', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar', { stroke: 'red', strokeWidth: 1, linetype: 'dashed' })
      .renderTo(container);

    const bar = container.querySelector('.ggpbi-bar') as SVGRectElement;
    expect(bar.getAttribute('stroke')).toBe('red');
    expect(bar.getAttribute('stroke-dasharray')).toBe('6 4');
  });
});

// Position identity test lives in geom-bar.test.ts

describe('bandScale bar layout (ggplot2-like)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('first bar has outer padding — not flush with Y-axis', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .renderTo(container);

    const bar = container.querySelector('.ggpbi-bar') as SVGRectElement;
    expect(bar).not.toBeNull();
    const barX = parseFloat(bar.getAttribute('x')!);
    // With paddingOuter, the bar should start after the outer padding
    expect(barX).toBeGreaterThan(0);
  });

  it('all bars have equal width from bandwidth()', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .renderTo(container);

    const bars = container.querySelectorAll('.ggpbi-bar');
    const widths = Array.from(bars).map(b => parseFloat(b.getAttribute('width')!));
    // All bars should have the same width
    expect(widths[0]).toBe(widths[1]);
    expect(widths[1]).toBe(widths[2]);
    expect(widths[0]).toBeGreaterThan(0);
  });

  it('supports custom width fraction for narrower bars', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar', { width: 0.5 })
      .renderTo(container);

    const wideContainer = document.createElement('div');
    document.body.appendChild(wideContainer);
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar', { width: 1.0 })
      .renderTo(wideContainer);

    const narrowWidth = parseFloat(container.querySelector('.ggpbi-bar')!.getAttribute('width')!);
    const fullWidth = parseFloat(wideContainer.querySelector('.ggpbi-bar')!.getAttribute('width')!);
    // width: 0.5 should produce bars half as wide as width: 1.0
    expect(narrowWidth).toBeCloseTo(fullWidth * 0.5, 0);
  });

  it('supports custom paddingOuter via scale config', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .scale({ x: { paddingOuter: 1.0 } })
      .geom('bar')
      .renderTo(container);

    const bar = container.querySelector('.ggpbi-bar') as SVGRectElement;
    const barX = parseFloat(bar.getAttribute('x')!);
    // With larger paddingOuter, bars should be further from the edge
    expect(barX).toBeGreaterThan(10);
  });

  it('points on categorical x are centered in band', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .geom('point')
      .renderTo(container);

    const bar = container.querySelector('.ggpbi-bar') as SVGRectElement;
    const point = container.querySelector('.ggpbi-point') as SVGPathElement;

    const barX = parseFloat(bar.getAttribute('x')!);
    const barW = parseFloat(bar.getAttribute('width')!);
    const barCenter = barX + barW / 2;

    // Point transform contains translate(x,y)
    const transform = point.getAttribute('transform')!;
    const match = transform.match(/translate\(([^,]+),/);
    const pointX = parseFloat(match![1]);

    // Point should be centered in the bar (within 1px tolerance)
    expect(Math.abs(pointX - barCenter)).toBeLessThan(1);
  });
});
