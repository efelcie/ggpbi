import { describe, it, expect } from 'vitest';
import { explainError } from '../src/friendly-errors';

describe('explainError', () => {
  it('explains a non-numeric axis field with the field name and a fix', () => {
    const e = explainError('ggpbi: no numeric values in field "Region" for linear scale');
    expect(e.title).toContain('"Region"');
    expect(e.hint).toMatch(/number field|Category/);
  });

  it('explains log-scale failures and points to the Format Pane', () => {
    const e = explainError('ggpbi: no positive values in field "Profit" for log scale');
    expect(e.title).toMatch(/above zero/i);
    expect(e.hint).toContain('Format Pane');
  });

  it('explains sqrt-scale failures', () => {
    const e = explainError('ggpbi: no non-negative values in field "Delta" for sqrt scale');
    expect(e.hint).toMatch(/Linear/);
  });

  it('explains time-scale failures with the field name', () => {
    const e = explainError('ggpbi: no Date values in field "Monat" for time scale');
    expect(e.title).toContain('"Monat"');
    expect(e.hint).toMatch(/date field/i);
  });

  it('explains empty ordinal fields as a filter problem', () => {
    const e = explainError('ggpbi: no values in field "Kategorie" for ordinal scale');
    expect(e.hint).toMatch(/filter/i);
  });

  it('explains missing x/y mappings as empty wells', () => {
    expect(explainError('ggpbi: aes.x is not set — which column should map to the x-axis?').title).toBe('X is empty');
    expect(explainError('ggpbi: aes.y is not set — which column should map to the y-axis?').title).toBe('Y is empty');
  });

  it('explains renamed/removed fields', () => {
    const e = explainError('ggpbi: field "Umsatz" not found in data. Available: sales, region');
    expect(e.title).toContain('"Umsatz"');
    expect(e.hint).toMatch(/renamed|removed/);
  });

  it('explains an all-blank field as a filter state, not a wrong field', () => {
    // A measure that is BLANK under the current slicer is numeric — telling
    // the user to "use a number field instead" sends them after the wrong
    // problem, so this rule has to win over the linear-scale rule.
    const e = explainError('ggpbi: field "Umsatz" has no values in the current filter context');
    expect(e.title).toContain('"Umsatz"');
    expect(e.hint).toMatch(/filter/i);
    expect(e.hint).toMatch(/BLANK/);
    expect(e.hint).not.toMatch(/number field/i);
  });

  it('explains a stat that had too little data', () => {
    const e = explainError('ggpbi: stat "density" needs at least 2 values per group');
    expect(e.title).toMatch(/density/);
    expect(e.hint).toMatch(/at least 2/);
  });

  it('falls back to a generic, still action-oriented hint', () => {
    const e = explainError('TypeError: cannot read properties of undefined');
    expect(e.title.length).toBeGreaterThan(0);
    expect(e.hint).toMatch(/removing the last field|reset/i);
    // Never leak developer jargon into the headline.
    expect(e.title).not.toMatch(/TypeError|undefined/);
  });
});
