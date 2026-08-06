/**
 * Tests for textToScene() — pure geometry computation, NO JSDOM needed.
 */
import { describe, it, expect } from 'vitest';
import * as d3 from 'd3';
import { textToScene } from '../src/geoms/text';
import { bindData, type BoundPoint } from '../src/bind-data';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function linearScale(domain: [number, number], range: [number, number]) {
  return d3.scaleLinear().domain(domain).range(range);
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const labelData = [
  { x: 1, y: 10, label: 'Alpha' },
  { x: 2, y: 20, label: 'Beta' },
  { x: 3, y: 15, label: 'Gamma' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('textToScene (pure, no JSDOM)', () => {
  it('produces one TextNode per data point', () => {
    const points = bindData(labelData, { x: 'x', y: 'y', label: 'label' });
    const xScale = linearScale([0, 4], [0, 300]);
    const yScale = linearScale([0, 25], [200, 0]);

    const nodes = textToScene(points, xScale, yScale, { type: 'text' });

    expect(nodes).toHaveLength(3);
    expect(nodes.every(n => n.type === 'text')).toBe(true);
    expect(nodes.every(n => n.class === 'ggpbi-text')).toBe(true);
  });

  it('text content comes from label aesthetic', () => {
    const points = bindData(labelData, { x: 'x', y: 'y', label: 'label' });
    const xScale = linearScale([0, 4], [0, 300]);
    const yScale = linearScale([0, 25], [200, 0]);

    const nodes = textToScene(points, xScale, yScale, { type: 'text' });

    expect(nodes[0].text).toBe('Alpha');
    expect(nodes[1].text).toBe('Beta');
    expect(nodes[2].text).toBe('Gamma');
  });

  it('falls back to y value when no label mapped', () => {
    const data = [{ x: 1, y: 42 }];
    const points = bindData(data, { x: 'x', y: 'y' });
    const xScale = linearScale([0, 2], [0, 200]);
    const yScale = linearScale([0, 50], [200, 0]);

    const nodes = textToScene(points, xScale, yScale, { type: 'text' });

    expect(nodes[0].text).toBe('42');
  });

  it('positions reflect scaled data', () => {
    const data = [{ x: 0, y: 0 }, { x: 4, y: 25 }];
    const points = bindData(data, { x: 'x', y: 'y' });
    const xScale = linearScale([0, 4], [0, 300]);
    const yScale = linearScale([0, 25], [200, 0]);

    const nodes = textToScene(points, xScale, yScale, { type: 'text' });

    expect(nodes[0].x).toBe(0);
    expect(nodes[0].y).toBe(200);
    expect(nodes[1].x).toBe(300);
    expect(nodes[1].y).toBe(0);
  });

  it('centers text on categorical y bands for horizontal strip labels', () => {
    const points = bindData([{ x: 25, y: 'Retail', label: 'A' }], { x: 'x', y: 'y', label: 'label' });
    const xScale = linearScale([0, 100], [0, 200]);
    const yScale = d3.scaleBand().domain(['Retail', 'Health']).range([0, 100]);

    const nodes = textToScene(points, xScale, yScale, { type: 'text' });

    expect(nodes[0].x).toBe(50);
    expect(nodes[0].y).toBe(25);
  });

  it('skips blank explicit labels', () => {
    const points = bindData([
      { x: 1, y: 10, label: 'Alpha' },
      { x: 2, y: 20, label: '' },
      { x: 3, y: 30, label: null },
    ], { x: 'x', y: 'y', label: 'label' });
    const xScale = linearScale([0, 4], [0, 300]);
    const yScale = linearScale([0, 40], [200, 0]);

    const nodes = textToScene(points, xScale, yScale, { type: 'text' });

    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe('Alpha');
  });

  it('applies default styling', () => {
    const points = bindData(labelData, { x: 'x', y: 'y', label: 'label' });
    const xScale = linearScale([0, 4], [0, 300]);
    const yScale = linearScale([0, 25], [200, 0]);

    const nodes = textToScene(points, xScale, yScale, { type: 'text' });

    expect(nodes[0].style.fill).toBe('#333333');
    expect(nodes[0].textAnchor).toBe('middle');
    expect(nodes[0].fontFamily).toBe('sans-serif');
    expect(nodes[0].dy).toBe('0.35em');
  });

  it('applies custom color and font', () => {
    const points = bindData(labelData, { x: 'x', y: 'y', label: 'label' });
    const xScale = linearScale([0, 4], [0, 300]);
    const yScale = linearScale([0, 25], [200, 0]);

    const nodes = textToScene(points, xScale, yScale, {
      type: 'text', color: '#FF0000', fontFamily: 'monospace', size: 16,
    });

    expect(nodes[0].style.fill).toBe('#FF0000');
    expect(nodes[0].fontFamily).toBe('monospace');
    expect(nodes[0].fontSize).toBe(16);
  });

  it('applies rotation transform', () => {
    const data = [{ x: 2, y: 10 }];
    const points = bindData(data, { x: 'x', y: 'y' });
    const xScale = linearScale([0, 4], [0, 300]);
    const yScale = linearScale([0, 25], [200, 0]);

    const nodes = textToScene(points, xScale, yScale, {
      type: 'text', angle: 45,
    });

    expect(nodes[0].transform).toMatch(/^rotate\(45,/);
  });

  it('no transform when angle=0', () => {
    const data = [{ x: 2, y: 10 }];
    const points = bindData(data, { x: 'x', y: 'y' });
    const xScale = linearScale([0, 4], [0, 300]);
    const yScale = linearScale([0, 25], [200, 0]);

    const nodes = textToScene(points, xScale, yScale, { type: 'text' });

    expect(nodes[0].transform).toBeUndefined();
  });

  it('uses colorScale when color aesthetic mapped', () => {
    const data = [
      { x: 1, y: 10, grp: 'A' },
      { x: 2, y: 20, grp: 'B' },
    ];
    const points = bindData(data, { x: 'x', y: 'y', color: 'grp' });
    const xScale = linearScale([0, 3], [0, 300]);
    const yScale = linearScale([0, 25], [200, 0]);
    const colorScale = d3.scaleOrdinal<string>().domain(['A', 'B']).range(['red', 'blue']);

    const nodes = textToScene(points, xScale, yScale, { type: 'text' }, colorScale);

    expect(nodes[0].style.fill).toBe('red');
    expect(nodes[1].style.fill).toBe('blue');
  });

  it('has aria attributes', () => {
    const points = bindData(labelData, { x: 'x', y: 'y', label: 'label' });
    const xScale = linearScale([0, 4], [0, 300]);
    const yScale = linearScale([0, 25], [200, 0]);

    const nodes = textToScene(points, xScale, yScale, { type: 'text' });

    for (const n of nodes) {
      expect(n.aria).toBeDefined();
      expect(n.aria!.role).toBe('listitem');
      expect(n.aria!.tabindex).toBe('0');
    }
  });

  it('returns empty for empty input', () => {
    const nodes = textToScene([], d3.scaleLinear(), d3.scaleLinear(), { type: 'text' });
    expect(nodes).toHaveLength(0);
  });
});

describe('textToScene: inward justification + check_overlap', () => {
  const xs = d3.scaleLinear().domain([0, 10]).range([0, 200]);
  const ys = d3.scaleLinear().domain([0, 10]).range([100, 0]);
  const pt = (x: number, y: number, label: string) => ({ x, y, label, data: {} }) as any;

  it("hjust 'inward': left-half labels anchor start, right-half anchor end", () => {
    const nodes = textToScene(
      [pt(1, 5, 'left'), pt(9, 5, 'right')],
      xs, ys, { type: 'text', hjust: 'inward' }, undefined, 200, 100,
    );
    expect(nodes[0].textAnchor).toBe('start');
    expect(nodes[1].textAnchor).toBe('end');
  });

  it("vjust 'inward': top-half labels go below the point, bottom-half above", () => {
    const nodes = textToScene(
      [pt(5, 9, 'top'), pt(5, 1, 'bottom')],
      xs, ys, { type: 'text', vjust: 'inward' }, undefined, 200, 100,
    );
    expect(nodes[0].dy).toBe('1.1em');   // near panel top → below
    expect(nodes[1].dy).toBe('-0.5em');  // near panel bottom → above
  });

  it('checkOverlap hides later labels that collide; first wins', () => {
    const nodes = textToScene(
      [pt(5, 5, 'first'), pt(5.1, 5, 'second'), pt(1, 1, 'far away')],
      xs, ys, { type: 'text', checkOverlap: true }, undefined, 200, 100,
    );
    expect(nodes.map(n => n.text)).toEqual(['first', 'far away']);
  });

  it('without checkOverlap all labels render', () => {
    const nodes = textToScene(
      [pt(5, 5, 'a'), pt(5.1, 5, 'b')],
      xs, ys, { type: 'text' }, undefined, 200, 100,
    );
    expect(nodes).toHaveLength(2);
  });
});

describe('textToScene: repel (ggrepel-style)', () => {
  const xs = d3.scaleLinear().domain([0, 10]).range([0, 400]);
  const ys = d3.scaleLinear().domain([0, 10]).range([300, 0]);
  const pt = (x: number, y: number, label: string) => ({ x, y, label, data: {} }) as any;

  // A deliberately crowded cluster — raw placement would stack all labels.
  const crowded = [
    pt(5, 5, 'alpha'), pt(5.05, 5.05, 'bravo'), pt(4.95, 5.1, 'charlie'),
    pt(5.1, 4.9, 'delta'), pt(5, 4.95, 'echo'), pt(1, 9, 'far'),
  ];

  const cfg = { type: 'text', repel: true } as const;

  const labelBoxes = (nodes: any[]) =>
    nodes.filter(n => n.type === 'text').map(n => {
      const w = n.text.length * (n.fontSize ?? 12) * 0.6 + 4;
      const h = (n.fontSize ?? 12) * 1.3;
      return { x0: n.x - w / 2, x1: n.x + w / 2, y0: n.y - h / 2, y1: n.y + h / 2, text: n.text };
    });

  it('separates crowded labels — no two label boxes overlap', () => {
    const boxes = labelBoxes(textToScene(crowded, xs, ys, cfg as any, undefined, 400, 300));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const overlaps = a.x0 < b.x1 - 1 && a.x1 > b.x0 + 1 && a.y0 < b.y1 - 1 && a.y1 > b.y0 + 1;
        expect(overlaps, `"${a.text}" overlaps "${b.text}"`).toBe(false);
      }
    }
  });

  it('keeps every label inside the panel', () => {
    for (const b of labelBoxes(textToScene(crowded, xs, ys, cfg as any, undefined, 400, 300))) {
      expect(b.x0).toBeGreaterThanOrEqual(-1);
      expect(b.x1).toBeLessThanOrEqual(401);
      expect(b.y0).toBeGreaterThanOrEqual(-1);
      expect(b.y1).toBeLessThanOrEqual(301);
    }
  });

  it('draws connector segments for labels pushed away from their point', () => {
    const nodes = textToScene(crowded, xs, ys, cfg as any, undefined, 400, 300);
    const segments = nodes.filter(n => n.type === 'line' && n.class === 'ggpbi-text-segment');
    expect(segments.length).toBeGreaterThan(0);
  });

  it('is deterministic — two runs give identical positions', () => {
    const a = textToScene(crowded, xs, ys, cfg as any, undefined, 400, 300);
    const b = textToScene(crowded, xs, ys, cfg as any, undefined, 400, 300);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('a lone label stays near its point without a connector', () => {
    const nodes = textToScene([pt(5, 5, 'solo')], xs, ys, cfg as any, undefined, 400, 300);
    expect(nodes.filter(n => n.type === 'line')).toHaveLength(0);
    const t = nodes.find(n => n.type === 'text') as any;
    expect(Math.abs(t.x - xs(5))).toBeLessThan(10);
  });
});

describe('textToScene: repel overflow (too many labels)', () => {
  const xs = d3.scaleLinear().domain([0, 10]).range([0, 200]);
  const ys = d3.scaleLinear().domain([0, 10]).range([150, 0]);
  const pt = (x: number, y: number, label: string) => ({ x, y, label, data: {} }) as any;

  it('drops labels that find no free spot instead of overlapping (ggrepel max.overlaps)', () => {
    // 40 long labels crammed into a tiny 200×150 panel — impossible to fit all.
    const crammed = Array.from({ length: 40 }, (_, i) =>
      pt(4 + (i % 5) * 0.1, 4 + Math.floor(i / 5) * 0.1, `label number ${i}`));
    const nodes = textToScene(crammed, xs, ys, { type: 'text', repel: true } as any, undefined, 200, 150);
    const texts = nodes.filter(n => n.type === 'text') as any[];
    expect(texts.length).toBeLessThan(40);      // some dropped
    expect(texts.length).toBeGreaterThan(0);    // but not all
    // The survivors must not overlap.
    const boxes = texts.map(n => {
      const w = n.text.length * (n.fontSize ?? 12) * 0.62 + 6;
      const h = (n.fontSize ?? 12) * 1.3;
      return { x0: n.x - w / 2, x1: n.x + w / 2, y0: n.y - h / 2, y1: n.y + h / 2 };
    });
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        expect(a.x0 < b.x1 - 1 && a.x1 > b.x0 + 1 && a.y0 < b.y1 - 1 && a.y1 > b.y0 + 1).toBe(false);
      }
    }
  });

  it('above the label cap it degrades to first-wins hiding, never raw stacking', () => {
    const many = Array.from({ length: 300 }, (_, i) =>
      pt((i % 20) * 0.5, Math.floor(i / 20) * 0.6, `L${i}`));
    const nodes = textToScene(many, xs, ys, { type: 'text', repel: true } as any, undefined, 200, 150);
    const texts = nodes.filter(n => n.type === 'text') as any[];
    expect(texts.length).toBeLessThan(300);
    expect(texts.length).toBeGreaterThan(0);
  });
});
