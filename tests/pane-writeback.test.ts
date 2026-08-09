/**
 * Code edits become Format Pane properties — the editor and the pane are
 * two doors into the same room.
 *
 * computePaneWriteback maps an applied patch to persistProperties
 * instances and flags as `residual` whatever has no pane home (wells,
 * fourth layers, scale limits, free-text subtitles). The vocabulary it
 * writes must match capabilities.json exactly — an unknown enum value
 * persisted into the report would corrupt it silently.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  computePaneWriteback,
  LAYER_TYPES, POSITIONS, LINE_STYLES, SHAPES,
  SCALE_TYPES, LABEL_FORMATS, DATE_FORMATS,
} from '../src/pane-writeback';
import { parseCode, applyCodeEdit } from '../src/code-parse';
import { specToCode } from '../src/codegen';
import type { PlotSpec } from '../src/types';

const capabilities = JSON.parse(
  readFileSync(join(__dirname, '..', 'capabilities.json'), 'utf-8'),
);

const enumValues = (object: string, property: string): string[] =>
  capabilities.objects[object].properties[property].type.enumeration.map(
    (e: { value: string }) => e.value,
  );

const live = (over: Partial<PlotSpec> = {}): PlotSpec => ({
  data: [{ wt: 1, mpg: 2, cyl: 'a' }],
  aes: { x: 'wt', y: 'mpg' },
  layers: [{ geom: { type: 'point' } }],
  ...over,
});

/** Run an edited code text through parse + merge + writeback. */
const writebackOf = (
  code: string,
  base: PlotSpec = live(),
  paneDefaults: Record<string, Record<string, unknown>> = {},
) => {
  const parsed = parseCode(code);
  expect(parsed.ok).toBe(true);
  if (parsed.ok !== true) throw new Error('unreachable');
  const merged = applyCodeEdit(base, parsed.patch);
  return computePaneWriteback(parsed.patch, base, merged, paneDefaults);
};

const propsOf = (
  result: ReturnType<typeof writebackOf>,
  objectName: string,
): Record<string, unknown> | undefined =>
  result.instances.find(i => i.objectName === objectName)?.properties;

describe('the vocabulary stays in sync with capabilities.json', () => {
  it('layer types', () => {
    expect([...LAYER_TYPES].sort()).toEqual(enumValues('layer1', 'type').sort());
  });
  it('positions', () => {
    expect([...POSITIONS].sort()).toEqual(enumValues('layer1', 'position').sort());
  });
  it('line styles', () => {
    expect([...LINE_STYLES].sort()).toEqual(enumValues('layer1', 'lineStyle').sort());
  });
  it('shapes', () => {
    expect([...SHAPES].sort()).toEqual(enumValues('layer1', 'shape').sort());
  });
  it('scale types and formats', () => {
    expect([...SCALE_TYPES].sort()).toEqual(enumValues('scaleX', 'type').sort());
    expect([...LABEL_FORMATS].sort()).toEqual(enumValues('scaleX', 'labelFormat').sort());
    expect([...DATE_FORMATS].sort()).toEqual(enumValues('scaleX', 'dateFormat').sort());
  });
});

