/**
 * The ggplot2 dialect — specToR writes it, parseR reads it back.
 *
 * The same honesty contract as the ggpbi dialect: the fixed point.
 * Generating R code from a spec, parsing it and applying it over that
 * same spec must change nothing. On top of that, parseR accepts the
 * spellings people actually paste from ggplot2 scripts — positional
 * aes(), geom_bar(stat = "identity"), numeric shapes, theme_minimal().
 */
import { describe, it, expect } from 'vitest';
import { specToR, highlightR } from '../src/r-codegen';
import { parseR } from '../src/r-parse';
import { applyCodeEdit, FUNC } from '../src/code-parse';
import { themeMinimal } from '../src/theme';
import { ggpbi } from '../src/index';
import type { PlotSpec, DataPoint } from '../src/types';

const rows: DataPoint[] = [
  { month: 'Jan', sales: 10, region: 'North', weight: 2.5 },
  { month: 'Feb', sales: 20, region: 'South', weight: 3.1 },
];

const SPECS: Record<string, PlotSpec> = {
  scatter: ggpbi().data(rows).aes({ x: 'weight', y: 'sales' }).geom('point').spec(),
  colored: ggpbi().data(rows).aes({ x: 'weight', y: 'sales', color: 'region' })
    .geom('point', { alpha: 0.6, size: 3 }).spec(),
  bars: ggpbi().data(rows).aes({ x: 'month', y: 'sales' }).geom('col', { position: 'stack' }).spec(),
  twoLayers: ggpbi().data(rows).aes({ x: 'month', y: 'sales' })
    .geom('col').geom('smooth', { method: 'lm', se: false }).spec(),
  scaled: ggpbi().data(rows).aes({ x: 'weight', y: 'sales' }).geom('point')
    .scale({ y: { type: 'log' }, x: { min: 0, max: 10 } }).spec(),
  faceted: ggpbi().data(rows).aes({ x: 'month', y: 'sales' }).geom('col')
    .facet({ wrap: 'region', ncol: 2, freeY: true }).spec(),
  themed: ggpbi().data(rows).aes({ x: 'month', y: 'sales' }).geom('col')
    .theme({ panelFill: '#f0f0f0', baseSize: 13 }).spec(),
  subtitled: ggpbi().data(rows).aes({ x: 'month', y: 'sales' }).geom('col')
    .subtitle('Sales by month').spec(),
};

describe('specToR', () => {
  it('writes real ggplot2 for the plain cases', () => {
    const code = specToR(SPECS.colored);
    expect(code).toContain('ggplot(data, aes(x = weight, y = sales, colour = region))');
    expect(code).toContain('geom_point(alpha = 0.6, size = 3)');
  });

  it('spells log scales and limits the ggplot2 way', () => {
    const code = specToR(SPECS.scaled);
    expect(code).toContain('scale_y_log10()');
    expect(code).toContain('scale_x_continuous(limits = c(0, 10))');
  });

  it('facets with a formula', () => {
    expect(specToR(SPECS.faceted)).toContain('facet_wrap(~ region, ncol = 2, scales = "free_y")');
  });

  it('spells the palette out in full — colours are never hidden', () => {
    const palette = Array.from({ length: 10 }, (_, i) => `#0000${i.toString(16).padStart(2, '0')}`);
    const spec = ggpbi().data(rows).aes({ x: 'month', y: 'sales' }).geom('col')
      .theme({ colorPalette: palette }).spec();
    const code = specToR(spec);
    expect(code).toContain('colorPalette = c("#000000"');
    expect(code).toContain('"#000009"'); // the last of all ten
    expect(code).not.toContain('# 10 values');

    // And it round-trips.
    const parsed = parseR(code);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const merged = applyCodeEdit(spec, parsed.patch);
    expect(merged.theme?.colorPalette).toEqual(palette);
  });

  it('backticks field names R would reject', () => {
    const spec = ggpbi().data(rows).aes({ x: 'Weight (t)', y: 'sales' }).geom('point').spec();
    expect(specToR(spec)).toContain('x = `Weight (t)`');
  });
});

