/**
 * Autocomplete for the editor's chart dialects — the DAX-editor feel of
 * suggestions while you type, at CodeMirror weight.
 *
 * The vocabularies come from the modules that own the truth: geom types
 * from the scene-builder registry, chain methods from the parser,
 * aesthetics from the codegen order. A list typed here by hand would
 * drift; these cannot.
 */
import type { CompletionContext, CompletionResult, Completion } from '@codemirror/autocomplete';
import { sceneBuilders } from './geoms/registry';
import { KNOWN_METHODS } from './code-parse';
import { AES_ORDER } from './codegen';
import { GEOM_TO_R } from './r-codegen';

const GEOM_TYPES = Object.keys(sceneBuilders);

/** Geom options worth suggesting — the pane's vocabulary plus stat knobs. */
const GEOM_OPTIONS = [
  'alpha', 'size', 'color', 'fill', 'linetype', 'position', 'shape',
  'strokeWidth', 'jitterWidth', 'jitterHeight', 'lineend', 'linejoin',
  'orientation', 'just', 'width', 'repel', 'labelTemplate',
  'method', 'se', 'span', 'bins', 'binwidth', 'boundary', 'center',
  'adjust', 'trim', 'notch', 'varwidth', 'naRm',
];

const SCALE_KEYS = ['type', 'min', 'max', 'labels', 'dateLabels'];
const FACET_KEYS = ['wrap', 'row', 'col', 'ncol', 'nrow', 'freeX', 'freeY'];
/** Editable theme keys — the host-owned ones are greyed, not suggested. */
const THEME_KEYS = ['preset', 'panelFill', 'gridColor', 'ink', 'paper', 'baseSize'];
const THEME_PRESETS = ['grey', 'minimal', 'dark'];

const options = (labels: readonly string[], type: string): Completion[] =>
  labels.map(label => ({ label, type }));

/**
 * Completions for the fluent ggpbi chain: methods after a dot, geom
 * names inside .geom('…'), aesthetic keys inside .aes({…}), option keys
 * inside a geom's config object — and the WELL FIELDS as string values:
 * only what is actually bound can be named, and the suggestions say so.
 */
export function createGgpbiCompletions(fields: string[] = []) {
  return (context: CompletionContext): CompletionResult | null =>
    ggpbiCompletionsWith(context, fields);
}

/** Back-compat plain source without field suggestions. */
export function ggpbiCompletions(context: CompletionContext): CompletionResult | null {
  return ggpbiCompletionsWith(context, []);
}