describe('what writes back', () => {
  it('a geom change becomes the layer card type', () => {
    const result = writebackOf("ggpbi()\n  .aes({ x: 'wt', y: 'mpg' })\n  .geom('line')\n  .renderTo(element);");
    expect(propsOf(result, 'layer1')).toMatchObject({ enabled: true, type: 'line' });
    expect(result.residual).toBe(false);
  });

  it('col is spelled bar in the pane', () => {
    const result = writebackOf("ggpbi()\n  .aes({ x: 'wt', y: 'mpg' })\n  .geom('col')\n  .renderTo(element);");
    expect(propsOf(result, 'layer1')).toMatchObject({ type: 'bar' });
  });

  it('layer options map onto their slices, colors as fills', () => {
    const result = writebackOf(
      "ggpbi()\n  .aes({ x: 'wt', y: 'mpg' })\n  .geom('point', { alpha: 0.6, size: 3, color: '#ff0000', linetype: 'dashed', position: 'jitter' })\n  .renderTo(element);",
    );
    expect(propsOf(result, 'layer1')).toMatchObject({
      alpha: 0.6, size: 3,
      fill: { solid: { color: '#ff0000' } },
      lineStyle: 'dashed', position: 'jitter',
    });
    expect(result.residual).toBe(false);
  });

  it('a second layer fills the second card; a removed layer switches its card off', () => {
    const twoLayers = writebackOf(
      "ggpbi()\n  .aes({ x: 'wt', y: 'mpg' })\n  .geom('point')\n  .geom('smooth')\n  .renderTo(element);",
    );
    expect(propsOf(twoLayers, 'layer2')).toMatchObject({ enabled: true, type: 'smooth' });

    const removed = writebackOf(
      "ggpbi()\n  .aes({ x: 'wt', y: 'mpg' })\n  .geom('point')\n  .renderTo(element);",
      live({ layers: [{ geom: { type: 'point' } }, { geom: { type: 'smooth' } }] }),
    );
    expect(propsOf(removed, 'layer2')).toEqual({ enabled: false });
  });

  it('scales map type and label formats', () => {
    const result = writebackOf(
      "ggpbi()\n  .aes({ x: 'wt', y: 'mpg' })\n  .geom('point')\n  .scale({ y: { type: 'log', labels: 'compact' } })\n  .renderTo(element);",
    );
    expect(propsOf(result, 'scaleY')).toEqual({ type: 'log', labelFormat: 'compact' });
    expect(result.residual).toBe(false);
  });

  it('facet layout options write back, the field stays a well', () => {
    const base = live({ facet: { wrap: 'cyl' } });
    const result = writebackOf(
      "ggpbi()\n  .aes({ x: 'wt', y: 'mpg' })\n  .geom('point')\n  .facet({ wrap: 'cyl', ncol: 3, freeY: true })\n  .renderTo(element);",
      base,
    );
    expect(propsOf(result, 'facet')).toEqual({ columns: 3, freeY: true });
    expect(result.residual).toBe(false);
  });

  it('theme colors and highlight values find their cards', () => {
    const result = writebackOf(
      "ggpbi()\n  .aes({ x: 'wt', y: 'mpg', color: 'cyl' })\n  .geom('point')\n  .theme({ panelFill: '#eeeeee', baseSize: 13 })\n  .highlight({ values: ['a', 'b'] })\n  .renderTo(element);",
      live({ aes: { x: 'wt', y: 'mpg', color: 'cyl' } }),
    );
    expect(propsOf(result, 'theme')).toMatchObject({
      panelFill: { solid: { color: '#eeeeee' } }, baseSize: 13,
    });
    expect(propsOf(result, 'highlight')).toEqual({ enabled: true, values: 'a, b' });
    expect(result.residual).toBe(false);
  });

  it('deleting the highlight switches the card off', () => {
    const filter = (d: Record<string, unknown>): boolean => d.cyl === 'a';
    const result = writebackOf(
      "ggpbi()\n  .aes({ x: 'wt', y: 'mpg' })\n  .geom('point')\n  .renderTo(element);",
      live({ highlight: { filter } }),
    );
    expect(propsOf(result, 'highlight')).toEqual({ enabled: false });
  });
});

