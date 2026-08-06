import { describe, it, expect, beforeEach } from 'vitest';
import { ggpbi } from '../src/index';

/**
 * Regression: geoms with width on a CONTINUOUS axis (boxplots/bars on a
 * numeric x like ToothGrowth dose 0.5/1/2) must fit inside the panel.
 * The pad-pixel inversion used to run on the unpadded scale — after
 * widening the domain, pixels-per-unit shrank and the outer boxes were
 * clipped at the panel edges (the demo report's boxplot page).
 */
describe('continuous-axis geom padding', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const doses = [0.5, 1, 2];
  const data = doses.flatMap(dose =>
    [4, 8, 10, 14, 18, 22].map(len => ({ dose, len: len + dose * 4 }))
  );

  it('boxplots on a numeric x axis stay inside the panel', () => {
    const svg = ggpbi()
      .data(data as any)
      .aes({ x: 'dose', y: 'len' })
      .geom('boxplot')
      .size(1200, 640)
      .renderTo(container);

    const innerWidth = Number(svg.querySelector('.ggpbi-panel')!.getAttribute('width'));
    const boxes = Array.from(svg.querySelectorAll('.ggpbi-geom-clip rect'));
    expect(boxes.length).toBeGreaterThanOrEqual(3);
    for (const b of boxes) {
      const x = Number(b.getAttribute('x'));
      const right = x + Number(b.getAttribute('width'));
      expect(x, 'box clipped at the left edge').toBeGreaterThanOrEqual(-0.01);
      expect(right, 'box clipped at the right edge').toBeLessThanOrEqual(innerWidth + 0.01);
    }
  });

  it('bars on a numeric x axis stay inside the panel', () => {
    const svg = ggpbi()
      .data(doses.map(dose => ({ dose, total: dose * 100 })) as any)
      .aes({ x: 'dose', y: 'total' })
      .geom('col')
      .size(800, 400)
      .renderTo(container);

    const innerWidth = Number(svg.querySelector('.ggpbi-panel')!.getAttribute('width'));
    for (const b of svg.querySelectorAll('.ggpbi-geom-clip rect')) {
      const x = Number(b.getAttribute('x'));
      const right = x + Number(b.getAttribute('width'));
      expect(x).toBeGreaterThanOrEqual(-0.01);
      expect(right).toBeLessThanOrEqual(innerWidth + 0.01);
    }
  });
});

describe('stacked bars leave headroom at the panel top', () => {
  it('the tallest stack does not touch y = 0 of the panel', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const rows = ['0.5', '1', '2'].flatMap(dose =>
      ['OJ', 'VC'].map(supp => ({ dose, supp, len: supp === 'OJ' ? 20 : 15 })),
    );
    const svg = ggpbi()
      .data(rows as any)
      .aes({ x: 'dose', y: 'len', color: 'supp' })
      .geom('bar', { position: 'stack' })
      .scale({ x: 'category' })
      .size(500, 350)
      .renderTo(container);
    const tops = Array.from(svg.querySelectorAll('.ggpbi-bar'))
      .map(r => parseFloat(r.getAttribute('y')!));
    // ggplot2-style 5% expansion: the highest bar top sits below the
    // panel edge instead of touching it.
    expect(Math.min(...tops)).toBeGreaterThan(2);
  });
});
