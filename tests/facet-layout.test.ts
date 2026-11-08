/**
 * Facet grid geometry: outer axes like ggplot2, relative row heights
 * (patchwork's `heights`, ggh4x's force_panelsizes) and theme-scaled
 * strips and axis room, so a 3× layout (baseSize 40) stays legible.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ggpbi } from '../src/index';
import { layoutFacetGrid, rowWeights, parseHeights, type FacetGridInput } from '../src/facet-layout';
import { specToR } from '../src/r-codegen';
import { parseR } from '../src/r-parse';
import { renderVisual } from './helpers/pbi-host';

const base: FacetGridInput = {
  nRows: 2,
  nCols: 1,
  present: () => true,
  innerWidth: 600,
  innerHeight: 400,
  freeX: false,
  freeY: false,
  stripAbove: () => true,
  stripRight: false,
  yAxisWidth: () => 30,
  reservedLeft: 30,
  metrics: { strip: 20, xAxis: 18, spacing: 5 },
};

describe('rowWeights / parseHeights', () => {
  it('recycles heights over the rows, like patchwork', () => {
    expect(rowWeights(3, [4, 1])).toEqual([4, 1, 4]);
    expect(rowWeights(2)).toEqual([1, 1]);
  });

  it('ignores invalid entries', () => {
    expect(rowWeights(2, [0, -1, NaN])).toEqual([1, 1]);
    expect(rowWeights(2, [2, 0, 1])).toEqual([2, 1]);
  });

  it('parses the Format Pane text', () => {
    expect(parseHeights('4,1')).toEqual([4, 1]);
    expect(parseHeights(' 3 ; 1.5 ')).toEqual([3, 1.5]);
    expect(parseHeights('4 1')).toEqual([4, 1]);
    expect(parseHeights('')).toBeUndefined();
    expect(parseHeights('abc')).toBeUndefined();
    expect(parseHeights([2, 1])).toEqual([2, 1]);
  });
});

describe('layoutFacetGrid', () => {
  it('splits the free height by the row weights', () => {
    const cells = layoutFacetGrid({ ...base, heights: [4, 1] });
    expect(cells).toHaveLength(2);
    expect(cells[0].height / cells[1].height).toBeCloseTo(4, 5);
    // Strips and the gap are taken off before the split.
    expect(cells[0].height + cells[1].height).toBeCloseTo(400 - 2 * 20 - 5, 5);
    // The second panel starts below the first, its strip and the gap.
    expect(cells[1].y).toBeCloseTo(cells[0].y + cells[0].height + 5 + 20, 5);
  });

  it('shares the x axis: only the bottom panel of a column draws it', () => {
    const cells = layoutFacetGrid(base);
    expect(cells.map(c => c.showXAxis)).toEqual([false, true]);
    expect(cells.map(c => c.showYAxis)).toEqual([true, true]); // one column
  });

  it('free x: every panel gets an axis and the grid makes room for it', () => {
    const shared = layoutFacetGrid(base);
    const free = layoutFacetGrid({ ...base, freeX: true });
    expect(free.map(c => c.showXAxis)).toEqual([true, true]);
    const total = (cs: typeof free) => cs[0].height + cs[1].height;
    expect(total(shared) - total(free)).toBeCloseTo(18, 5);
  });

  it('fixed y: interior columns draw no y axis', () => {
    const cells = layoutFacetGrid({ ...base, nRows: 1, nCols: 3 });
    expect(cells.map(c => c.showYAxis)).toEqual([true, false, false]);
  });

  it('free y: interior columns get their own axis room', () => {
    const cells = layoutFacetGrid({ ...base, nRows: 1, nCols: 2, freeY: true });
    expect(cells.map(c => c.showYAxis)).toEqual([true, true]);
    // Column 2 starts after column 1, the gap and its own axis room.
    expect(cells[1].x).toBeCloseTo(cells[0].x + cells[0].width + 5 + 30, 5);
  });

  it('wrap: a panel above an empty cell draws the x axis', () => {
    // 3 panels in 2 columns: (0,0) (0,1) / (1,0) — cell (1,1) is empty.
    const cells = layoutFacetGrid({
      ...base, nCols: 2, present: (r, c) => !(r === 1 && c === 1),
    });
    const at = (r: number, c: number) => cells.find(x => x.r === r && x.c === c)!;
    expect(at(0, 0).showXAxis).toBe(false);
    expect(at(0, 1).showXAxis).toBe(true);
    expect(at(1, 0).showXAxis).toBe(true);
  });

  it('pushes the grid right only by what the outer margin cannot hold', () => {
    const cells = layoutFacetGrid({ ...base, yAxisWidth: () => 50, reservedLeft: 30 });
    expect(cells[0].x).toBeCloseTo(20, 5);
  });
});

describe('faceted rendering', () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const data = ['top', 'bottom'].flatMap((g, gi) =>
    [1, 2, 3, 4].map(x => ({ x, y: gi * 100 + x, g })));

  const render = (facet: object, baseSize?: number) => {
    const chart = ggpbi()
      .data(data)
      .aes({ x: 'x', y: 'y' })
      .geom('line')
      .facet(facet as any)
      .size(600, 400);
    if (baseSize) chart.theme({ baseSize } as any);
    return chart.renderTo(container);
  };

  const panelRects = (svg: SVGSVGElement) =>
    Array.from(svg.querySelectorAll('.ggpbi-facet .ggpbi-panel'));

  it('heights [4, 1] make the first panel four times as tall', () => {
    const svg = render({ wrap: 'g', ncol: 1, heights: [4, 1] });
    const [a, b] = panelRects(svg).map(r => parseFloat(r.getAttribute('height')!));
    expect(a / b).toBeCloseTo(4, 3);
  });

  it('a single column shares the x axis below the last panel', () => {
    const svg = render({ wrap: 'g', ncol: 1 });
    const facets = Array.from(svg.querySelectorAll('.ggpbi-facet'));
    expect(facets.map(f => f.querySelectorAll('.ggpbi-axis-x').length)).toEqual([0, 1]);
    // Both panels sit in the first column, so both keep their y axis.
    expect(facets.map(f => f.querySelectorAll('.ggpbi-axis-y').length)).toEqual([1, 1]);
  });

  it('strip height follows baseSize (3× layouts stay legible)', () => {
    const at = (baseSize: number) => {
      container.replaceChildren();
      const svg = render({ wrap: 'g', ncol: 1 }, baseSize);
      const [first, second] = Array.from(svg.querySelectorAll('.ggpbi-facet'));
      const y = (el: Element) => parseFloat(el.getAttribute('transform')!.match(/,([-\d.]+)\)/)![1]);
      const panel = parseFloat(first.querySelector('.ggpbi-panel')!.getAttribute('height')!);
      // The gap between panel 1's bottom and panel 2's top = spacing + strip.
      return y(second) - y(first) - panel;
    };
    const small = at(11);
    const large = at(40);
    expect(large / small).toBeGreaterThan(3);
  });
});

describe('row heights outside the library', () => {
  it('the R code view writes ggh4x::force_panelsizes and reads it back', () => {
    const spec = {
      data: [{ x: 1, y: 2, g: 'a' }],
      aes: { x: 'x', y: 'y' },
      layers: [{ geom: { type: 'line' as const } }],
      facet: { wrap: 'g', ncol: 1, freeY: true, heights: [4, 1] },
    };
    const code = specToR(spec as any, {});
    expect(code).toContain('ggh4x::force_panelsizes(rows = c(4, 1))');
    const parsed = parseR(code);
    expect(parsed.ok).toBe(true);
    if (parsed.ok !== true) return;
    expect(parsed.patch.facet).toEqual({ wrap: 'g', ncol: 1, freeY: true, heights: [4, 1] });
  });

  it('the R parser accepts force_panelsizes before the facet and without namespace', () => {
    const parsed = parseR(
      'ggplot(d, aes(x = x, y = y)) +\n  geom_line() +\n  force_panelsizes(rows = c(3, 1)) +\n  facet_wrap(~ g)',
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok !== true) return;
    expect(parsed.patch.facet).toEqual({ wrap: 'g', heights: [3, 1] });
  });

  it('the R parser refuses what it cannot express', () => {
    const parsed = parseR('ggplot(d, aes(x = x, y = y)) +\n  geom_line() +\n  ggh4x::force_panelsizes(cols = c(1, 2))');
    expect(parsed.ok).toBe(false);
  });

  it('the Format Pane text "4,1" sizes the panels in the visual', () => {
    const { container } = renderVisual({
      categories: [
        { name: 'Month', role: 'x', values: ['Jan', 'Feb', 'Jan', 'Feb'] },
        { name: 'Panel', role: 'facet', values: ['A', 'A', 'B', 'B'] },
      ],
      measures: [{ name: 'Sales', values: [1, 3, 2, 4] }],
      objects: { layer1: { enabled: true, type: 'line' }, facet: { columns: 1, heights: '4,1' } },
    });
    const heights = Array.from(container.querySelectorAll('.ggpbi-facet .ggpbi-panel'))
      .map(r => parseFloat(r.getAttribute('height')!));
    expect(heights).toHaveLength(2);
    expect(heights[0] / heights[1]).toBeCloseTo(4, 3);
  });
});