describe('the fixed point: generate → parse → apply → generate', () => {
  for (const [name, spec] of Object.entries(SPECS)) {
    it(`is stable for ${name}`, () => {
      const code1 = specToR(spec);
      const parsed = parseR(code1);
      expect(parsed.ok, !parsed.ok ? `${parsed.error} (line ${parsed.line})` : '').toBe(true);
      if (!parsed.ok) return;
      const merged = applyCodeEdit(spec, parsed.patch);
      expect(specToR(merged)).toBe(code1);
    });
  }
});

describe('parseR reads what people paste', () => {
  const parse = (code: string) => {
    const parsed = parseR(code);
    expect(parsed.ok, !parsed.ok ? `${parsed.error} (line ${parsed.line})` : '').toBe(true);
    if (!parsed.ok) throw new Error('unreachable');
    return parsed.patch;
  };

  it('positional aes, the classic ggplot2 opener', () => {
    const patch = parse('ggplot(mtcars, aes(wt, mpg)) + geom_point()');
    expect(patch.aes).toEqual({ x: 'wt', y: 'mpg' });
    expect(patch.layers).toEqual([{ type: 'point', opts: {} }]);
  });

  it('geom_bar(stat = "identity") is geom_col by another name', () => {
    const patch = parse('ggplot(df, aes(x = month, y = sales)) + geom_bar(stat = "identity")');
    expect(patch.layers[0].type).toBe('col');
  });

  it('numeric shapes and linetypes translate to names', () => {
    const patch = parse('ggplot(df, aes(wt, mpg)) + geom_point(shape = 17) + geom_line(linetype = 2)');
    expect(patch.layers[0].opts.shape).toBe('triangle');
    expect(patch.layers[1].opts.linetype).toBe('dashed');
  });

  it('theme_minimal() becomes the minimal preset values', () => {
    const patch = parse('ggplot(df, aes(wt, mpg)) + geom_point() + theme_minimal()');
    expect(patch.theme).toEqual({ ...themeMinimal() });
  });

  it('facet_grid with both sides of the formula', () => {
    const patch = parse('ggplot(df, aes(wt, mpg)) + geom_point() + facet_grid(region ~ month)');
    expect(patch.facet).toEqual({ row: 'region', col: 'month' });
  });

  it('gghighlight without arguments keeps the live filter', () => {
    const patch = parse('ggplot(df, aes(wt, mpg)) + geom_point() + gghighlight()');
    expect(patch.highlight).toBe(FUNC);
  });

  it('multi-line code with comments and both quote styles', () => {
    const patch = parse([
      'ggplot(df, aes(x = wt, y = mpg)) +',
      '  # points, generously sized',
      "  geom_point(size = 4, colour = 'steelblue') +",
      '  scale_y_continuous(labels = "compact")',
    ].join('\n'));
    expect(patch.layers[0].opts).toEqual({ size: 4, color: 'steelblue' });
    expect(patch.scales?.y).toEqual({ labels: 'compact' });
  });
});

describe('parseR fails loudly, with a line number', () => {
  it('on constructs outside the dialect', () => {
    const parsed = parseR('ggplot(df, aes(wt, mpg)) +\n  stat_summary(fun = mean)');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toContain('stat_summary');
      expect(parsed.line).toBe(2);
    }
  });

  it('on labs() beyond the subtitle', () => {
    const parsed = parseR('ggplot(df, aes(wt, mpg)) + geom_point() + labs(title = "No")');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain('labs(title');
  });

  it('on per-layer aes', () => {
    const parsed = parseR('ggplot(df, aes(wt)) + geom_point(aes(y = mpg))');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain('aes');
  });
});

describe('highlightR', () => {
  it('colours calls, strings, keywords and named arguments', () => {
    const kinds = new Map(
      highlightR('ggplot(data, aes(x = wt)) + geom_point(se = FALSE, size = 3) # hi')
        .map(t => [t.text, t.kind]),
    );
    expect(kinds.get('ggplot')).toBe('call');
    expect(kinds.get('FALSE')).toBe('keyword');
    expect(kinds.get('size')).toBe('property');
    expect(kinds.get('3')).toBe('number');
  });
});
