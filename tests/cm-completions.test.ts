/**
 * Autocomplete sources for the chart dialects.
 *
 * The vocabularies are imported from the modules that own them (geom
 * registry, parser, codegen), so these tests double as drift detectors:
 * a new geom appears in the suggestions the moment it exists.
 */
import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import {
  ggpbiCompletions, ggplot2Completions,
  createGgpbiCompletions, createGgplot2Completions,
} from '../src/cm-completions';

const complete = (
  source: typeof ggpbiCompletions,
  doc: string,
): string[] => {
  const state = EditorState.create({ doc });
  const context = new CompletionContext(state, doc.length, false);
  const result = source(context);
  if (!result || result instanceof Promise) return [];
  return result.options.map(o => o.label);
};

describe('ggpbi completions', () => {
  it('suggests chain methods after a dot', () => {
    const labels = complete(ggpbiCompletions, 'ggpbi()\n  .ge');
    expect(labels).toContain('geom');
    expect(labels).toContain('theme');
  });

  it('suggests geom types inside .geom(quote', () => {
    const labels = complete(ggpbiCompletions, "ggpbi()\n  .geom('poi");
    expect(labels).toContain('point');
    expect(labels).toContain('boxplot');
    expect(labels).not.toContain('geom'); // not the method list
  });

  it('suggests aesthetics inside .aes({', () => {
    const labels = complete(ggpbiCompletions, "ggpbi()\n  .aes({ x: 'wt', co");
    expect(labels).toContain('color');
    expect(labels).toContain('yend');
  });

  it('suggests geom options inside the config object', () => {
    const labels = complete(ggpbiCompletions, "ggpbi()\n  .geom('point', { al");
    expect(labels).toContain('alpha');
    expect(labels).toContain('position');
  });

  it('stays quiet where nothing fits', () => {
    expect(complete(ggpbiCompletions, "ggpbi()\n  .subtitle('Hel")).toEqual([]);
  });

  it('suggests the bound well fields as aes values — only what exists', () => {
    const source = createGgpbiCompletions(['Weight (t)', 'mpg', 'cyl']);
    const labels = complete(source, "ggpbi()\n  .aes({ x: '");
    expect(labels).toEqual(['Weight (t)', 'mpg', 'cyl']);
    // Without fields, the value position stays quiet.
    expect(complete(ggpbiCompletions, "ggpbi()\n  .aes({ x: '")).toEqual([]);
  });

  it('suggests theme keys and preset names', () => {
    expect(complete(ggpbiCompletions, 'ggpbi()\n  .theme({ pan')).toContain('panelFill');
    expect(complete(ggpbiCompletions, "ggpbi()\n  .theme({ preset: 'd")).toContain('dark');
  });
});

describe('ggplot2 completions', () => {
  it('suggests functions after a plus', () => {
    const labels = complete(ggplot2Completions, 'ggplot(data, aes(wt, mpg)) +\n  geom_p');
    expect(labels).toContain('geom_point');
    expect(labels).toContain('facet_wrap');
  });

  it('suggests aesthetics inside aes()', () => {
    const labels = complete(ggplot2Completions, 'ggplot(data, aes(x = wt, co');
    expect(labels).toContain('colour');
  });

  it('suggests named arguments inside a call', () => {
    const labels = complete(ggplot2Completions, 'ggplot(d, aes(x)) + geom_smooth(met');
    expect(labels).toContain('method');
    expect(labels).toContain('se');
  });

  it('suggests well fields after = in aes() and after a formula tilde', () => {
    const source = createGgplot2Completions(['wt', 'Weight (t)']);
    expect(complete(source, 'ggplot(data, aes(x = ')).toEqual(['wt', 'Weight (t)']);
    expect(complete(source, 'ggplot(data, aes(wt, mpg)) + facet_wrap(~ ')).toEqual(['wt', 'Weight (t)']);
  });
});
