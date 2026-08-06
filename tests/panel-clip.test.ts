import { describe, it, expect, beforeEach } from 'vitest';
import { ggpbi } from '../src/index';
import { renderWithState } from '../src/render';

const scatterData = [
  { x: 1, y: 10 },
  { x: 2, y: 20 },
  { x: 3, y: 15 },
  { x: 4, y: 25 },
  { x: 5, y: 30 },
];

const lineData = [
  { x: 1, y: 5 },
  { x: 2, y: 15 },
  { x: 3, y: 10 },
  { x: 4, y: 20 },
];

const barData = [
  { cat: 'A', val: 100 },
  { cat: 'B', val: 200 },
  { cat: 'C', val: 150 },
];

// Helper: parse translate(x,y) from transform attribute
function parseTranslate(el: Element): { x: number; y: number } {
  const t = el.getAttribute('transform') ?? '';
  const m = t.match(/translate\(([\d.e+-]+),([\d.e+-]+)\)/);
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
}

describe('panel clipping and geomPadPx', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders clipPath <defs> as first child of SVG', () => {
    ggpbi()
      .data(scatterData)
      .aes({ x: 'x', y: 'y' })
      .geom('point')
      .renderTo(container);

    const svg = container.querySelector('svg')!;
    const defs = svg.querySelector('defs');
    expect(defs).toBeTruthy();

    // defs must be the first child of SVG (review feedback)
    expect(svg.firstElementChild).toBe(defs);

    const clipPath = defs!.querySelector('clipPath');
    expect(clipPath).toBeTruthy();
    expect(clipPath!.getAttribute('id')).toMatch(/^ggpbi-clip-panel/);

    const clipRect = clipPath!.querySelector('rect');
    expect(clipRect).toBeTruthy();
    expect(Number(clipRect!.getAttribute('width'))).toBeGreaterThan(0);
    expect(Number(clipRect!.getAttribute('height'))).toBeGreaterThan(0);
  });

  it('wraps geom elements in a clip group', () => {
    ggpbi()
      .data(scatterData)
      .aes({ x: 'x', y: 'y' })
      .geom('point')
      .renderTo(container);

    const svg = container.querySelector('svg')!;
    const clipGroup = svg.querySelector('.ggpbi-geom-clip');
    expect(clipGroup).toBeTruthy();

    const clipAttr = clipGroup!.getAttribute('clip-path');
    expect(clipAttr).toMatch(/^url\(#ggpbi-clip-panel/);

    // Points must be inside the clip group
    const pointsInClip = clipGroup!.querySelectorAll('.ggpbi-point');
    expect(pointsInClip.length).toBe(scatterData.length);

    // No points outside the clip group
    const allPoints = svg.querySelectorAll('.ggpbi-point');
    expect(allPoints.length).toBe(pointsInClip.length);
  });

  it('large point size causes wider domain via geomPadPx', () => {
    const c1 = document.createElement('div');
    document.body.appendChild(c1);
    renderWithState(c1, {
      data: scatterData,
      aes: { x: 'x', y: 'y' },
      layers: [{ geom: { type: 'point', size: 2 } }],
      width: 400,
      height: 300,
    });

    const c2 = document.createElement('div');
    document.body.appendChild(c2);
    renderWithState(c2, {
      data: scatterData,
      aes: { x: 'x', y: 'y' },
      layers: [{ geom: { type: 'point', size: 26 } }],
      width: 400,
      height: 300,
    });

    const pos1 = Array.from(c1.querySelectorAll('.ggpbi-point')).map(parseTranslate);
    const pos2 = Array.from(c2.querySelectorAll('.ggpbi-point')).map(parseTranslate);

    // Panel dimensions should be the same
    const clipRect1 = c1.querySelector('clipPath rect')!;
    const clipRect2 = c2.querySelector('clipPath rect')!;
    expect(Number(clipRect1.getAttribute('width'))).toBe(Number(clipRect2.getAttribute('width')));

    // Large points: leftmost further from left, rightmost further from right
    const minX1 = Math.min(...pos1.map(p => p.x));
    const maxX1 = Math.max(...pos1.map(p => p.x));
    const minX2 = Math.min(...pos2.map(p => p.x));
    const maxX2 = Math.max(...pos2.map(p => p.x));
    expect(minX2).toBeGreaterThan(minX1);
    expect(maxX2).toBeLessThan(maxX1);

    // Same for Y axis
    const minY1 = Math.min(...pos1.map(p => p.y));
    const maxY1 = Math.max(...pos1.map(p => p.y));
    const minY2 = Math.min(...pos2.map(p => p.y));
    const maxY2 = Math.max(...pos2.map(p => p.y));
    expect(minY2).toBeGreaterThan(minY1);
    expect(maxY2).toBeLessThan(maxY1);
  });

  it('thick line gets geomPadPx padding', () => {
    const c1 = document.createElement('div');
    document.body.appendChild(c1);
    renderWithState(c1, {
      data: lineData,
      aes: { x: 'x', y: 'y' },
      layers: [{ geom: { type: 'line', size: 1 } }],
      width: 400,
      height: 300,
    });

    const c2 = document.createElement('div');
    document.body.appendChild(c2);
    renderWithState(c2, {
      data: lineData,
      aes: { x: 'x', y: 'y' },
      layers: [{ geom: { type: 'line', size: 20 } }],
      width: 400,
      height: 300,
    });

    // Both should have clipPath
    expect(c1.querySelector('.ggpbi-geom-clip')).toBeTruthy();
    expect(c2.querySelector('.ggpbi-geom-clip')).toBeTruthy();

    // Thick line should have wider Y-axis domain (ticks show wider range)
    const yTicks1 = Array.from(c1.querySelectorAll('.ggpbi-axis-y .tick text'))
      .map(t => Number(t.textContent)).filter(n => !isNaN(n));
    const yTicks2 = Array.from(c2.querySelectorAll('.ggpbi-axis-y .tick text'))
      .map(t => Number(t.textContent)).filter(n => !isNaN(n));

    if (yTicks1.length > 0 && yTicks2.length > 0) {
      const range1 = Math.max(...yTicks1) - Math.min(...yTicks1);
      const range2 = Math.max(...yTicks2) - Math.min(...yTicks2);
      expect(range2).toBeGreaterThanOrEqual(range1);
    }
  });

  it('text geom elements are inside clip group', () => {
    renderWithState(container, {
      data: scatterData,
      aes: { x: 'x', y: 'y' },
      layers: [{ geom: { type: 'text', size: 14 } }],
      width: 400,
      height: 300,
    });

    const clipGroup = container.querySelector('.ggpbi-geom-clip');
    expect(clipGroup).toBeTruthy();
    expect(clipGroup!.getAttribute('clip-path')).toMatch(/^url\(#ggpbi-clip/);

    // Text elements should be inside the clip group
    const textsInClip = clipGroup!.querySelectorAll('.ggpbi-layer-text');
    expect(textsInClip.length).toBeGreaterThan(0);
  });

  it('bar geom elements are inside clip group', () => {
    renderWithState(container, {
      data: barData,
      aes: { x: 'cat', y: 'val' },
      layers: [{ geom: { type: 'col' } }],
      width: 400,
      height: 300,
    });

    const clipGroup = container.querySelector('.ggpbi-geom-clip');
    expect(clipGroup).toBeTruthy();

    const barsInClip = clipGroup!.querySelectorAll('.ggpbi-bar');
    expect(barsInClip.length).toBe(barData.length);
  });

  it('panel background rect exists', () => {
    ggpbi()
      .data(scatterData)
      .aes({ x: 'x', y: 'y' })
      .geom('point')
      .renderTo(container);

    const panel = container.querySelector('.ggpbi-panel');
    expect(panel).toBeTruthy();
    expect(panel!.getAttribute('fill')).toBeTruthy();
  });
});
