/**
 * The debug view: reading a chart back out as ggpbi code.
 *
 * The Format Pane builds charts by clicking, which leaves nothing to read
 * or copy. This generates the fluent chain that would produce the same
 * chart — so it has to name the fields the user sees, not the internal
 * keys Power BI binds.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { specToCode, highlight } from '../src/codegen';
import { renderCodeView } from '../src/code-view';
import { resolveTheme } from '../src/theme';
import { buildPlot } from '../src/pipeline';
import { ggpbi } from '../src/index';

const data = [
  { wt: 2.6, mpg: 21, cyl: 6, name: 'Mazda RX4' },
  { wt: 3.2, mpg: 22.8, cyl: 4, name: 'Datsun 710' },
  { wt: 3.4, mpg: 18.1, cyl: 6, name: 'Valiant' },
];

const spec = (extra: Record<string, unknown> = {}) => ({
  data,
  aes: { x: 'wt', y: 'mpg' },
  layers: [{ geom: { type: 'point' as const } }],
  width: 800,
  height: 600,
  ...extra,
}) as any;

describe('specToCode', () => {
  it('writes the fluent chain in the order a developer would', () => {
    const code = specToCode(spec());
    expect(code).toContain('ggpbi()');
    expect(code.indexOf('.data(')).toBeLessThan(code.indexOf('.aes('));
    expect(code.indexOf('.aes(')).toBeLessThan(code.indexOf('.geom('));
    expect(code).toMatch(/\.renderTo\(element\);$/);
  });

  it('names the row count so the sample size is visible', () => {
    expect(specToCode(spec())).toMatch(/\/\/ 3 rows/);
  });

  it('emits aesthetics in ggplot2 order', () => {
    const code = specToCode(spec({ aes: { color: 'cyl', y: 'mpg', x: 'wt' } }));
    expect(code).toContain(".aes({ x: 'wt', y: 'mpg', color: 'cyl' })");
  });

  it('uses the field names from the wells, not the internal keys', () => {
    // Power BI binds yRaw1 / x; code naming those would be unrunnable.
    const code = specToCode(
      spec({ aes: { x: 'x', y: 'yRaw1', color: 'series' } }),
      { x: 'Weight', y: 'Miles per gallon', color: 'Cylinders' },
    );
    expect(code).toContain("x: 'Weight'");
    expect(code).toContain("y: 'Miles per gallon'");
    expect(code).not.toContain('yRaw1');
  });

  it('leaves out synthetic fields the pipeline invents', () => {
    const code = specToCode(spec({ aes: { x: '__x_pseudo', y: 'mpg' } }));
    expect(code).not.toContain('__x_pseudo');
    expect(code).toContain("y: 'mpg'");
  });

  it('carries geom options but not their defaults', () => {
    const code = specToCode(spec({
      layers: [{ geom: { type: 'point', size: 5, alpha: 1, position: 'identity', shape: 'circle' } }],
    }));
    expect(code).toContain("geom('point', { size: 5 })");
    expect(code).not.toContain('alpha');
    expect(code).not.toContain('position');
  });

  it('emits one line per layer', () => {
    const code = specToCode(spec({
      layers: [
        { geom: { type: 'point' } },
        { geom: { type: 'smooth', method: 'lm' } },
        { geom: { type: 'text', repel: true } },
      ],
    }));
    expect(code).toContain(".geom('point')");
    expect(code).toContain(".geom('smooth', { method: 'lm' })");
    expect(code).toContain(".geom('text', { repel: true })");
  });

  it('says so when no layer was chosen explicitly', () => {
    expect(specToCode(spec({ layers: [] }))).toMatch(/ggpbi picks one/);
  });

  it('includes scales, facets, theme, locale and size', () => {
    const code = specToCode(spec({
      scales: { x: { type: 'category' }, y: { labels: 'compact' } },
      facet: { wrap: 'cyl', freeX: true },
      theme: { preset: 'dark' },
      format: { locale: 'de-AT' },
    }));
    expect(code).toContain(".scale({ x: { type: 'category' }, y: { labels: 'compact' } })");
    expect(code).toContain(".facet({ wrap: 'cyl', freeX: true })");
    expect(code).toContain(".theme({ preset: 'dark' })");
    expect(code).toContain(".format({ locale: 'de-AT' })");
    expect(code).toContain('.size(800, 600)');
  });

  it('drops an auto scale type, which says nothing', () => {
    expect(specToCode(spec({ scales: { x: { type: 'auto' } } }))).not.toContain('.scale(');
  });

  it('skips functions rather than printing [object Function]', () => {
    const code = specToCode(spec({
      layers: [{ geom: { type: 'point', filter: (d: any) => d.mpg > 20 } }],
    }));
    expect(code).not.toMatch(/function|=>/);
    expect(code).toContain(".geom('point')");
  });

  it('names the Size field, not the internal key', () => {
    // Power BI binds the Size well to the literal field 'size'; without a
    // label the code read `size: 'size'`, which reproduces nothing.
    const code = specToCode(
      spec({ aes: { x: 'wt', y: 'mpg', size: 'size' } }),
      { x: 'wt', y: 'mpg', size: 'Sum of hp' },
    );
    expect(code).toContain("size: 'Sum of hp'");
    expect(code).not.toContain("size: 'size'");
  });

  it('summarises a long array instead of dumping it', () => {
    // Every Power BI chart carries the host palette; 32 hex strings would
    // bury the lines the author actually chose.
    const palette = Array.from({ length: 32 }, (_, i) => `#${String(i).padStart(6, '0')}`);
    const code = specToCode(spec({ theme: { colorPalette: palette } }));
    expect(code).toContain('colorPalette: [/* 32 values */]');
    expect(code).not.toContain('#000031');
  });

  it('still spells out a short array', () => {
    const code = specToCode(spec({ theme: { colorPalette: ['#111111', '#222222'] } }));
    expect(code).toContain("colorPalette: ['#111111', '#222222']");
  });

  it('escapes quotes in field names', () => {
    const code = specToCode(spec({ aes: { x: "O'Brien" } }));
    expect(code).toContain("x: 'O\\'Brien'");
  });
});

