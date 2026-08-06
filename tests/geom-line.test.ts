import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ggpbi } from '../src/index';
import { linetypeToDasharray } from '../src/geoms/util';

// --- Test data ---

const timeData = [
  { t: 'Jan', v: 100 },
  { t: 'Feb', v: 200 },
  { t: 'Mar', v: 150 },
  { t: 'Apr', v: 250 },
];

const numericData = [
  { x: 1, y: 10 },
  { x: 2, y: 20 },
  { x: 3, y: 15 },
  { x: 4, y: 25 },
  { x: 5, y: 30 },
];

const groupedData = [
  { t: 'Jan', v: 100, grp: 'A' },
  { t: 'Feb', v: 200, grp: 'A' },
  { t: 'Mar', v: 150, grp: 'A' },
  { t: 'Jan', v: 80, grp: 'B' },
  { t: 'Feb', v: 120, grp: 'B' },
  { t: 'Mar', v: 160, grp: 'B' },
];

const dataWithNA = [
  { x: 1, y: 10 },
  { x: 2, y: null },
  { x: 3, y: 15 },
  { x: 4, y: 25 },
];

const dataWithMidNA = [
  { x: 1, y: 10 },
  { x: 2, y: 20 },
  { x: 3, y: null },
  { x: 4, y: 30 },
  { x: 5, y: 40 },
];

// --- Helpers ---

function getLines(container: HTMLElement) {
  return container.querySelectorAll('.ggpbi-line');
}

function getLineAttr(container: HTMLElement, index: number, attr: string) {
  const lines = getLines(container);
  return lines[index]?.getAttribute(attr);
}

// --- Tests ---

describe('linetypeToDasharray (all 6 types)', () => {
  it('returns null for solid', () => {
    expect(linetypeToDasharray('solid')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(linetypeToDasharray(undefined)).toBeNull();
  });

  it('returns dasharray for dashed', () => {
    expect(linetypeToDasharray('dashed')).toBe('6 4');
  });

  it('returns dasharray for dotted', () => {
    expect(linetypeToDasharray('dotted')).toBe('2 3');
  });

  it('returns dasharray for dashdot', () => {
    expect(linetypeToDasharray('dashdot')).toBe('6 3 2 3');
  });

  it('returns dasharray for longdash', () => {
    expect(linetypeToDasharray('longdash')).toBe('10 4');
  });

  it('returns dasharray for twodash', () => {
    expect(linetypeToDasharray('twodash')).toBe('2 2 8 2');
  });
});

describe('geom_line: basic rendering', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders a single line path', () => {
    ggpbi()
      .data(timeData)
      .aes({ x: 't', y: 'v' })
      .geom('line')
      .renderTo(container);

    const lines = getLines(container);
    expect(lines.length).toBe(1);
    expect(lines[0].tagName.toLowerCase()).toBe('path');
  });

  it('line has fill=none and stroke', () => {
    ggpbi()
      .data(timeData)
      .aes({ x: 't', y: 'v' })
      .geom('line')
      .renderTo(container);

    expect(getLineAttr(container, 0, 'fill')).toBe('none');
    expect(getLineAttr(container, 0, 'stroke')).toBeTruthy();
  });

  it('applies default color (#4682B4)', () => {
    ggpbi()
      .data(timeData)
      .aes({ x: 't', y: 'v' })
      .geom('line')
      .renderTo(container);

    expect(getLineAttr(container, 0, 'stroke')).toBe('#4682B4');
  });

  it('applies custom color', () => {
    ggpbi()
      .data(timeData)
      .aes({ x: 't', y: 'v' })
      .geom('line', { color: '#FF0000' })
      .renderTo(container);

    expect(getLineAttr(container, 0, 'stroke')).toBe('#FF0000');
  });

  it('applies custom size (stroke-width)', () => {
    ggpbi()
      .data(timeData)
      .aes({ x: 't', y: 'v' })
      .geom('line', { size: 5 })
      .renderTo(container);

    expect(getLineAttr(container, 0, 'stroke-width')).toBe('5');
  });

  it('applies alpha (opacity)', () => {
    ggpbi()
      .data(timeData)
      .aes({ x: 't', y: 'v' })
      .geom('line', { alpha: 0.5 })
      .renderTo(container);

    expect(getLineAttr(container, 0, 'opacity')).toBe('0.5');
  });
});

