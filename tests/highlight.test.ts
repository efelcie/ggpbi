import { describe, it, expect, beforeEach } from 'vitest';
import { ggpbi } from '../src/index';

describe('gghighlight: data-driven highlighting', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const seriesData = ['a', 'b', 'c'].flatMap(g =>
    [1, 2, 3, 4].map(x => ({ x, y: x * (g.charCodeAt(0) - 96), g }))
  );

  it('group mode: unhighlighted series turn grey, highlighted keep their colour', () => {
    const svg = ggpbi()
      .data(seriesData as any)
      .aes({ x: 'x', y: 'y', color: 'g' })
      .geom('line')
      .highlight({ filter: d => d.g === 'b' })
      .size(500, 350)
      .renderTo(container);

    const paths = Array.from(svg.querySelectorAll('.ggpbi-geom-clip path'));
    expect(paths.length).toBe(3);
    const strokes = paths.map(p => p.getAttribute('stroke'));
    expect(strokes.filter(c => c === '#BEBEBE').length).toBe(2);
    expect(strokes.filter(c => c !== '#BEBEBE').length).toBe(1);
  });

  it('group mode: highlighted groups keep the SAME colour they had without highlighting', () => {
    const render = (highlight: boolean) => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      const b = ggpbi()
        .data(seriesData as any)
        .aes({ x: 'x', y: 'y', color: 'g' })
        .geom('line');
      if (highlight) b.highlight({ filter: d => d.g === 'b' });
      const svg = b.size(500, 350).renderTo(el);
      const paths = Array.from(svg.querySelectorAll('.ggpbi-geom-clip path'));
      return paths.map(p => p.getAttribute('stroke'));
    };
    const plain = render(false);
    const highlighted = render(true).filter(c => c !== '#BEBEBE');
    // Colour of series b (2nd in data order) must be identical in both renders.
    expect(highlighted).toEqual([plain[1]]);
  });

  it('group mode: legend shows only highlighted groups', () => {
    const svg = ggpbi()
      .data(seriesData as any)
      .aes({ x: 'x', y: 'y', color: 'g' })
      .geom('line')
      .highlight({ filter: d => d.g === 'b' })
      .size(500, 350)
      .renderTo(container);

    const labels = Array.from(svg.querySelectorAll('.ggpbi-legend-entry'))
      .map(e => e.getAttribute('data-label'));
    expect(labels).toEqual(['b']);
  });

  it('group mode: grey marks are drawn underneath highlighted ones', () => {
    const svg = ggpbi()
      .data(seriesData as any)
      .aes({ x: 'x', y: 'y', color: 'g' })
      .geom('line')
      .highlight({ filter: d => d.g === 'b' })
      .size(500, 350)
      .renderTo(container);

    const strokes = Array.from(svg.querySelectorAll('.ggpbi-geom-clip path'))
      .map(p => p.getAttribute('stroke'));
    // DOM order = painting order: the non-grey path must come last.
    expect(strokes[strokes.length - 1]).not.toBe('#BEBEBE');
  });

  it('row mode (no colour aes): failing rows grey, passing rows keep the default colour', () => {
    const data = [
      { x: 1, y: 1 }, { x: 2, y: 8 }, { x: 3, y: 2 }, { x: 4, y: 9 },
    ];
    const svg = ggpbi()
      .data(data as any)
      .aes({ x: 'x', y: 'y' })
      .geom('point', { size: 6 })
      .highlight({ filter: d => d.y > 5 })
      .size(500, 350)
      .renderTo(container);

    const fills = Array.from(svg.querySelectorAll('.ggpbi-point'))
      .map(p => p.getAttribute('fill'));
    expect(fills.filter(c => c === '#BEBEBE').length).toBe(2);
    expect(fills.filter(c => c !== '#BEBEBE').length).toBe(2);
  });

  it('custom unhighlighted colour is honoured', () => {
    const svg = ggpbi()
      .data(seriesData as any)
      .aes({ x: 'x', y: 'y', color: 'g' })
      .geom('line')
      .highlight({ filter: d => d.g === 'a', color: '#EEEEEE' })
      .size(500, 350)
      .renderTo(container);

    const strokes = Array.from(svg.querySelectorAll('.ggpbi-geom-clip path'))
      .map(p => p.getAttribute('stroke'));
    expect(strokes.filter(c => c === '#EEEEEE').length).toBe(2);
  });

  it('no matches: everything grey, empty legend, no crash', () => {
    const svg = ggpbi()
      .data(seriesData as any)
      .aes({ x: 'x', y: 'y', color: 'g' })
      .geom('line')
      .highlight({ filter: () => false })
      .size(500, 350)
      .renderTo(container);

    const strokes = Array.from(svg.querySelectorAll('.ggpbi-geom-clip path'))
      .map(p => p.getAttribute('stroke'));
    expect(strokes.every(c => c === '#BEBEBE')).toBe(true);
    expect(svg.querySelectorAll('.ggpbi-legend-entry').length).toBe(0);
  });
});

