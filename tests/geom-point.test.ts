import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ggpbi } from '../src/index';
import { shapeToSymbol, getShapeInfo } from '../src/geoms/util';
import * as d3 from 'd3';

// --- Test data ---

const scatterData = [
  { x: 1, y: 10 },
  { x: 2, y: 20 },
  { x: 3, y: 15 },
  { x: 4, y: 25 },
  { x: 5, y: 30 },
];

const colorData = [
  { x: 1, y: 10, grp: 'A' },
  { x: 2, y: 20, grp: 'A' },
  { x: 3, y: 15, grp: 'B' },
  { x: 4, y: 25, grp: 'B' },
];

const catData = [
  { cat: 'Jan', val: 100 },
  { cat: 'Feb', val: 200 },
  { cat: 'Mar', val: 150 },
];

const dataWithNA = [
  { x: 1, y: 10 },
  { x: 2, y: null },
  { x: null, y: 15 },
  { x: 4, y: 25 },
];

// --- Helpers ---

function getPoints(container: HTMLElement) {
  return container.querySelectorAll('.ggpbi-point');
}

function getPointAttr(container: HTMLElement, index: number, attr: string) {
  const points = getPoints(container);
  return points[index]?.getAttribute(attr);
}

// --- Tests ---

describe('getShapeInfo', () => {
  it('returns filled category for basic shapes', () => {
    expect(getShapeInfo('circle').category).toBe('filled');
    expect(getShapeInfo('square').category).toBe('filled');
    expect(getShapeInfo('triangle').category).toBe('filled');
    expect(getShapeInfo('diamond').category).toBe('filled');
  });

  it('returns open category for open shapes', () => {
    expect(getShapeInfo('circleOpen').category).toBe('open');
    expect(getShapeInfo('squareOpen').category).toBe('open');
    expect(getShapeInfo('triangleOpen').category).toBe('open');
    expect(getShapeInfo('diamondOpen').category).toBe('open');
  });

  it('returns fillBorder category for filled shapes', () => {
    expect(getShapeInfo('circleFilled').category).toBe('fillBorder');
    expect(getShapeInfo('squareFilled').category).toBe('fillBorder');
    expect(getShapeInfo('triangleFilled').category).toBe('fillBorder');
    expect(getShapeInfo('diamondFilled').category).toBe('fillBorder');
  });

  it('returns line category for line shapes', () => {
    expect(getShapeInfo('plus').category).toBe('line');
    expect(getShapeInfo('cross').category).toBe('line');
    expect(getShapeInfo('asterisk').category).toBe('line');
    expect(getShapeInfo('star').category).toBe('line');
  });

  it('defaults to circle (filled) for undefined', () => {
    const info = getShapeInfo(undefined);
    expect(info.category).toBe('filled');
    expect(info.symbol).toBe(d3.symbolCircle);
  });
});

describe('shapeToSymbol (backwards compatible)', () => {
  it('returns circle by default', () => {
    expect(shapeToSymbol(undefined)).toBe(d3.symbolCircle);
    expect(shapeToSymbol('circle')).toBe(d3.symbolCircle);
  });

  it('returns correct symbol for basic shapes', () => {
    expect(shapeToSymbol('square')).toBe(d3.symbolSquare);
    expect(shapeToSymbol('triangle')).toBe(d3.symbolTriangle);
    expect(shapeToSymbol('diamond')).toBe(d3.symbolDiamond);
  });

  it('returns circle symbol for open/filled variants', () => {
    expect(shapeToSymbol('circleOpen')).toBe(d3.symbolCircle);
    expect(shapeToSymbol('circleFilled')).toBe(d3.symbolCircle);
  });

  it('returns star symbol for star', () => {
    expect(shapeToSymbol('star')).toBe(d3.symbolStar);
  });
});

describe('geom_point: basic rendering', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders correct number of points', () => {
    ggpbi()
      .data(scatterData)
      .aes({ x: 'x', y: 'y' })
      .geom('point')
      .renderTo(container);

    expect(getPoints(container).length).toBe(5);
  });

  it('renders points as <path> elements', () => {
    ggpbi()
      .data(scatterData)
      .aes({ x: 'x', y: 'y' })
      .geom('point')
      .renderTo(container);

    const points = getPoints(container);
    for (const p of points) {
      expect(p.tagName.toLowerCase()).toBe('path');
    }
  });

  it('applies default fill (#4682B4) for filled shapes', () => {
    ggpbi()
      .data(scatterData)
      .aes({ x: 'x', y: 'y' })
      .geom('point') // default shape = circle (filled)
      .renderTo(container);

    expect(getPointAttr(container, 0, 'fill')).toBe('#4682B4');
  });

  it('applies custom static color', () => {
    ggpbi()
      .data(scatterData)
      .aes({ x: 'x', y: 'y' })
      .geom('point', { color: '#FF0000' })
      .renderTo(container);

    expect(getPointAttr(container, 0, 'fill')).toBe('#FF0000');
  });

  it('applies custom alpha', () => {
    ggpbi()
      .data(scatterData)
      .aes({ x: 'x', y: 'y' })
      .geom('point', { alpha: 0.5 })
      .renderTo(container);

    expect(getPointAttr(container, 0, 'opacity')).toBe('0.5');
  });

  it('has ARIA attributes for accessibility', () => {
    ggpbi()
      .data(scatterData)
      .aes({ x: 'x', y: 'y' })
      .geom('point')
      .renderTo(container);

    const point = getPoints(container)[0];
    expect(point.getAttribute('role')).toBe('listitem');
    expect(point.getAttribute('tabindex')).toBe('0');
    expect(point.getAttribute('aria-label')).toBeTruthy();
  });
});

