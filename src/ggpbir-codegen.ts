/**
 * The third dialect of the code view: ggpbir — the visual's real
 * `visual.json` shape, as documented in docs/ggpbir-reference.md.
 *
 * What the other two dialects describe as a chart, this shows as the
 * report file: `query.queryState` (the field wells) and `objects` (the
 * Format Pane state, PBIR-literal encoded). Only `objects` is editable —
 * wells are drag-and-drop, `visualType` is identity — and the editor
 * greys everything else. Applying an edit diffs the objects against the
 * current state and persists the changes; there is no session overlay in
 * this dialect, because everything it can say IS pane state.
 *
 * The queryState shown is display-faithful, not byte-faithful: it is
 * derived from the DataView the host hands over, which does not carry
 * every notational detail of the .pbip source. The objects section IS
 * the real encoding — `"Value": "'point'"`, `0.7D`, `{"solid":…}` —
 * so a block copied from here pastes into a report file and back.
 */
import type { CodeToken, TokenKind } from './codegen';

/** One well: the display names of its bound fields, with query refs. */
export interface WellProjection {
  displayName: string;
  queryRef?: string;
}

export interface GgpbirContext {
  visualType: string;
  /** role → bound fields, in well order. Read-only in the editor. */
  wells: Record<string, WellProjection[]>;
  /** object → property → plain value (string, number, boolean, color hex). */
  objects: Record<string, Record<string, unknown>>;
}

// --- PBIR literal encoding --------------------------------------------------

/** A plain value → the PBIR property encoding. */
export function encodeProperty(name: string, value: unknown): unknown {
  if (typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value)) {
    return { solid: { color: { expr: { Literal: { Value: `'${value}'` } } } } };
  }
  if (typeof value === 'string') return { expr: { Literal: { Value: `'${value.replace(/'/g, "\\'")}'` } } };
  if (typeof value === 'number') {
    return { expr: { Literal: { Value: Number.isInteger(value) ? `${value}L` : `${value}D` } } };
  }
  if (typeof value === 'boolean') return { expr: { Literal: { Value: String(value) } } };
  return { expr: { Literal: { Value: String(value) } } };
}

/** The PBIR property encoding → a plain value, or undefined if unreadable. */
export function decodeProperty(encoded: unknown): unknown {
  if (encoded === null || typeof encoded !== 'object') return undefined;
  const solid = (encoded as { solid?: { color?: unknown } }).solid;
  if (solid && solid.color !== undefined) {
    if (typeof solid.color === 'string') return solid.color;
    return decodeProperty(solid.color);
  }
  const value = (encoded as { expr?: { Literal?: { Value?: unknown } } }).expr?.Literal?.Value;
  if (typeof value !== 'string') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const quoted = /^'(.*)'$/s.exec(value);
  if (quoted) return quoted[1].replace(/\\'/g, "'");
  const num = /^(-?\d+(?:\.\d+)?)[DL]?$/.exec(value);
  if (num) return parseFloat(num[1]);
  return undefined;
}

// --- Generation -------------------------------------------------------------

function queryStateJson(wells: GgpbirContext['wells']): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  for (const [role, projections] of Object.entries(wells)) {
    if (projections.length === 0) continue;
    state[role] = {
      projections: projections.map((p) => ({
        field: { Column: { Property: p.displayName } },
        ...(p.queryRef ? { queryRef: p.queryRef } : {}),
      })),
    };
  }
  return state;
}

/** Render the context as the visual.json shape, objects PBIR-encoded. */
export function ggpbirText(ctx: GgpbirContext): string {
  const objects: Record<string, unknown> = {};
  for (const [name, properties] of Object.entries(ctx.objects)) {
    const encoded: Record<string, unknown> = {};
    for (const [prop, value] of Object.entries(properties)) {
      encoded[prop] = encodeProperty(prop, value);
    }
    objects[name] = [{ properties: encoded }];
  }
  return JSON.stringify(
    {
      visual: {
        visualType: ctx.visualType,
        query: { queryState: queryStateJson(ctx.wells) },
        objects,
      },
    },
    null,
    2,
  );
}

// --- Parsing ----------------------------------------------------------------

export type GgpbirParseResult =
  | { ok: true; objects: Record<string, Record<string, unknown>>; raw: unknown }
  | { ok: false; error: string; line: number };

/** Line number of a JSON.parse position message, for the error strip. */
const lineOfPosition = (text: string, message: string): number => {
  const m = /position (\d+)/.exec(message);
  if (!m) return 1;
  return text.slice(0, Number(m[1])).split('\n').length;
};

/**
 * Parse edited ggpbir text: strict JSON, objects decoded to plain values.
 * Structural surprises fail with a message naming the spot.
 */