describe('geom_line: all 6 linetypes', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('solid: no stroke-dasharray', () => {
    ggpbi()
      .data(timeData)
      .aes({ x: 't', y: 'v' })
      .geom('line', { linetype: 'solid' })
      .renderTo(container);

    expect(getLineAttr(container, 0, 'stroke-dasharray')).toBeNull();
  });

  it('dashed: stroke-dasharray set', () => {
    ggpbi()
      .data(timeData)
      .aes({ x: 't', y: 'v' })
      .geom('line', { linetype: 'dashed' })
      .renderTo(container);

    expect(getLineAttr(container, 0, 'stroke-dasharray')).toBe('6 4');
  });

  it('dotted: stroke-dasharray set', () => {
    ggpbi()
      .data(timeData)
      .aes({ x: 't', y: 'v' })
      .geom('line', { linetype: 'dotted' })
      .renderTo(container);

    expect(getLineAttr(container, 0, 'stroke-dasharray')).toBe('2 3');
  });

  it('dashdot: stroke-dasharray set', () => {
    ggpbi()
      .data(timeData)
      .aes({ x: 't', y: 'v' })
      .geom('line', { linetype: 'dashdot' })
      .renderTo(container);

    expect(getLineAttr(container, 0, 'stroke-dasharray')).toBe('6 3 2 3');
  });

  it('longdash: stroke-dasharray set', () => {
    ggpbi()
      .data(timeData)
      .aes({ x: 't', y: 'v' })
      .geom('line', { linetype: 'longdash' })
      .renderTo(container);

    expect(getLineAttr(container, 0, 'stroke-dasharray')).toBe('10 4');
  });

  it('twodash: stroke-dasharray set', () => {
    ggpbi()
      .data(timeData)
      .aes({ x: 't', y: 'v' })
      .geom('line', { linetype: 'twodash' })
      .renderTo(container);

    expect(getLineAttr(container, 0, 'stroke-dasharray')).toBe('2 2 8 2');
  });
});

describe('geom_line: lineend and linejoin', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('default lineend is butt', () => {
    ggpbi()
      .data(numericData)
      .aes({ x: 'x', y: 'y' })
      .geom('line')
      .renderTo(container);

    expect(getLineAttr(container, 0, 'stroke-linecap')).toBe('butt');
  });

  it('lineend round applied', () => {
    ggpbi()
      .data(numericData)
      .aes({ x: 'x', y: 'y' })
      .geom('line', { lineend: 'round' })
      .renderTo(container);

    expect(getLineAttr(container, 0, 'stroke-linecap')).toBe('round');
  });

  it('lineend square applied', () => {
    ggpbi()
      .data(numericData)
      .aes({ x: 'x', y: 'y' })
      .geom('line', { lineend: 'square' })
      .renderTo(container);

    expect(getLineAttr(container, 0, 'stroke-linecap')).toBe('square');
  });

  it('default linejoin is round', () => {
    ggpbi()
      .data(numericData)
      .aes({ x: 'x', y: 'y' })
      .geom('line')
      .renderTo(container);

    expect(getLineAttr(container, 0, 'stroke-linejoin')).toBe('round');
  });

  it('linejoin miter applied', () => {
    ggpbi()
      .data(numericData)
      .aes({ x: 'x', y: 'y' })
      .geom('line', { linejoin: 'miter' })
      .renderTo(container);

    expect(getLineAttr(container, 0, 'stroke-linejoin')).toBe('miter');
    expect(getLineAttr(container, 0, 'stroke-miterlimit')).toBe('10');
  });

  it('linejoin bevel applied', () => {
    ggpbi()
      .data(numericData)
      .aes({ x: 'x', y: 'y' })
      .geom('line', { linejoin: 'bevel' })
      .renderTo(container);

    expect(getLineAttr(container, 0, 'stroke-linejoin')).toBe('bevel');
  });
});

describe('geom_line: colour grouping', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders one line per colour group', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 't', y: 'v', color: 'grp' })
      .geom('line')
      .renderTo(container);

    const lines = getLines(container);
    expect(lines.length).toBe(2);
  });

  it('grouped lines have different stroke colours', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 't', y: 'v', color: 'grp' })
      .geom('line')
      .renderTo(container);

    const lines = getLines(container);
    const stroke0 = lines[0].getAttribute('stroke');
    const stroke1 = lines[1].getAttribute('stroke');
    expect(stroke0).toBeTruthy();
    expect(stroke1).toBeTruthy();
    expect(stroke0).not.toBe(stroke1);
  });
});