function ggpbiCompletionsWith(context: CompletionContext, fields: string[]): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);

  // A string value inside .aes({ … }) or .facet({ … }): the bound
  // fields — and nothing else. Inside the quotes, key suggestions would
  // be wrong, so an unknown-field position stays quiet.
  const fieldString = /\.(?:aes|facet)\(\{[^}]*?:\s*'([^']*)$/.exec(before);
  if (fieldString) {
    if (fields.length === 0) return null;
    return {
      from: context.pos - fieldString[1].length,
      options: options(fields, 'variable'),
      validFor: /^[^']*$/,
    };
  }

  const geomString = /\.geom\(\s*'([\w]*)$/.exec(before);
  if (geomString) {
    return {
      from: context.pos - geomString[1].length,
      options: options(GEOM_TYPES, 'type'),
      validFor: /^[\w]*$/,
    };
  }

  const presetString = /preset:\s*'([\w]*)$/.exec(before);
  if (presetString) {
    return {
      from: context.pos - presetString[1].length,
      options: options(THEME_PRESETS, 'constant'),
      validFor: /^[\w]*$/,
    };
  }

  const themeKey = /\.theme\(\{[^}]*?([a-zA-Z]*)$/.exec(before);
  if (themeKey) {
    return {
      from: context.pos - themeKey[1].length,
      options: options(THEME_KEYS, 'property'),
      validFor: /^[a-zA-Z]*$/,
    };
  }

  const aesKey = /\.aes\(\{[^}]*?([a-zA-Z]*)$/.exec(before);
  if (aesKey) {
    return {
      from: context.pos - aesKey[1].length,
      options: options(AES_ORDER as readonly string[], 'property'),
      validFor: /^[a-zA-Z]*$/,
    };
  }

  const scaleKey = /\.scale\(\{[^)]*?([a-zA-Z]*)$/.exec(before);
  if (scaleKey) {
    return {
      from: context.pos - scaleKey[1].length,
      options: options(['x', 'y', ...SCALE_KEYS], 'property'),
      validFor: /^[a-zA-Z]*$/,
    };
  }

  const facetKey = /\.facet\(\{[^}]*?([a-zA-Z]*)$/.exec(before);
  if (facetKey) {
    return {
      from: context.pos - facetKey[1].length,
      options: options(FACET_KEYS, 'property'),
      validFor: /^[a-zA-Z]*$/,
    };
  }

  const geomOption = /\.geom\([^)]*\{[^}]*?([a-zA-Z]*)$/.exec(before);
  if (geomOption) {
    return {
      from: context.pos - geomOption[1].length,
      options: options(GEOM_OPTIONS, 'property'),
      validFor: /^[a-zA-Z]*$/,
    };
  }

  const method = /\.([a-zA-Z]*)$/.exec(before);
  if (method) {
    return {
      from: context.pos - method[1].length,
      options: options([...KNOWN_METHODS], 'method'),
      validFor: /^[a-zA-Z]*$/,
    };
  }

  return null;
}

const R_FUNCTIONS = [
  ...Object.values(GEOM_TO_R),
  'scale_x_log10', 'scale_y_log10', 'scale_x_continuous', 'scale_y_continuous',
  'facet_wrap', 'facet_grid', 'gghighlight', 'labs',
  'theme_ggpbi', 'theme_minimal', 'theme_dark', 'theme_grey',
];

const R_AES_ARGS = [
  'x', 'y', 'colour', 'fill', 'size', 'shape', 'alpha', 'group', 'label',
  'xend', 'yend', 'xmin', 'xmax', 'ymin', 'ymax',
];

const R_NAMED_ARGS = [
  'alpha', 'size', 'colour', 'fill', 'linetype', 'position', 'shape',
  'method', 'se', 'bins', 'binwidth', 'stat', 'ncol', 'nrow', 'scales',
  'limits', 'labels', 'subtitle', 'trans',
];

/** A bare R name, backticked for suggestions when R would reject it. */
const rApply = (name: string): string =>
  /^[a-zA-Z.][\w.]*$/.test(name) ? name : `\`${name.replace(/`/g, '')}\``;

/**
 * Completions for the ggplot2 dialect: functions after `+`, aesthetic
 * names inside aes(), named arguments inside any call — and the well
 * fields where a column belongs (aes values, facet formulas).
 */
export function createGgplot2Completions(fields: string[] = []) {
  return (context: CompletionContext): CompletionResult | null =>
    ggplot2CompletionsWith(context, fields);
}

/** Back-compat plain source without field suggestions. */
export function ggplot2Completions(context: CompletionContext): CompletionResult | null {
  return ggplot2CompletionsWith(context, []);
}

function ggplot2CompletionsWith(context: CompletionContext, fields: string[]): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);

  const fieldOptions: Completion[] = fields.map(f => ({
    label: f, apply: rApply(f), type: 'variable',
  }));

  // A column position: after = inside aes(), or after a ~ formula.
  const aesValue = /\baes\([^)]*?(?:=\s*|~\s*)`?([\w.]*)$/.exec(before)
    ?? /~\s*`?([\w.]*)$/.exec(before);
  if (aesValue && fields.length > 0) {
    return {
      from: context.pos - aesValue[1].length,
      options: fieldOptions,
      validFor: /^[\w.]*$/,
    };
  }

  const aesArg = /\baes\([^)]*?([a-zA-Z]*)$/.exec(before);
  if (aesArg) {
    return {
      from: context.pos - aesArg[1].length,
      options: options(R_AES_ARGS, 'property'),
      validFor: /^[a-zA-Z]*$/,
    };
  }

  const fn = /(?:^|\+)\s*([a-zA-Z_]*)$/.exec(before);
  if (fn) {
    return {
      from: context.pos - fn[1].length,
      options: options(R_FUNCTIONS, 'function'),
      validFor: /^[\w]*$/,
    };
  }

  const named = /\(\s*[^)]*?([a-zA-Z_]*)$/.exec(before);
  if (named) {
    return {
      from: context.pos - named[1].length,
      options: options(R_NAMED_ARGS, 'property'),
      validFor: /^[\w]*$/,
    };
  }

  return null;
}
