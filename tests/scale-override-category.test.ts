import { describe, it, expect, beforeEach } from 'vitest';
import { ggpbi } from '../src/index';

describe('scale override: category on numeric x', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('honours explicit x scale=category even when x values are numeric', () => {
    const data = [
      { x: 3, y: 1 },
      { x: 4, y: 2 },
      { x: 5, y: 3 },
    ];

    const svg = ggpbi()
      .data(data as any)
      .aes({ x: 'x', y: 'y' })
      .geom('point')
      .scale({ x: 'category' })
      .renderTo(container);

    const ticks = Array.from(svg.querySelectorAll('.ggpbi-axis-x .tick text'))
      .map(t => (t.textContent ?? '').trim())
      .filter(Boolean);

    expect(ticks).toEqual(['3', '4', '5']);
  });

  it('positions bar marks on the band scale when numeric x is forced to category', () => {
    // Regression: the band domain is stringified, so numeric lookups used to
    // miss the band and every rect landed at x=NaN (rendered collapsed at 0).
    const data = [
      { dose: 0.5, len: 10, supp: 'VC' },
      { dose: 1, len: 20, supp: 'VC' },
      { dose: 2, len: 30, supp: 'VC' },
      { dose: 0.5, len: 12, supp: 'OJ' },
      { dose: 1, len: 22, supp: 'OJ' },
      { dose: 2, len: 32, supp: 'OJ' },
    ];

    const svg = ggpbi()
      .data(data as any)
      .aes({ x: 'dose', color: 'supp', weight: 'len' })
      .geom('bar', { position: 'stack' })
      .scale({ x: 'category' })
      .renderTo(container);

    const bars = Array.from(svg.querySelectorAll('rect')).filter(
      r => !r.closest('defs') && r.getAttribute('class') !== 'ggpbi-panel' && Number(r.getAttribute('height')) > 20
    );
    expect(bars.length).toBe(6);
    const xs = new Set(bars.map(r => r.getAttribute('x')));
    expect(xs.has('NaN')).toBe(false);
    // 3 dose bands → 3 distinct x positions, two stacked segments each.
    expect(xs.size).toBe(3);
  });

  it('positions boxplot marks when numeric x is forced to category', () => {
    const data = [0.5, 1, 2].flatMap(dose =>
      [4, 8, 10, 12, 16].map(len => ({ dose, len: len + dose * 10 }))
    );

    const svg = ggpbi()
      .data(data as any)
      .aes({ x: 'dose', y: 'len' })
      .geom('boxplot')
      .scale({ x: 'category' })
      .renderTo(container);

    const serialized = svg.innerHTML;
    expect(serialized).not.toMatch(/NaN/);
    // One box rect per dose group.
    const boxes = Array.from(svg.querySelectorAll('rect')).filter(
      r => !r.closest('defs') && r.getAttribute('class') !== 'ggpbi-panel'
    );
    expect(boxes.length).toBeGreaterThanOrEqual(3);
  });
});
