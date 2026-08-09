/**
 * The editor's parser and merge — the inverse of codegen, without eval.
 *
 * The property that keeps the editor honest is the fixed point: generating
 * code from a spec, parsing it back and applying it over that same spec
 * must change nothing — `specToCode(apply(spec, parse(specToCode(spec))))`
 * equals `specToCode(spec)`. Everything the code cannot express (functions,
 * elided palettes, layer-local aes) must survive an untouched round-trip.
 */
import { describe, it, expect } from 'vitest';
import { specToCode } from '../src/codegen';
import { parseCode, applyCodeEdit, ELIDED, FUNC } from '../src/code-parse';
import { ggpbi } from '../src/index';
import type { PlotSpec, DataPoint } from '../src/types';

const rows: DataPoint[] = [
  { month: 'Jan', sales: 10, region: 'North', weight: 2.5 },
  { month: 'Feb', sales: 20, region: 'South', weight: 3.1 },
  { month: 'Mar', sales: 15, region: 'North', weight: 2.9 },
];

/** The battery: one spec per codegen branch worth exercising. */
const SPECS: Record<string, PlotSpec> = {
  scatter: ggpbi().data(rows).aes({ x: 'weight', y: 'sales' }).geom('point').spec(),
  sized: ggpbi().data(rows).aes({ x: 'weight', y: 'sales', size: 'sales' })
    .geom('point', { alpha: 0.6 }).spec(),
  bars: ggpbi().data(rows).aes({ x: 'month', y: 'sales', color: 'region' })
    .geom('col', { position: 'stack' }).spec(),
  twoLayers: ggpbi().data(rows).aes({ x: 'month', y: 'sales' })
    .geom('col').geom('line', { size: 2, linetype: 'dashed' }).spec(),
  scaled: ggpbi().data(rows).aes({ x: 'weight', y: 'sales' }).geom('point')
    .scale({ x: { type: 'log' }, y: { min: 0, max: 100 } }).spec(),
  faceted: ggpbi().data(rows).aes({ x: 'month', y: 'sales' }).geom('col')
    .facet({ wrap: 'region', ncol: 2 }).spec(),
  themed: ggpbi().data(rows).aes({ x: 'month', y: 'sales' }).geom('col')
    .theme({ panelFill: '#f0f0f0', baseSize: 13 }).spec(),
  subtitled: ggpbi().data(rows).aes({ x: 'month', y: 'sales' }).geom('col')
    .subtitle('Sales by month').spec(),
  noLayer: ggpbi().data(rows).aes({ x: 'month', y: 'sales' }).spec(),
  dated: ggpbi().data(rows).aes({ x: 'month', y: 'sales' }).geom('line')
    .scale({ x: { type: 'time', min: new Date('2024-01-01') } }).spec(),
};

describe('parseCode', () => {
  it('parses every generated code sample in the battery', () => {
    for (const [name, spec] of Object.entries(SPECS)) {
      const code = specToCode(spec);
      const parsed = parseCode(code);
      expect(parsed.ok, `${name}: ${!parsed.ok ? parsed.error : ''}`).toBe(true);
    }
  });

  it('reports errors with a line number', () => {
    const bad = "ggpbi()\n  .aes({ x: 'a' })\n  .geom('point', { size: })\n  .renderTo(element);";
    const parsed = parseCode(bad);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.line).toBe(3);
      expect(parsed.error).toMatch(/unexpected/);
    }
  });

  it('rejects an unknown method by name', () => {
    const parsed = parseCode("ggpbi().geoom('point').renderTo(element);");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain('.geoom');
  });

  it('rejects code that does not start with ggpbi()', () => {
    const parsed = parseCode("chart().geom('point')");
    expect(parsed.ok).toBe(false);
  });

  it('reads the elided-array marker as a sentinel', () => {
    const parsed = parseCode("ggpbi()\n  .theme({ colorPalette: [/* 32 values */] })\n  .renderTo(element);");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect((parsed.patch.theme as Record<string, unknown>).colorPalette).toBe(ELIDED);
    }
  });

  it('reads a function placeholder as a sentinel without evaluating it', () => {
    const parsed = parseCode('ggpbi()\n  .highlight({ filter: d => /* … */ })\n  .renderTo(element);');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.patch.highlight).toBe(FUNC);
  });

  it('skips a real arrow-function body instead of running it', () => {
    const parsed = parseCode("ggpbi()\n  .highlight({ filter: d => f(d.x, 2) > 3 && d.y !== 'no' })\n  .renderTo(element);");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.patch.highlight).toBe(FUNC);
  });

  it('parses dates, negatives, booleans and nested objects', () => {
    const parsed = parseCode(
      "ggpbi().scale({ x: { type: 'time', min: new Date('2024-06-01'), flip: true, pad: -0.5 } }).renderTo(element);",
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const x = (parsed.patch.scales as Record<string, Record<string, unknown>>).x;
      expect(x.min).toBeInstanceOf(Date);
      expect(x.flip).toBe(true);
      expect(x.pad).toBe(-0.5);
    }
  });
});

