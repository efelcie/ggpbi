/**
 * The ggpbir reference and its schema tell the same story.
 *
 * Every complete visual.json in docs/ggpbir-reference.md must validate
 * against docs/ggpbir.schema.json, and every object snippet must use
 * encodings the schema accepts. ggpbi 0.5 documented colours as
 * `{ "solid": { "color": "#hex" } }` — a form the Power BI service drops
 * from visual.json — and the docs carried it into a report generator.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import Ajv2020 from 'ajv/dist/2020';

const root = (p: string) => resolve(__dirname, '..', p);
const schema = JSON.parse(readFileSync(root('docs/ggpbir.schema.json'), 'utf-8'));
const reference = readFileSync(root('docs/ggpbir-reference.md'), 'utf-8').replace(/\r\n/g, '\n');

/** Every ```json block that parses on its own. */
const jsonBlocks = (): unknown[] =>
  [...reference.matchAll(/```json\n([\s\S]*?)```/g)]
    .map(m => {
      try {
        return JSON.parse(m[1]);
      } catch {
        return undefined; // fragments with "…" placeholders
      }
    })
    .filter((b): b is unknown => b !== undefined);

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

describe('ggpbir reference examples', () => {
  const complete = jsonBlocks().filter(
    (b): b is Record<string, unknown> =>
      !!b && typeof b === 'object' && '$schema' in b && 'visual' in b,
  );

  it('has complete examples to check', () => {
    expect(complete.length).toBeGreaterThan(3);
  });

  it('every complete visual.json validates against the schema', () => {
    const failures = complete.flatMap((example, i) =>
      validate(example)
        ? []
        : [`example ${i + 1}: ${ajv.errorsText(validate.errors, { separator: '\n  ' })}`]);
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('documents no bare hex colour inside a fill, fragments included', () => {
    // The bare form is right in theme files, wrong in visual.json. The
    // prose that warns about it spells it with a placeholder ("#hex").
    const bare = [...reference.matchAll(/"solid":\s*\{\s*"color":\s*"#[0-9A-Fa-f]{3,8}"/g)];
    expect(bare.map(m => m[0])).toEqual([]);
  });

  it('the schema rejects the bare hex colour in a layer', () => {
    const example = structuredClone(complete[0]) as any;
    example.visual.objects = {
      layer1: [{ properties: { fill: { solid: { color: '#416B84' } } } }],
    };
    expect(validate(example)).toBe(false);
    example.visual.objects.layer1[0].properties.fill = {
      solid: { color: { expr: { Literal: { Value: "'#416B84'" } } } },
    };
    expect(validate(example), ajv.errorsText(validate.errors)).toBe(true);
  });

  it('the schema knows the facet row heights', () => {
    const example = structuredClone(complete[0]) as any;
    example.visual.objects = {
      facet: [{ properties: { heights: { expr: { Literal: { Value: "'4,1'" } } } } }],
    };
    expect(validate(example), ajv.errorsText(validate.errors)).toBe(true);
  });
});
