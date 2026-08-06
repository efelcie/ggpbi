/**
 * Friendly error explanations for the Power BI visual.
 *
 * Rendering errors are developer-speak ("no numeric values in field X for
 * linear scale"). Report users need to know what to DO — which field to
 * swap, which Format Pane setting to change. This module maps known error
 * messages to action-oriented hints; the raw message stays available as a
 * muted detail line for debugging.
 */

export interface FriendlyError {
  /** Short, plain-language headline. */
  title: string;
  /** What the user can do about it. */
  hint: string;
}

interface Rule {
  pattern: RegExp;
  explain: (m: RegExpMatchArray) => FriendlyError;
}

const RULES: Rule[] = [
  {
    // Must precede the type-specific rules: an empty field fails those too,
    // and "use a number field instead" is bad advice for a measure that is
    // simply BLANK under the current filters.
    pattern: /field "(.+?)" has no values in the current filter context/,
    explain: (m) => ({
      title: `"${m[1]}" is empty right now`,
      hint: `The field has no values under the current filters — a measure returning BLANK, or a slicer selection with no matching rows. Check the report, page and visual filters; the chart returns as soon as there is data.`,
    }),
  },
  {
    pattern: /stat "(.+?)" needs at least (\d+) values/,
    explain: (m) => ({
      title: `Not enough data for a ${m[1]} curve`,
      hint: `This chart computes its shape from the data and needs at least ${m[2]} values per group. Widen the filter, or use a chart that can show single observations — a point or bar layer.`,
    }),
  },
  {
    pattern: /no numeric values in field "(.+?)" for linear scale/,
    explain: (m) => ({
      title: `"${m[1]}" contains no numbers`,
      hint: `This axis expects numeric values. Put a number field there instead — or set the axis scale to "Category" in the Format Pane to treat "${m[1]}" as labels.`,
    }),
  },
  {
    pattern: /no positive values in field "(.+?)" for log scale/,
    explain: (m) => ({
      title: `Log scale needs values above zero`,
      hint: `"${m[1]}" has no positive values, so a logarithmic axis cannot be drawn. Switch the axis scale back to "Auto" or "Linear" in the Format Pane, or filter out zero and negative values.`,
    }),
  },
  {
    pattern: /no non-negative values in field "(.+?)" for sqrt scale/,
    explain: (m) => ({
      title: `Square-root scale needs values ≥ 0`,
      hint: `"${m[1]}" has only negative values. Switch the axis scale back to "Auto" or "Linear" in the Format Pane.`,
    }),
  },
  {
    pattern: /no Date values in field "(.+?)" for time scale/,
    explain: (m) => ({
      title: `"${m[1]}" contains no dates`,
      hint: `The axis is set to a time scale, but "${m[1]}" has no date values. Use a date field there, or set the axis scale to "Auto" in the Format Pane.`,
    }),
  },
  {
    pattern: /no values in field "(.+?)" for ordinal scale/,
    explain: (m) => ({
      title: `"${m[1]}" is empty`,
      hint: `The field has no values in the current filter context. Check the report and page filters — everything may be filtered out.`,
    }),
  },
  {
    pattern: /aes\.x is not set/,
    explain: () => ({
      title: 'X is empty',
      hint: 'Drag a field into the X well — a category, a number, or a date. ggpbi picks a fitting chart automatically.',
    }),
  },
  {
    pattern: /aes\.y is not set/,
    explain: () => ({
      title: 'Y is empty',
      hint: 'Drag a field into the Y well — usually a measure. ggpbi picks a fitting chart automatically.',
    }),
  },
  {
    pattern: /field "(.+?)" not found in data/,
    explain: (m) => ({
      title: `"${m[1]}" is missing from the data`,
      hint: `The field may have been renamed or removed from the model. Remove it from the field wells and drag the current version back in.`,
    }),
  },
];

/**
 * Map a raw error message to an action-oriented explanation.
 * Unknown errors get a generic-but-helpful fallback.
 */
export function explainError(message: string): FriendlyError {
  for (const rule of RULES) {
    const m = message.match(rule.pattern);
    if (m) return rule.explain(m);
  }
  return {
    title: 'This chart needs a small change',
    hint: 'The current combination of fields and settings could not be rendered. Try removing the last field you added, or reset the layer settings in the Format Pane.',
  };
}