describe('the fixed point: generate → parse → apply → generate', () => {
  for (const [name, spec] of Object.entries(SPECS)) {
    it(`is stable for ${name}`, () => {
      const code1 = specToCode(spec);
      const parsed = parseCode(code1);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      const merged = applyCodeEdit(spec, parsed.patch);
      expect(specToCode(merged)).toBe(code1);
    });
  }

  it('keeps a live highlight filter through the placeholder', () => {
    const filter = (d: DataPoint) => d.region === 'North';
    const spec: PlotSpec = {
      ...SPECS.bars,
      highlight: { filter, color: '#cccccc' },
    };
    const parsed = parseCode(specToCode(spec));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const merged = applyCodeEdit(spec, parsed.patch);
    expect(merged.highlight?.filter).toBe(filter);
    expect(merged.highlight?.color).toBe('#cccccc');
  });

  it('round-trips a long palette spelled out in full', () => {
    const palette = Array.from({ length: 12 }, (_, i) => `#0000${i.toString(16).padStart(2, '0')}`);
    const spec: PlotSpec = { ...SPECS.bars, theme: { colorPalette: palette } };
    const code = specToCode(spec);
    expect(code).toContain("'#00000b'"); // the last one — nothing summarised
    const parsed = parseCode(code);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const merged = applyCodeEdit(spec, parsed.patch);
    expect(merged.theme?.colorPalette).toEqual(palette);
  });

  it('an edited palette is ignored — the report theme owns it', () => {
    // The palette line is greyed in the editor, and the grey means it:
    // whatever the text says, the live chart keeps the host palette.
    const palette = ['#111111', '#222222'];
    const spec: PlotSpec = { ...SPECS.bars, theme: { colorPalette: palette, baseSize: 13 } };
    const code = specToCode(spec)
      .replace("'#111111'", "'#ff0000'")
      .replace('baseSize: 13', 'baseSize: 15');
    const parsed = parseCode(code);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const merged = applyCodeEdit(spec, parsed.patch);
    expect(merged.theme?.colorPalette).toEqual(palette); // host wins
    expect(merged.theme?.baseSize).toBe(15); // the editable neighbour applies
  });

  it('host-owned theme lines stand alone, ready for line-wise greying', () => {
    const spec: PlotSpec = {
      ...SPECS.bars,
      theme: { colorPalette: ['#111111', '#222222'], panelFill: '#eeeeee' },
    };
    const lines = specToCode(spec).split('\n');
    const paletteLine = lines.find(l => l.includes('colorPalette'))!;
    expect(paletteLine.trim().startsWith('colorPalette:')).toBe(true);
    expect(paletteLine).not.toContain('panelFill'); // editable stays separate
  });

  it('still resolves a hand-written elision marker from the live spec', () => {
    // The generator no longer writes `[/* n values */]`, but a reader may:
    // it stays a way to say "whatever the chart already has".
    const palette = ['#111111', '#222222'];
    const spec: PlotSpec = { ...SPECS.bars, theme: { colorPalette: palette } };
    const parsed = parseCode("ggpbi()\n  .theme({ colorPalette: [/* 2 values */] })\n  .renderTo(element);");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const merged = applyCodeEdit(spec, parsed.patch);
    expect(merged.theme?.colorPalette).toEqual(palette);
  });

  it('keeps layer-local aes and stat when the geom type is unchanged', () => {
    const spec: PlotSpec = {
      ...SPECS.scatter,
      layers: [{ geom: { type: 'point' }, stat: 'identity', aes: { color: 'region' } }],
    };
    const parsed = parseCode(specToCode(spec));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const merged = applyCodeEdit(spec, parsed.patch);
    expect(merged.layers[0].aes).toEqual({ color: 'region' });
    expect(merged.layers[0].stat).toBe('identity');
  });

  it('drops layer-local aes and stat when the geom type changes', () => {
    const spec: PlotSpec = {
      ...SPECS.scatter,
      layers: [{ geom: { type: 'point' }, stat: 'identity', aes: { color: 'region' } }],
    };
    const code = specToCode(spec).replace(".geom('point')", ".geom('line')");
    const parsed = parseCode(code);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const merged = applyCodeEdit(spec, parsed.patch);
    expect(merged.layers[0].geom.type).toBe('line');
    expect(merged.layers[0].aes).toBeUndefined();
    expect(merged.layers[0].stat).toBeUndefined();
  });

  it("keeps 'auto' subtitles that the code never shows", () => {
    const spec: PlotSpec = { ...SPECS.scatter, subtitle: 'auto' };
    const parsed = parseCode(specToCode(spec));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(applyCodeEdit(spec, parsed.patch).subtitle).toBe('auto');
  });

  it('the locale is host-owned: greyed, and an edit to it is ignored', () => {
    const spec: PlotSpec = { ...SPECS.scatter, format: { locale: 'de-DE', currency: 'EUR' } };
    const code = specToCode(spec).replace("locale: 'de-DE'", "locale: 'en-US'");
    const parsed = parseCode(code);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const merged = applyCodeEdit(spec, parsed.patch);
    expect(merged.format).toEqual({ locale: 'de-DE', currency: 'EUR' }); // report language wins
  });
});

