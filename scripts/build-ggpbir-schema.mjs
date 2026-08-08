#!/usr/bin/env node
/**
 * Generate docs/ggpbir.schema.json — the validation contract for a ggpbi
 * visual.json in PBIR format.
 *
 * The audience is anyone editing PBIP reports mechanically, LLMs included:
 * write the file, validate against this schema, and a typo'd property name,
 * a wrong enum value or a malformed projection fails loudly instead of
 * rendering as a silently-default chart.
 *
 * The `objects` half is generated from capabilities.json — the same file the
 * visual parses — so the schema cannot drift from what ggpbi accepts:
 * a new Format Pane property appears here on the next `npm run ggpbir-schema`,
 * and tests/pbip-ggpbir-schema.test.ts fails until it does. The structural
 * half (position, queryState, projections) is defined here and proven against
 * every ggpbi visual in the demo report by the same test.
 *
 *   npm run ggpbir-schema
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'ggpbir.schema.json');

const capabilities = JSON.parse(fs.readFileSync(path.join(ROOT, 'capabilities.json'), 'utf8'));

// ---------------------------------------------------------------------------
// Literal value encodings
//
// Power BI stores every Format Pane value as a string inside
// { expr: { Literal: { Value: "<encoded>" } } }. The encoding carries the
// type: strings are single-quoted *inside* the JSON string, decimals get a
// D suffix, whole numbers an optional L, booleans are bare. Power BI Desktop
// always writes the suffixed forms; plain digits parse too.
// ---------------------------------------------------------------------------

const literal = (valueSchema) => ({
  type: 'object',
  additionalProperties: false,
  required: ['expr'],
  properties: {
    expr: {
      type: 'object',
      additionalProperties: false,
      required: ['Literal'],
      properties: {
        Literal: {
          type: 'object',
          additionalProperties: false,
          required: ['Value'],
          properties: { Value: valueSchema },
        },
      },
    },
  },
});

const BOOL = literal({ type: 'string', enum: ['true', 'false'] });
const NUMBER = literal({ type: 'string', pattern: '^-?[0-9]+(\\.[0-9]+)?[DL]?$' });
const TEXT = literal({ type: 'string', pattern: "^'[\\s\\S]*'$" });
const ENUM = (values) => literal({ type: 'string', enum: values.map((v) => `'${v}'`) });

// A fill accepts a plain hex string, an expression, or a report-theme colour.
const FILL = {
  type: 'object',
  additionalProperties: false,
  required: ['solid'],
  properties: {
    solid: {
      type: 'object',
      additionalProperties: false,
      required: ['color'],
      properties: {
        color: {
          oneOf: [
            { type: 'string' },
            literal({ type: 'string' }),
            {
              type: 'object',
              additionalProperties: false,
              required: ['ThemeDataColor'],
              properties: {
                ThemeDataColor: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['ColorId'],
                  properties: {
                    ColorId: { type: 'integer' },
                    Percent: { type: 'number' },
                  },
                },
              },
            },
          ],
        },
      },
    },
  },
};

/** Map one capabilities property to its value schema. */
function propertySchema(prop) {
  const t = prop.type ?? {};
  if (t.bool) return BOOL;
  if (t.numeric) return NUMBER;
  if (t.enumeration) return ENUM(t.enumeration.map((e) => e.value));
  if (t.text) return TEXT;
  if (t.fill) return FILL;
  throw new Error(`unhandled capability type: ${JSON.stringify(t)}`);
}

// ---------------------------------------------------------------------------
// objects.* — generated from capabilities.json
// ---------------------------------------------------------------------------