describe('deleted lines write their defaults back — nothing snaps back on close', () => {
  const BARE = "ggpbi()\n  .aes({ x: 'wt', y: 'mpg' })\n  .geom('point')\n  .renderTo(element);";

  it('a deleted theme value reverts to the pane default, colors as fills', () => {
    const result = writebackOf(
      BARE,
      live({ theme: { panelFill: '#333333' } }),
      { theme: { panelFill: '#ebebeb' } },
    );
    expect(propsOf(result, 'theme')).toEqual({ panelFill: { solid: { color: '#ebebeb' } } });
    expect(result.residual).toBe(false);
  });

  it('deleting one theme entry keeps the others untouched', () => {
    const result = writebackOf(
      "ggpbi()\n  .aes({ x: 'wt', y: 'mpg' })\n  .geom('point')\n  .theme({ baseSize: 13 })\n  .renderTo(element);",
      live({ theme: { panelFill: '#333333', baseSize: 13 } }),
      { theme: { panelFill: '#ebebeb', baseSize: 11 } },
    );
    expect(propsOf(result, 'theme')).toEqual({
      baseSize: 13,
      panelFill: { solid: { color: '#ebebeb' } },
    });
    expect(result.residual).toBe(false);
  });

  it('a deleted layer option reverts on its card', () => {
    const result = writebackOf(
      BARE,
      live({ layers: [{ geom: { type: 'point', alpha: 0.4 } }] }),
      { layer1: { alpha: 1 } },
    );
    expect(propsOf(result, 'layer1')).toMatchObject({ alpha: 1 });
    expect(result.residual).toBe(false);
  });

  it('a deleted .scale(…) call reverts type and formats', () => {
    const result = writebackOf(
      BARE,
      live({ scales: { y: { type: 'log', labels: 'compact' } } }),
      { scaleY: { type: 'auto', labelFormat: 'auto' } },
    );
    expect(propsOf(result, 'scaleY')).toEqual({ type: 'auto', labelFormat: 'auto' });
    expect(result.residual).toBe(false);
  });

  it('a deleted facet layout option reverts, the well field stays', () => {
    const result = writebackOf(
      "ggpbi()\n  .aes({ x: 'wt', y: 'mpg' })\n  .geom('point')\n  .facet({ wrap: 'cyl' })\n  .renderTo(element);",
      live({ facet: { wrap: 'cyl', ncol: 3 } }),
      { facet: { columns: 2 } },
    );
    expect(propsOf(result, 'facet')).toEqual({ columns: 2 });
    expect(result.residual).toBe(false);
  });

  it('without a known default the overlay keeps covering the deletion', () => {
    const result = writebackOf(BARE, live({ theme: { panelFill: '#333333' } }), {});
    expect(propsOf(result, 'theme')).toBeUndefined();
    expect(result.residual).toBe(true);
  });
});

describe('what stays overlay (residual)', () => {
  it('an aes change — wells are not properties', () => {
    const result = writebackOf(
      "ggpbi()\n  .aes({ x: 'cyl', y: 'mpg' })\n  .geom('point')\n  .renderTo(element);",
    );
    expect(result.residual).toBe(true);
  });

  it('a fourth layer has no card', () => {
    const result = writebackOf(
      "ggpbi()\n  .aes({ x: 'wt', y: 'mpg' })\n  .geom('point')\n  .geom('line')\n  .geom('area')\n  .geom('smooth')\n  .renderTo(element);",
    );
    expect(result.residual).toBe(true);
  });

  it('scale limits have no slice yet', () => {
    const result = writebackOf(
      "ggpbi()\n  .aes({ x: 'wt', y: 'mpg' })\n  .geom('point')\n  .scale({ y: { min: 0, max: 100 } })\n  .renderTo(element);",
    );
    expect(result.residual).toBe(true);
  });

  it('a free-text subtitle has no pane home', () => {
    const result = writebackOf(
      "ggpbi()\n  .aes({ x: 'wt', y: 'mpg' })\n  .geom('point')\n  .subtitle('Hand-written')\n  .renderTo(element);",
    );
    expect(result.residual).toBe(true);
  });

  it('an unknown geom option is not guessed at', () => {
    const result = writebackOf(
      "ggpbi()\n  .aes({ x: 'wt', y: 'mpg' })\n  .geom('histogram', { bins: 40 })\n  .renderTo(element);",
    );
    expect(result.residual).toBe(true); // bins lives in the histogram card, unmapped v1
    expect(propsOf(result, 'layer1')).toMatchObject({ type: 'histogram' });
  });
});

describe('the dissolve criterion', () => {
  it('a fully written-back edit produces identical code once the pane echoes it', () => {
    // Simulate the round trip: the edit applied, the host persisted, the
    // next update builds the pane spec WITH the new values. The overlay
    // dissolves when both specs generate the same code.
    const base = live();
    const code = "ggpbi()\n  .aes({ x: 'wt', y: 'mpg' })\n  .geom('line', { alpha: 0.5 })\n  .renderTo(element);";
    const parsed = parseCode(code);
    if (parsed.ok !== true) throw new Error('unreachable');
    const merged = applyCodeEdit(base, parsed.patch);

    // The echoed pane state: what pbi-visual would build from the persisted
    // properties — a line layer with alpha 0.5.
    const echoed = live({ layers: [{ geom: { type: 'line', alpha: 0.5 } }] });
    expect(specToCode(applyCodeEdit(echoed, parsed.patch))).toBe(specToCode(echoed));
    void merged;
  });
});
