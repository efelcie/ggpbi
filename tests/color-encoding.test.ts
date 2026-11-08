/**
 * Colours reach ggpbi in several shapes, and every one must be applied.
 *
 * In a report file (PBIR visual.json) Power BI expects a colour as an
 * expression — `{ solid: { color: { expr: { Literal: { Value: "'#hex'" } } } } }`,
 * which is what Desktop writes. The host resolves that to
 * `{ solid: { color: "#hex" } }` before the visual sees it. The plain
 * `{ solid: { color: "#hex" } }` in visual.json is the theme-file form
 * (visualStyles) and the persistProperties form; in visual.json the
 * service drops it — ggpbi 0.5 drew every layer in the default blue.
 *
 * The visual side therefore accepts whatever arrives: resolved strings,
 * unresolved expressions, bare literals, and the formatting model's
 * `{ value }` wrapper.
 */
import { describe, it, expect } from 'vitest';
import { resolveColor } from '../src/powerbi';
import { renderVisual } from './helpers/pbi-host';

const lit = (v: string) => ({ expr: { Literal: { Value: v } } });

describe('resolveColor', () => {
  it.each([
    ['plain hex', '#416B84'],
    ['quoted literal string', "'#416B84'"],
    ['solid with hex', { solid: { color: '#416B84' } }],
    ['solid with expression (PBIR form)', { solid: { color: lit("'#416B84'") } }],
    ['bare expression', lit("'#416B84'")],
    ['formatting-model value', { value: '#416B84' }],
    ['formatting-model value with expression', { value: lit("'#416B84'") }],
  ])('%s', (_label, raw) => {
    expect(resolveColor(raw)).toBe('#416B84');
  });

  it('treats empty and unknown values as unset', () => {
    expect(resolveColor('')).toBeUndefined();
    expect(resolveColor({ value: '' })).toBeUndefined();
    expect(resolveColor(undefined)).toBeUndefined();
    expect(resolveColor({ solid: {} })).toBeUndefined();
    expect(resolveColor(42)).toBeUndefined();
  });

  it('resolves theme colours against a palette', () => {
    const palette = ['#111111', '#222222'];
    expect(resolveColor({ solid: { color: { ThemeDataColor: { ColorId: 1, Percent: 0 } } } }, palette))
      .toBe('#222222');
  });
});

describe('layer colours in the Power BI visual', () => {
  const draw = (fill: unknown, ink?: unknown) => {
    const { container } = renderVisual({
      categories: [{ name: 'Month', role: 'x', values: ['Jan', 'Feb', 'Mar'] }],
      measures: [{ name: 'Sales', values: [1, 3, 2] }],
      objects: {
        layer1: { enabled: true, type: 'bar', fill },
        ...(ink ? { theme: { ink } } : {}),
      },
    });
    const svg = container.querySelector('svg');
    expect(svg, container.textContent ?? '').not.toBeNull();
    return svg!;
  };
  const barFills = (svg: SVGSVGElement) =>
    [...new Set(Array.from(svg.querySelectorAll('.ggpbi-bar')).map(b => b.getAttribute('fill')))];

  it.each([
    ['resolved by the host', { solid: { color: '#C8C6C4' } }],
    ['expression inside solid', { solid: { color: lit("'#C8C6C4'") } }],
    ['bare literal expression', lit("'#C8C6C4'")],
    ['plain string', '#C8C6C4'],
  ])('applies a layer fill %s', (_label, fill) => {
    expect(barFills(draw(fill))).toEqual(['#C8C6C4']);
  });

  it('applies a theme colour given as a bare expression', () => {
    const svg = draw({ solid: { color: '#C8C6C4' } }, lit("'#605E5C'"));
    const label = svg.querySelector('.ggpbi-axis-label-x');
    expect(label?.getAttribute('fill')).toBe('#605E5C');
  });
});