describe('highlight', () => {
  it('round-trips: the tokens reassemble the source exactly', () => {
    const code = specToCode(spec({
      layers: [{ geom: { type: 'point', size: 5 } }],
      theme: { preset: 'dark' },
    }));
    expect(highlight(code).map(t => t.text).join('')).toBe(code);
  });

  it('classifies the pieces a reader looks for', () => {
    const tokens = highlight(".geom('point', { size: 5, repel: true })");
    const kindOf = (text: string) => tokens.find(t => t.text === text)?.kind;
    expect(kindOf('.geom')).toBe('call');
    expect(kindOf("'point'")).toBe('string');
    expect(kindOf('5')).toBe('number');
    expect(kindOf('true')).toBe('keyword');
    expect(kindOf('size')).toBe('property');
  });

  it('handles an empty string and a bare identifier without looping', () => {
    expect(highlight('')).toEqual([]);
    expect(highlight('ggpbi()').map(t => t.text).join('')).toBe('ggpbi()');
  });
});

describe('the code in a built plot', () => {
  it('is absent unless asked for', () => {
    expect(buildPlot(spec()).codeText).toBeUndefined();
  });

  it('is generated with showCode', () => {
    expect(buildPlot(spec({ showCode: true })).codeText).toContain('ggpbi()');
  });

  it('shows the pre-stat mapping, not the computed field', () => {
    // A count bar rewrites y to __count; the code must show the mapping
    // the user made, which is what would produce that count.
    const built = buildPlot({
      data: [{ cyl: 4 }, { cyl: 4 }, { cyl: 6 }],
      aes: { x: 'cyl' },
      layers: [{ geom: { type: 'bar' as const } }],
      width: 400, height: 300,
      showCode: true,
    } as any);
    expect(built.codeText).not.toContain('__count');
    expect(built.codeText).toContain("x: 'cyl'");
  });
});

describe('the rendered overlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const container = (): HTMLElement => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientWidth', { value: 800 });
    Object.defineProperty(el, 'clientHeight', { value: 600 });
    document.body.appendChild(el);
    return el;
  };

  it('renders a panel with the code and a copy button', () => {
    const el = container();
    renderCodeView(el, "ggpbi()\n  .geom('point')", resolveTheme({}));
    const panel = el.querySelector('.ggpbi-code-view')!;
    expect(panel).toBeTruthy();
    expect(panel.textContent).toContain(".geom('point')");
    expect(panel.querySelector('button')?.textContent).toBe('Copy');
  });

  it('colours the tokens', () => {
    const el = container();
    renderCodeView(el, ".geom('point')", resolveTheme({}));
    const colours = [...el.querySelectorAll('code span')].map(s => (s as HTMLElement).style.color);
    expect(new Set(colours).size).toBeGreaterThan(1);
  });

  it('picks a dark palette on a dark theme', () => {
    const light = container();
    renderCodeView(light, "x", resolveTheme({}));
    const dark = container();
    renderCodeView(dark, "x", resolveTheme({ paper: '#12151c' }));
    const bg = (el: HTMLElement) =>
      (el.querySelector('.ggpbi-code-view') as HTMLElement).style.backgroundColor;
    expect(bg(light)).not.toBe(bg(dark));
  });

  it('overlays instead of resizing the chart', () => {
    // A debug view must not change what it is describing: same SVG size
    // with the code on and off.
    const sizeOf = (showCode: boolean) => {
      const el = container();
      const svg = ggpbi().data(data).aes({ x: 'wt', y: 'mpg' }).geom('point')
        .showCode(showCode).size(800, 600).renderTo(el);
      return [svg.getAttribute('width'), svg.getAttribute('height'), el.querySelectorAll('circle').length];
    };
    expect(sizeOf(true)).toEqual(sizeOf(false));
  });

  it('appears in a rendered plot only when switched on', () => {
    const on = container();
    ggpbi().data(data).aes({ x: 'wt', y: 'mpg' }).geom('point').showCode()
      .size(800, 600).renderTo(on);
    expect(on.querySelector('.ggpbi-code-view')).toBeTruthy();

    const off = container();
    ggpbi().data(data).aes({ x: 'wt', y: 'mpg' }).geom('point')
      .size(800, 600).renderTo(off);
    expect(off.querySelector('.ggpbi-code-view')).toBeNull();
  });
});