export function parseGgpbir(text: string): GgpbirParseResult {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `not valid JSON: ${message}`, line: lineOfPosition(text, message) };
  }
  const visual = (root as { visual?: unknown }).visual;
  if (visual === null || typeof visual !== 'object') {
    return { ok: false, error: 'expected a top-level "visual" object', line: 1 };
  }
  const objectsRaw = (visual as { objects?: unknown }).objects;
  if (objectsRaw === null || typeof objectsRaw !== 'object') {
    return { ok: false, error: 'expected "visual.objects"', line: 1 };
  }

  const objects: Record<string, Record<string, unknown>> = {};
  for (const [name, entry] of Object.entries(objectsRaw as Record<string, unknown>)) {
    const first = Array.isArray(entry) ? entry[0] : entry;
    const properties = (first as { properties?: unknown } | null)?.properties;
    if (properties === null || properties === undefined || typeof properties !== 'object') {
      return { ok: false, error: `object "${name}" needs [{ "properties": { … } }]`, line: 1 };
    }
    const decoded: Record<string, unknown> = {};
    for (const [prop, encoded] of Object.entries(properties as Record<string, unknown>)) {
      const value = decodeProperty(encoded);
      if (value === undefined) {
        return {
          ok: false,
          error: `"${name}.${prop}" is not a readable PBIR literal — see the value encoding table in the ggpbir reference`,
          line: 1,
        };
      }
      decoded[prop] = value;
    }
    objects[name] = decoded;
  }
  return { ok: true, objects, raw: root };
}

/**
 * Do the read-only sections of an edited document still say what the
 * host says? The greyed lines are a promise, not a lock — this check
 * enforces it at apply time.
 */
export function ggpbirReadOnlyMatches(raw: unknown, ctx: GgpbirContext): boolean {
  const visual = (raw as { visual?: unknown }).visual as
    | { visualType?: unknown; query?: unknown }
    | undefined;
  if (!visual) return false;
  if (visual.visualType !== ctx.visualType) return false;
  const expected = JSON.stringify({ queryState: queryStateJson(ctx.wells) });
  return JSON.stringify(visual.query ?? {}) === expected;
}

// --- The read-only mask -----------------------------------------------------

/**
 * Which lines of a ggpbir document are read-only: everything outside the
 * `"objects"` block — the wells, the visual type, the braces around them.
 * Depth-tracked over the actual text, so it follows the user's edits; on
 * text too broken to scan, nothing is dimmed rather than mislead.
 */
export function ggpbirInertLines(text: string): boolean[] {
  const lines = text.split('\n');
  const flags = lines.map(() => true);
  let inString = false;
  let depth = 0;
  let objectsDepth = -1;
  let line = 0;
  let expectObjects = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') { line++; continue; }
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      if (text.startsWith('"objects"', i) && objectsDepth === -1 && depth === 2) {
        expectObjects = true;
      }
      inString = true;
      // skip the string content in one go? handled char-by-char above
      continue;
    }
    if (ch === '{' || ch === '[') {
      depth++;
      if (expectObjects && ch === '{') {
        objectsDepth = depth;
        expectObjects = false;
      }
      continue;
    }
    if (ch === '}' || ch === ']') {
      if (objectsDepth !== -1 && depth === objectsDepth && ch === '}') {
        objectsDepth = -1; // the block closed; its brace line stays editable
        flags[line] = false;
      }
      depth--;
      continue;
    }
    if (objectsDepth !== -1 && depth >= objectsDepth) flags[line] = false;
  }
  // The "objects" key line itself is editable context.
  const keyLine = lines.findIndex(l => l.includes('"objects"'));
  if (keyLine !== -1) flags[keyLine] = false;
  return flags;
}

// --- Highlighting -----------------------------------------------------------

const J_PROPERTY = /"(?:[^"\\]|\\.)*"(?=\s*:)/y;
const J_STRING = /"(?:[^"\\]|\\.)*"/y;
const J_NUMBER = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const J_KEYWORD = /\b(?:true|false|null)\b/y;

/** Tokenise JSON for colouring — the ggpbir sibling of `highlight`. */
export function highlightJson(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let i = 0;
  const tryMatch = (re: RegExp, kind: TokenKind): boolean => {
    re.lastIndex = i;
    const m = re.exec(code);
    if (!m) return false;
    tokens.push({ text: m[0], kind });
    i += m[0].length;
    return true;
  };
  while (i < code.length) {
    if (
      tryMatch(J_PROPERTY, 'property') ||
      tryMatch(J_STRING, 'string') ||
      tryMatch(J_KEYWORD, 'keyword') ||
      tryMatch(J_NUMBER, 'number')
    ) continue;
    const ch = code[i];
    const kind: TokenKind = '{}[]:,'.includes(ch) ? 'punct' : 'plain';
    const last = tokens[tokens.length - 1];
    if (last && last.kind === kind) last.text += ch;
    else tokens.push({ text: ch, kind });
    i += 1;
  }
  return tokens;
}