describe('geom_point: all 16 shapes render', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const allShapes = [
    'circle', 'square', 'triangle', 'diamond',
    'circleOpen', 'squareOpen', 'triangleOpen', 'diamondOpen',
    'circleFilled', 'squareFilled', 'triangleFilled', 'diamondFilled',
    'plus', 'cross', 'asterisk', 'star',
  ] as const;

  for (const shape of allShapes) {
    it(`renders shape: ${shape}`, () => {
      ggpbi()
        .data(scatterData)
        .aes({ x: 'x', y: 'y' })
        .geom('point', { shape })
        .renderTo(container);

      const points = getPoints(container);
      expect(points.length).toBe(5);
      // All points should have a valid d attribute (path data)
      for (const p of points) {
        expect(p.getAttribute('d')).toBeTruthy();
      }
    });
  }
});

describe('geom_point: shape categories and fill/stroke', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('filled shapes: fill = colour, no stroke', () => {
    ggpbi()
      .data(scatterData)
      .aes({ x: 'x', y: 'y' })
      .geom('point', { shape: 'circle', color: '#FF0000' })
      .renderTo(container);

    const p = getPoints(container)[0];
    expect(p.getAttribute('fill')).toBe('#FF0000');
    expect(p.getAttribute('stroke')).toBeNull();
  });

  it('open shapes: fill = none, stroke = colour', () => {
    ggpbi()
      .data(scatterData)
      .aes({ x: 'x', y: 'y' })
      .geom('point', { shape: 'circleOpen', color: '#00FF00' })
      .renderTo(container);

    const p = getPoints(container)[0];
    expect(p.getAttribute('fill')).toBe('none');
    expect(p.getAttribute('stroke')).toBe('#00FF00');
  });

  it('fillBorder shapes: fill = fill colour, stroke = colour', () => {
    ggpbi()
      .data(scatterData)
      .aes({ x: 'x', y: 'y' })
      .geom('point', { shape: 'circleFilled', color: '#0000FF', fill: '#FFFF00' })
      .renderTo(container);

    const p = getPoints(container)[0];
    expect(p.getAttribute('fill')).toBe('#FFFF00');
    expect(p.getAttribute('stroke')).toBe('#0000FF');
  });

  it('fillBorder shapes: default fill is white', () => {
    ggpbi()
      .data(scatterData)
      .aes({ x: 'x', y: 'y' })
      .geom('point', { shape: 'squareFilled' })
      .renderTo(container);

    const p = getPoints(container)[0];
    expect(p.getAttribute('fill')).toBe('#FFFFFF');
  });

  it('line shapes: fill = none, stroke = colour', () => {
    ggpbi()
      .data(scatterData)
      .aes({ x: 'x', y: 'y' })
      .geom('point', { shape: 'plus', color: '#FF00FF' })
      .renderTo(container);

    const p = getPoints(container)[0];
    expect(p.getAttribute('fill')).toBe('none');
    expect(p.getAttribute('stroke')).toBe('#FF00FF');
  });

  it('star shape renders with stroke', () => {
    ggpbi()
      .data(scatterData)
      .aes({ x: 'x', y: 'y' })
      .geom('point', { shape: 'star' })
      .renderTo(container);

    const p = getPoints(container)[0];
    expect(p.getAttribute('fill')).toBe('none');
    expect(p.getAttribute('stroke')).toBeTruthy();
  });
});

describe('geom_point: colour aesthetic with colorScale', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('applies color from color aesthetic', () => {
    ggpbi()
      .data(colorData)
      .aes({ x: 'x', y: 'y', color: 'grp' })
      .geom('point')
      .renderTo(container);

    const points = getPoints(container);
    expect(points.length).toBe(4);
    // Points in group A should have the same fill
    const fillA = points[0].getAttribute('fill');
    const fillB = points[2].getAttribute('fill');
    expect(fillA).toBeTruthy();
    expect(fillB).toBeTruthy();
    // Different groups should have different colors
    expect(fillA).not.toBe(fillB);
  });

  it('open shapes use colorScale for stroke instead of fill', () => {
    ggpbi()
      .data(colorData)
      .aes({ x: 'x', y: 'y', color: 'grp' })
      .geom('point', { shape: 'circleOpen' })
      .renderTo(container);

    const points = getPoints(container);
    const strokeA = points[0].getAttribute('stroke');
    const strokeB = points[2].getAttribute('stroke');
    expect(strokeA).toBeTruthy();
    expect(strokeB).toBeTruthy();
    expect(strokeA).not.toBe(strokeB);
    // Fill should be none for open shapes
    expect(points[0].getAttribute('fill')).toBe('none');
  });
});

