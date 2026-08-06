import { describe, it, expect, beforeEach } from 'vitest';
import { ggpbi } from '../src/index';

describe('facet level ordering', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const strips = (svg: SVGSVGElement): string[] =>
    Array.from(svg.querySelectorAll('.ggpbi-facet-label, .ggpbi-strip, text'))
      .map(t => (t.textContent ?? '').trim());

  it('sorts numeric facet levels numerically, not in data order', () => {
    // Regression: mtcars-style data arrives as 6, 4, 8 — panels must show 4, 6, 8.
    const data = [
      { x: 1, y: 1, cyl: 6 },
      { x: 2, y: 2, cyl: 4 },
      { x: 3, y: 3, cyl: 8 },
      { x: 4, y: 4, cyl: 10 },
    ];

    const svg = ggpbi()
      .data(data as any)
      .aes({ x: 'x', y: 'y' })
      .geom('point')
      .facet({ col: 'cyl' })
      .size(640, 400)
      .renderTo(container);

    const texts = strips(svg);
    const order = ['4', '6', '8', '10']
      .map(l => texts.findIndex(t => t === l));
    expect(order.every(i => i >= 0), `strip labels missing in: ${texts.join(', ')}`).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('sorts string facet levels alphabetically', () => {
    const data = [
      { x: 1, y: 1, g: 'c' },
      { x: 2, y: 2, g: 'a' },
      { x: 3, y: 3, g: 'b' },
    ];

    const svg = ggpbi()
      .data(data as any)
      .aes({ x: 'x', y: 'y' })
      .geom('point')
      .facet({ col: 'g' })
      .size(640, 400)
      .renderTo(container);

    const texts = strips(svg);
    const order = ['a', 'b', 'c'].map(l => texts.findIndex(t => t === l));
    expect(order.every(i => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
