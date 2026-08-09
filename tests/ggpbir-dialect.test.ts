/**
 * The ggpbir dialect — the visual's real visual.json shape in the editor.
 *
 * Generation encodes plain pane values as PBIR literals exactly as
 * docs/ggpbir-reference.md specifies; parsing decodes them back; the
 * read-only mask greys everything outside `objects`; and the round trip
 * objects → text → objects is lossless. Only then can a block copied
 * from the editor paste into a .pbip report file, and back.
 */
import { describe, it, expect } from 'vitest';
import {
  ggpbirText, parseGgpbir, ggpbirInertLines, ggpbirReadOnlyMatches,
  encodeProperty, decodeProperty, highlightJson, type GgpbirContext,
} from '../src/ggpbir-codegen';

const ctx = (): GgpbirContext => ({
  visualType: 'ggpbiGrammarOfGraphics',
  wells: {
    x: [{ displayName: 'wt', queryRef: 'mtcars.wt' }],
    y: [{ displayName: 'mpg', queryRef: 'Sum(mtcars.mpg)' }],
  },
  objects: {
    layer1: { enabled: true, type: 'point', alpha: 0.6, size: 3 },
    theme: { preset: 'grey', showCode: true, panelFill: '#ebebeb' },
  },
});

describe('the PBIR literal encoding', () => {
  it('quotes strings the PBIR way, inside the JSON string', () => {
    expect(encodeProperty('type', 'point')).toEqual({
      expr: { Literal: { Value: "'point'" } },
    });
  });

  it('suffixes numbers with D or L and reads bare ones too', () => {
    expect(encodeProperty('alpha', 0.6)).toEqual({ expr: { Literal: { Value: '0.6D' } } });
    expect(encodeProperty('size', 3)).toEqual({ expr: { Literal: { Value: '3L' } } });
    expect(decodeProperty({ expr: { Literal: { Value: '0.7' } } })).toBe(0.7);
    expect(decodeProperty({ expr: { Literal: { Value: '20L' } } })).toBe(20);
  });

  it('wraps hex colors as solid fills and unwraps them', () => {
    const encoded = encodeProperty('panelFill', '#ebebeb');
    expect(encoded).toEqual({
      solid: { color: { expr: { Literal: { Value: "'#ebebeb'" } } } },
    });
    expect(decodeProperty(encoded)).toBe('#ebebeb');
    expect(decodeProperty({ solid: { color: '#ff0000' } })).toBe('#ff0000');
  });

  it('booleans stay bare', () => {
    expect(encodeProperty('enabled', true)).toEqual({ expr: { Literal: { Value: 'true' } } });
    expect(decodeProperty({ expr: { Literal: { Value: 'false' } } })).toBe(false);
  });
});

describe('the round trip', () => {
  it('objects → text → objects is lossless', () => {
    const text = ggpbirText(ctx());
    const parsed = parseGgpbir(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok !== true) return;
    expect(parsed.objects).toEqual(ctx().objects);
  });

  it('the text is the documented visual.json shape', () => {
    const text = ggpbirText(ctx());
    const raw = JSON.parse(text);
    expect(raw.visual.visualType).toBe('ggpbiGrammarOfGraphics');
    expect(raw.visual.query.queryState.x.projections[0].queryRef).toBe('mtcars.wt');
    expect(raw.visual.objects.layer1[0].properties.type).toEqual({
      expr: { Literal: { Value: "'point'" } },
    });
  });

  it('read-only tampering is detectable', () => {
    const text = ggpbirText(ctx());
    const parsed = parseGgpbir(text);
    if (parsed.ok !== true) throw new Error('unreachable');
    expect(ggpbirReadOnlyMatches(parsed.raw, ctx())).toBe(true);

    const tampered = parseGgpbir(text.replace('"wt"', '"hp"'));
    if (tampered.ok !== true) throw new Error('unreachable');
    expect(ggpbirReadOnlyMatches(tampered.raw, ctx())).toBe(false);
  });

  it('bad JSON and unreadable literals fail with a message', () => {
    const broken = parseGgpbir('{ not json');
    expect(broken.ok).toBe(false);

    const badLiteral = parseGgpbir(JSON.stringify({
      visual: { objects: { theme: [{ properties: { preset: { expr: { Bad: {} } } } }] } },
    }));
    expect(badLiteral.ok).toBe(false);
    if (badLiteral.ok === false) expect(badLiteral.error).toContain('theme.preset');
  });
});

describe('the read-only mask', () => {
  it('greys the wells and the visual type, keeps objects editable', () => {
    const text = ggpbirText(ctx());
    const lines = text.split('\n');
    const flags = ggpbirInertLines(text);
    expect(flags).toHaveLength(lines.length);

    const flagOf = (needle: string): boolean =>
      flags[lines.findIndex(l => l.includes(needle))];

    expect(flagOf('"visualType"')).toBe(true);
    expect(flagOf('"queryState"')).toBe(true);
    expect(flagOf('"mtcars.wt"')).toBe(true);
    expect(flagOf('"objects"')).toBe(false);
    expect(flagOf("'point'")).toBe(false);
    expect(flagOf('"alpha"')).toBe(false);
  });
});

describe('highlightJson', () => {
  it('tells keys, strings, numbers and keywords apart', () => {
    const kinds = new Map(
      highlightJson('{ "alpha": { "Value": "0.6D" }, "on": true, "n": 3 }')
        .map(t => [t.text, t.kind]),
    );
    expect(kinds.get('"alpha"')).toBe('property');
    expect(kinds.get('"0.6D"')).toBe('string');
    expect(kinds.get('true')).toBe('keyword');
    expect(kinds.get('3')).toBe('number');
  });
});