const objectDefs = {};
for (const [name, obj] of Object.entries(capabilities.objects)) {
  const props = {};
  for (const [key, prop] of Object.entries(obj.properties)) {
    props[key] = propertySchema(prop);
  }
  objectDefs[name] = {
    type: 'array',
    minItems: 1,
    maxItems: 1,
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['properties'],
      properties: {
        properties: { type: 'object', additionalProperties: false, properties: props },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// query.queryState — the field wells
//
// PBIR 2.x has no dataRoleBindings: the wells *are* queryState. Every entry
// carries a full field expression, a queryRef, and usually a nativeQueryRef
// (the display name Power BI would show in the well).
// ---------------------------------------------------------------------------

const roles = capabilities.dataRoles.map((r) => r.name);

const column = (kind) => ({
  type: 'object',
  additionalProperties: false,
  required: ['Expression', 'Property'],
  properties: {
    Expression: {
      type: 'object',
      additionalProperties: false,
      required: ['SourceRef'],
      properties: {
        SourceRef: {
          type: 'object',
          additionalProperties: false,
          required: ['Entity'],
          properties: { Entity: { type: 'string' } },
        },
      },
    },
    Property: { type: 'string' },
  },
  description: kind,
});

const fieldExpr = {
  type: 'object',
  minProperties: 1,
  maxProperties: 1,
  properties: {
    Column: { $ref: '#/$defs/columnExpr' },
    Measure: { $ref: '#/$defs/columnExpr' },
    Aggregation: {
      type: 'object',
      additionalProperties: false,
      required: ['Expression', 'Function'],
      properties: {
        Expression: {
          type: 'object',
          additionalProperties: false,
          required: ['Column'],
          properties: { Column: { $ref: '#/$defs/columnExpr' } },
        },
        // 0 Sum · 1 Avg · 2 Count · 3 Min · 4 Max · 5 CountNonNull · 6 Median
        Function: { type: 'integer', minimum: 0, maximum: 8 },
      },
    },
  },
  additionalProperties: false,
};

const projection = {
  type: 'object',
  additionalProperties: false,
  required: ['field', 'queryRef'],
  properties: {
    field: { $ref: '#/$defs/fieldExpr' },
    queryRef: { type: 'string' },
    nativeQueryRef: { type: 'string' },
    active: { type: 'boolean' },
  },
};

const queryState = {
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(
    roles.map((role) => [
      role,
      {
        type: 'object',
        additionalProperties: false,
        required: ['projections'],
        properties: {
          projections: { type: 'array', minItems: 1, items: { $ref: '#/$defs/projection' } },
        },
      },
    ]),
  ),
};

// ---------------------------------------------------------------------------
// visual.json top level
// ---------------------------------------------------------------------------

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://github.com/efelcie/ggpbi/docs/ggpbir.schema.json',
  title: 'ggpbi visual.json (PBIR)',
  description:
    'Validation contract for a ggpbi visual inside a PBIP report ' +
    '(PBIR visualContainer 2.x). The objects section is generated from ' +
    "capabilities.json by scripts/build-ggpbir-schema.mjs — edit that, not this. " +
    'Documented in docs/ggpbir-reference.md.',
  type: 'object',
  additionalProperties: false,
  required: ['name', 'position', 'visual'],
  properties: {
    $schema: { type: 'string' },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 50,
      description: 'Unique in the report; must equal the folder name the file lives in.',
    },
    position: {
      type: 'object',
      additionalProperties: false,
      required: ['x', 'y', 'z', 'width', 'height'],
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        z: { type: 'number' },
        width: { type: 'number', exclusiveMinimum: 0 },
        height: { type: 'number', exclusiveMinimum: 0 },
        tabOrder: { type: 'number' },
        angle: { type: 'number' },
      },
    },
    visual: {
      type: 'object',
      additionalProperties: false,
      required: ['visualType'],
      properties: {
        visualType: { const: 'ggpbiGrammarOfGraphics' },
        query: {
          type: 'object',
          additionalProperties: false,
          required: ['queryState'],
          properties: {
            queryState: { $ref: '#/$defs/queryState' },
            sortDefinition: { type: 'object' },
          },
        },
        objects: {
          type: 'object',
          additionalProperties: false,
          properties: Object.fromEntries(
            Object.keys(capabilities.objects).map((name) => [name, { $ref: `#/$defs/objects/${name}` }]),
          ),
        },
        // Standard PBIR container formatting (title, background, border, …) —
        // not ggpbi-specific, so only loosely constrained here.
        visualContainerObjects: {
          type: 'object',
          additionalProperties: {
            type: 'array',
            items: {
              type: 'object',
              required: ['properties'],
              properties: { properties: { type: 'object' } },
              additionalProperties: true,
            },
          },
        },
        drillFilterOtherVisuals: { type: 'boolean' },
      },
    },
    // Desktop-managed extras: valid to carry, nothing ggpbi reads.
    filterConfig: { type: 'object' },
    howCreated: { type: 'string' },
    parentGroupName: { type: 'string' },
    isHidden: { type: 'boolean' },
    annotations: {},
  },
  $defs: {
    columnExpr: column('Table.Column or Table.Measure reference'),
    fieldExpr,
    projection,
    queryState,
    objects: objectDefs,
  },
};

fs.writeFileSync(OUT, JSON.stringify(schema, null, 2) + '\n');
const objectCount = Object.keys(capabilities.objects).length;
const propCount = Object.values(capabilities.objects).reduce(
  (n, o) => n + Object.keys(o.properties).length,
  0,
);
console.log(
  `ggpbir.schema.json — ${objectCount} objects, ${propCount} properties, roles: ${roles.join(', ')}`,
);
