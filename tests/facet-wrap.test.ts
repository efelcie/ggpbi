import { describe, it, expect, beforeEach } from 'vitest';
import { ggpbi } from '../src/index';

describe('facet_wrap', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const mkData = (levels: string[], perLevel = 3) =>
    levels.flatMap((g, gi) =>
      Array.from({ length: perLevel }, (_, i) => ({ x: i + 1, y: gi * 10 + i, g }))
    );

  const render = (data: any[], facet: object) =>
    ggpbi()
      .data(data)
      .aes({ x: 'x', y: 'y' })
      .geom('point')
      .facet(facet as any)
      .size(640, 400)
      .renderTo(container);

  const strips = (svg: SVGSVGElement): string[] =>
    Array.from(svg.querySelectorAll('.ggpbi-facet-strip-wrap')).map(t => (t.textContent ?? '').trim());

  it('wraps into a roughly square grid by default (5 levels -> 3 columns)', () => {
    const svg = render(mkData(['a', 'b', 'c', 'd', 'e']), { wrap: 'g' });
    // One panel per level, no empty-cell panels.
    expect(svg.querySelectorAll('.ggpbi-facet').length).toBe(5);
    expect(strips(svg)).toEqual(['a', 'b', 'c', 'd', 'e']);
    // ceil(sqrt(5)) = 3 columns → first row has 3 distinct x offsets.
    const xOffsets = new Set(
      Array.from(svg.querySelectorAll('.ggpbi-facet')).map(
        f => f.getAttribute('transform')!.match(/translate\(([\d.]+)/)![1]
      )
    );
    expect(xOffsets.size).toBe(3);
  });

  it('honours an explicit ncol', () => {
    const svg = render(mkData(['a', 'b', 'c', 'd']), { wrap: 'g', ncol: 2 });
    expect(svg.querySelectorAll('.ggpbi-facet').length).toBe(4);
    const xOffsets = new Set(
      Array.from(svg.querySelectorAll('.ggpbi-facet')).map(
        f => f.getAttribute('transform')!.match(/translate\(([\d.]+)/)![1]
      )
    );
    expect(xOffsets.size).toBe(2);
  });

  it('derives columns from nrow when only nrow is set', () => {
    const svg = render(mkData(['a', 'b', 'c', 'd', 'e', 'f']), { wrap: 'g', nrow: 2 });
    // 6 levels / 2 rows = 3 columns.
    const xOffsets = new Set(
      Array.from(svg.querySelectorAll('.ggpbi-facet')).map(
        f => f.getAttribute('transform')!.match(/translate\(([\d.]+)/)![1]
      )
    );
    expect(xOffsets.size).toBe(3);
  });

  it('sorts wrap levels like facet_grid (numeric-aware)', () => {
    const data = [
      { x: 1, y: 1, g: 10 },
      { x: 1, y: 1, g: 2 },
      { x: 1, y: 1, g: 2 },
      { x: 1, y: 1, g: 10 },
      { x: 1, y: 2, g: 1 },
      { x: 1, y: 2, g: 1 },
    ];
    const svg = render(data, { wrap: 'g' });
    expect(strips(svg)).toEqual(['1', '2', '10']);
  });

  it('wrap takes precedence over row/col', () => {
    const data = mkData(['a', 'b']).map(d => ({ ...d, other: 'x' }));
    const svg = render(data, { wrap: 'g', col: 'other' });
    expect(strips(svg)).toEqual(['a', 'b']);
    expect(svg.querySelectorAll('.ggpbi-facet-strip-col').length).toBe(0);
  });

  it('supports free y scales per panel', () => {
    const data = [
      { x: 1, y: 1, g: 'small' }, { x: 2, y: 2, g: 'small' },
      { x: 1, y: 100, g: 'big' }, { x: 2, y: 200, g: 'big' },
    ];
    const svg = render(data, { wrap: 'g', freeY: true });
    const axisLabels = Array.from(svg.querySelectorAll('.ggpbi-facet text'))
      .map(t => t.textContent ?? '');
    // With free scales the "big" panel shows tick labels in the hundreds.
    expect(axisLabels.some(l => /150|200/.test(l))).toBe(true);
    expect(svg.innerHTML).not.toMatch(/NaN/);
  });
});

describe('facet_wrap grid dimensions (ggplot2 wrap_dims)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  /**
   * Distinct facet-group origins → the grid the renderer produced. The
   * .ggpbi-facet group carries the placement transform; the panel inside
   * sits at a fixed offset, so read the group.
   */
  const gridOf = (svg: SVGSVGElement) => {
    const cells = Array.from(svg.querySelectorAll('.ggpbi-facet'));
    const xs = new Set<string>();
    const ys = new Set<string>();
    for (const c of cells) {
      const t = (c.getAttribute('transform') ?? '').match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
      if (t) { xs.add(t[1]); ys.add(t[2]); }
    }
    return { cols: xs.size, rows: ys.size, panels: cells.length };
  };

  const renderWrap = (levels: number, extra: Record<string, unknown> = {}) => {
    const rows = Array.from({ length: levels * 3 }, (_, i) => ({
      g: `g${i % levels}`,
      x: i,
      y: (i * 7) % 13,
    }));
    return ggpbi()
      .data(rows as any)
      .aes({ x: 'x', y: 'y' })
      .geom('line')
      .facet({ wrap: 'g', ...extra })
      .size(700, 520)
      .renderTo(container);
  };

  it('6 levels wrap into 3 × 2, not a single row', () => {
    const grid = gridOf(renderWrap(6));
    expect(grid.panels).toBe(6);
    expect(grid.cols).toBe(3);
    expect(grid.rows).toBe(2);
  });

  it('4 levels give 2 × 2, 9 levels give 3 × 3', () => {
    expect(gridOf(renderWrap(4))).toMatchObject({ cols: 2, rows: 2 });
    expect(gridOf(renderWrap(9))).toMatchObject({ cols: 3, rows: 3 });
  });

  it('an explicit ncol wins over the automatic dimensions', () => {
    const grid = gridOf(renderWrap(6, { ncol: 2 }));
    expect(grid.cols).toBe(2);
    expect(grid.rows).toBe(3);
  });

  it('a single level stays one panel', () => {
    expect(gridOf(renderWrap(1))).toMatchObject({ cols: 1, rows: 1, panels: 1 });
  });
});