describe('geom_point: size', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('different sizes produce different path data', () => {
    ggpbi()
      .data(scatterData)
      .aes({ x: 'x', y: 'y' })
      .geom('point', { size: 3 })
      .renderTo(container);

    const smallD = getPointAttr(container, 0, 'd');

    container.replaceChildren();
    ggpbi()
      .data(scatterData)
      .aes({ x: 'x', y: 'y' })
      .geom('point', { size: 10 })
      .renderTo(container);

    const bigD = getPointAttr(container, 0, 'd');

    expect(smallD).not.toBe(bigD);
  });
});

describe('geom_point: position jitter', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('jitter produces offset positions on categorical x', () => {
    ggpbi()
      .data(catData)
      .aes({ x: 'cat', y: 'val' })
      .geom('point', { position: 'jitter' })
      .renderTo(container);

    const points = getPoints(container);
    expect(points.length).toBe(3);
    // Each point should have a transform
    for (const p of points) {
      expect(p.getAttribute('transform')).toContain('translate');
    }
  });

  it('jitter is deterministic (same positions on re-render)', () => {
    ggpbi()
      .data(catData)
      .aes({ x: 'cat', y: 'val' })
      .geom('point', { position: 'jitter' })
      .renderTo(container);

    const transforms1 = Array.from(getPoints(container)).map(p => p.getAttribute('transform'));

    container.replaceChildren();
    ggpbi()
      .data(catData)
      .aes({ x: 'cat', y: 'val' })
      .geom('point', { position: 'jitter' })
      .renderTo(container);

    const transforms2 = Array.from(getPoints(container)).map(p => p.getAttribute('transform'));

    expect(transforms1).toEqual(transforms2);
  });

  it('identity position has no jitter offset (consistent transforms)', () => {
    ggpbi()
      .data(catData)
      .aes({ x: 'cat', y: 'val' })
      .geom('point') // default: identity
      .renderTo(container);

    // Re-render should produce exact same transforms
    const transforms1 = Array.from(getPoints(container)).map(p => p.getAttribute('transform'));

    container.replaceChildren();
    ggpbi()
      .data(catData)
      .aes({ x: 'cat', y: 'val' })
      .geom('point')
      .renderTo(container);

    const transforms2 = Array.from(getPoints(container)).map(p => p.getAttribute('transform'));

    expect(transforms1).toEqual(transforms2);
  });
});

describe('geom_point: NA handling', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('filters out NA values by default (with warning)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    ggpbi()
      .data(dataWithNA)
      .aes({ x: 'x', y: 'y' })
      .geom('point')
      .renderTo(container);

    const points = getPoints(container);
    // Only 2 points should render (rows with valid x AND y)
    expect(points.length).toBe(2);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('naRm: true filters silently (no warning)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    ggpbi()
      .data(dataWithNA)
      .aes({ x: 'x', y: 'y' })
      .geom('point', { naRm: true })
      .renderTo(container);

    const points = getPoints(container);
    expect(points.length).toBe(2);
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

describe('geom_point: strokeWidth for fillBorder shapes', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('applies custom strokeWidth to fillBorder shapes', () => {
    ggpbi()
      .data(scatterData)
      .aes({ x: 'x', y: 'y' })
      .geom('point', { shape: 'circleFilled', strokeWidth: 3 })
      .renderTo(container);

    const p = getPoints(container)[0];
    expect(p.getAttribute('stroke-width')).toBe('3');
  });

  it('default strokeWidth for fillBorder shapes is 0.5', () => {
    ggpbi()
      .data(scatterData)
      .aes({ x: 'x', y: 'y' })
      .geom('point', { shape: 'diamondFilled' })
      .renderTo(container);

    const p = getPoints(container)[0];
    expect(p.getAttribute('stroke-width')).toBe('0.5');
  });
});

describe('geom_point: points on categorical x centered in band', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('points on categorical x are centered in band', () => {
    ggpbi()
      .data(catData)
      .aes({ x: 'cat', y: 'val' })
      .geom('bar')
      .geom('point')
      .renderTo(container);

    const bar = container.querySelector('.ggpbi-bar') as SVGRectElement;
    const point = container.querySelector('.ggpbi-point') as SVGPathElement;

    const barX = parseFloat(bar.getAttribute('x')!);
    const barW = parseFloat(bar.getAttribute('width')!);
    const barCenter = barX + barW / 2;

    const transform = point.getAttribute('transform')!;
    const match = transform.match(/translate\(([^,]+),/);
    const pointX = parseFloat(match![1]);

    expect(Math.abs(pointX - barCenter)).toBeLessThan(1);
  });
});