describe('applyCodeEdit — deliberate edits', () => {
  const edit = (spec: PlotSpec, transform: (code: string) => string): PlotSpec => {
    const parsed = parseCode(transform(specToCode(spec)));
    expect(parsed.ok, !parsed.ok ? (parsed as { error: string }).error : '').toBe(true);
    if (!parsed.ok) throw new Error('unreachable');
    return applyCodeEdit(spec, parsed.patch);
  };

  it('changes a geom type', () => {
    const merged = edit(SPECS.scatter, c => c.replace(".geom('point')", ".geom('line')"));
    expect(merged.layers[0].geom.type).toBe('line');
  });

  it('adds a second layer', () => {
    const merged = edit(SPECS.scatter, c =>
      c.replace(".geom('point')", ".geom('point')\n  .geom('smooth', { method: 'lm' })"));
    expect(merged.layers).toHaveLength(2);
    expect(merged.layers[1].geom.type).toBe('smooth');
    expect((merged.layers[1].geom as { method?: string }).method).toBe('lm');
  });

  it('removes a layer', () => {
    const merged = edit(SPECS.twoLayers, c => c.replace(/\n\s*\.geom\('line'[^)]*\)/, ''));
    expect(merged.layers).toHaveLength(1);
    expect(merged.layers[0].geom.type).toBe('col');
  });

  it('adds a scale where there was none', () => {
    const merged = edit(SPECS.scatter, c =>
      c.replace(".geom('line')", ".geom('line')").replace(
        '  .renderTo(element);',
        "  .scale({ y: { type: 'log' } })\n  .renderTo(element);",
      ));
    expect((merged.scales?.y as { type?: string })?.type).toBe('log');
  });

  it('deletes the subtitle by deleting the line', () => {
    const merged = edit(SPECS.subtitled, c => c.replace(/\n\s*\.subtitle\([^)]*\)/, ''));
    expect(merged.subtitle).toBeUndefined();
  });

  it('removes faceting by deleting the call', () => {
    const merged = edit(SPECS.faceted, c => c.replace(/\n\s*\.facet\([^)]*\)/, ''));
    expect(merged.facet).toBeUndefined();
  });

  it('builds a highlight filter from an edited values list', () => {
    const merged = edit(SPECS.bars, c =>
      c.replace('  .renderTo(element);', "  .highlight({ values: ['North'] })\n  .renderTo(element);"));
    expect(merged.highlight).toBeDefined();
    expect(merged.highlight!.filter({ region: 'North', month: 'Jan', sales: 1 })).toBe(true);
    expect(merged.highlight!.filter({ region: 'South', month: 'Feb', sales: 2 })).toBe(false);
  });

  it('maps display names in aes back to internal data fields', () => {
    const spec: PlotSpec = {
      ...SPECS.scatter,
      aes: { x: 'x', y: 'yRaw1' },
      fieldLabels: { x: 'Weight (t)', y: 'Sales' },
    };
    const labels = { x: 'Weight (t)', y: 'Sales' };
    const code = specToCode(spec, labels);
    expect(code).toContain("x: 'Weight (t)'");
    const parsed = parseCode(code);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const merged = applyCodeEdit(spec, parsed.patch, labels);
    expect(merged.aes.x).toBe('x');
    expect(merged.aes.y).toBe('yRaw1');
  });

  it('keeps synthetic fields the code never shows', () => {
    const spec: PlotSpec = {
      ...SPECS.bars,
      aes: { x: 'month', y: '__count' },
    };
    const parsed = parseCode(specToCode(spec));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(applyCodeEdit(spec, parsed.patch).aes.y).toBe('__count');
  });

  it('drops the stale axis title when its field is edited', () => {
    const spec: PlotSpec = { ...SPECS.scatter, xLabel: 'Weight', yLabel: 'Sales' };
    const merged = edit(spec, c => c.replace("x: 'weight'", "x: 'month'"));
    expect(merged.xLabel).toBeUndefined();
    expect(merged.yLabel).toBe('Sales');
  });

  it('leaves data, host services and viewport untouched', () => {
    const tooltipService = { show: () => undefined };
    const spec: PlotSpec = {
      ...SPECS.scatter, tooltipService, width: 800, height: 600,
    };
    const merged = edit(spec, c => c.replace(".geom('point')", ".geom('line')"));
    expect(merged.data).toBe(spec.data);
    expect(merged.tooltipService).toBe(tooltipService);
    expect(merged.width).toBe(800);
    expect(merged.height).toBe(600);
  });
});