describe('geom_line: NA handling', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('NA in middle creates gap (2 segments)', () => {
    ggpbi()
      .data(dataWithMidNA)
      .aes({ x: 'x', y: 'y' })
      .geom('line')
      .renderTo(container);

    const lines = getLines(container);
    // Should be 2 path segments (gap at x=3)
    expect(lines.length).toBe(2);
  });

  it('NA at edge trims single-point segment (needs ≥2 for path)', () => {
    ggpbi()
      .data(dataWithNA)
      .aes({ x: 'x', y: 'y' })
      .geom('line')
      .renderTo(container);

    const lines = getLines(container);
    // x=1 is alone (1 point → no path), x=2→null gap, x=3+x=4 → 1 path
    expect(lines.length).toBe(1);
  });

  it('naRm: true renders a single continuous line', () => {
    ggpbi()
      .data(dataWithMidNA)
      .aes({ x: 'x', y: 'y' })
      .geom('line', { naRm: true })
      .renderTo(container);

    const lines = getLines(container);
    // naRm removes NAs → single continuous line
    expect(lines.length).toBe(1);
  });
});

describe('geom_line: arrow support', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('no arrow by default', () => {
    ggpbi()
      .data(numericData)
      .aes({ x: 'x', y: 'y' })
      .geom('line')
      .renderTo(container);

    const line = getLines(container)[0];
    expect(line.getAttribute('marker-end')).toBeNull();
    expect(line.getAttribute('marker-start')).toBeNull();
  });

  it('arrowShow: true adds marker-end', () => {
    ggpbi()
      .data(numericData)
      .aes({ x: 'x', y: 'y' })
      .geom('line', { arrowShow: true })
      .renderTo(container);

    const line = getLines(container)[0];
    expect(line.getAttribute('marker-end')).toContain('url(#ggpbi-arrow');
  });

  it('arrowEnds: "first" adds marker-start', () => {
    ggpbi()
      .data(numericData)
      .aes({ x: 'x', y: 'y' })
      .geom('line', { arrowShow: true, arrowEnds: 'first' })
      .renderTo(container);

    const line = getLines(container)[0];
    expect(line.getAttribute('marker-start')).toContain('url(#ggpbi-arrow');
    expect(line.getAttribute('marker-end')).toBeNull();
  });

  it('arrowEnds: "both" adds both markers', () => {
    ggpbi()
      .data(numericData)
      .aes({ x: 'x', y: 'y' })
      .geom('line', { arrowShow: true, arrowEnds: 'both' })
      .renderTo(container);

    const line = getLines(container)[0];
    expect(line.getAttribute('marker-end')).toContain('url(#ggpbi-arrow');
    expect(line.getAttribute('marker-start')).toContain('url(#ggpbi-arrow');
  });

  it('arrow creates SVG <defs> with <marker>', () => {
    ggpbi()
      .data(numericData)
      .aes({ x: 'x', y: 'y' })
      .geom('line', { arrowShow: true })
      .renderTo(container);

    const defs = container.querySelector('defs');
    expect(defs).not.toBeNull();
    const marker = defs?.querySelector('marker');
    expect(marker).not.toBeNull();
  });
});

describe('geom_line: sorting by x', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('out-of-order x data produces sorted line', () => {
    const unsorted = [
      { x: 3, y: 30 },
      { x: 1, y: 10 },
      { x: 4, y: 40 },
      { x: 2, y: 20 },
    ];

    ggpbi()
      .data(unsorted)
      .aes({ x: 'x', y: 'y' })
      .geom('line')
      .renderTo(container);

    const lines = getLines(container);
    expect(lines.length).toBe(1);
    // Path should have a valid d attribute (sorted internally)
    const d = lines[0].getAttribute('d');
    expect(d).toBeTruthy();
  });
});

describe('geom_line: multi-layer with points', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('line + point renders both layers', () => {
    ggpbi()
      .data(timeData)
      .aes({ x: 't', y: 'v' })
      .geom('line')
      .geom('point')
      .renderTo(container);

    const lines = getLines(container);
    const points = container.querySelectorAll('.ggpbi-point');
    expect(lines.length).toBe(1);
    expect(points.length).toBe(4);
  });
});