describe('gghighlight × labels and per-layer control', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const cars = [
    { wt: 2.6, mpg: 21, name: 'Mazda RX4' },
    { wt: 3.2, mpg: 22.8, name: 'Datsun 710' },
    { wt: 3.46, mpg: 18.1, name: 'Valiant' },
    { wt: 5.3, mpg: 14.7, name: 'Chrysler Imperial' },
  ];

  it('text layers show ONLY highlighted labels (direct labeling, like gghighlight)', () => {
    const svg = ggpbi()
      .data(cars as any)
      .aes({ x: 'wt', y: 'mpg', label: 'name' })
      .geom('point', { size: 6 })
      .geom('text', { repel: true })
      .highlight({ filter: d => d.name === 'Valiant' })
      .size(500, 350)
      .renderTo(container);

    const labels = Array.from(svg.querySelectorAll('.ggpbi-geom-clip text'))
      .map(t => t.textContent);
    expect(labels).toEqual(['Valiant']);
    // Points still all render: 1 default-coloured + 3 grey.
    const fills = Array.from(svg.querySelectorAll('.ggpbi-point')).map(p => p.getAttribute('fill'));
    expect(fills.length).toBe(4);
    expect(fills.filter(c => c === '#BEBEBE').length).toBe(3);
  });

  it('a text layer with highlight: false keeps every label', () => {
    const svg = ggpbi()
      .data(cars as any)
      .aes({ x: 'wt', y: 'mpg', label: 'name' })
      .geom('point', { size: 6 })
      .geom('text', { repel: true, highlight: false })
      .highlight({ filter: d => d.name === 'Valiant' })
      .size(500, 350)
      .renderTo(container);

    const labels = Array.from(svg.querySelectorAll('.ggpbi-geom-clip text')).map(t => t.textContent);
    expect(labels.sort()).toEqual(['Chrysler Imperial', 'Datsun 710', 'Mazda RX4', 'Valiant']);
  });

  it('a mark layer with highlight: false keeps its full colours', () => {
    const grouped = ['a', 'b'].flatMap(g =>
      [1, 2, 3].map(x => ({ x, y: x * (g === 'a' ? 1 : 2), g }))
    );
    const svg = ggpbi()
      .data(grouped as any)
      .aes({ x: 'x', y: 'y', color: 'g' })
      .geom('line')
      .geom('point', { size: 6, highlight: false })
      .highlight({ filter: d => d.g === 'a' })
      .size(500, 350)
      .renderTo(container);

    // Lines: one grey, one coloured.
    const strokes = Array.from(svg.querySelectorAll('.ggpbi-geom-clip path'))
      .map(p => p.getAttribute('stroke'));
    expect(strokes.filter(c => c === '#BEBEBE').length).toBe(1);
    // Points (exempt): none grey.
    const fills = Array.from(svg.querySelectorAll('.ggpbi-point')).map(p => p.getAttribute('fill'));
    expect(fills.length).toBe(6);
    expect(fills.filter(c => c === '#BEBEBE').length).toBe(0);
    expect(new Set(fills).size).toBe(2);
  });

  it('the Valiant recipe: same field as colour and label, one coloured labelled point', () => {
    // "name" used for BOTH colour grouping and labels — plus highlight.
    const svg = ggpbi()
      .data(cars as any)
      .aes({ x: 'wt', y: 'mpg', color: 'name', label: 'name' })
      .geom('point', { size: 6 })
      .geom('text', { repel: true })
      .highlight({ filter: d => d.name === 'Valiant' })
      .size(500, 350)
      .renderTo(container);

    const labels = Array.from(svg.querySelectorAll('.ggpbi-geom-clip text')).map(t => t.textContent);
    expect(labels).toEqual(['Valiant']);
    const legend = Array.from(svg.querySelectorAll('.ggpbi-legend-entry')).map(e => e.getAttribute('data-label'));
    expect(legend).toEqual(['Valiant']);
    const fills = Array.from(svg.querySelectorAll('.ggpbi-point')).map(p => p.getAttribute('fill'));
    expect(fills.filter(c => c === '#BEBEBE').length).toBe(3);
  });
});
