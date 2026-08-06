/**
 * Format Pane theme presets: the picker defaults must not silently undo a
 * chosen preset, which is why GREY_DEFAULTS is the single source for both
 * the grey theme and the "was this picker touched?" comparison.
 */
import { describe, it, expect } from 'vitest';
import { themeGrey, themeMinimal, themeDark, GREY_DEFAULTS, resolveTheme } from '../src/theme';
import { GgpbiFormattingSettings } from '../src/formatting-settings';

describe('theme presets', () => {
  it('the grey theme is built from GREY_DEFAULTS', () => {
    const grey = themeGrey();
    expect(grey.panelFill).toBe(GREY_DEFAULTS.panelFill);
    expect(grey.gridColor).toBe(GREY_DEFAULTS.gridColor);
    expect(grey.ink).toBe(GREY_DEFAULTS.ink);
  });

  it('the Format Pane colour-picker defaults match GREY_DEFAULTS', () => {
    // If these drift apart, an untouched picker would count as an override
    // and quietly cancel the dark/minimal preset.
    const s = new GgpbiFormattingSettings();
    expect(s.theme.panelFill.value.value).toBe(GREY_DEFAULTS.panelFill);
    expect(s.theme.gridlineColor.value.value).toBe(GREY_DEFAULTS.gridColor);
    expect(s.theme.ink.value.value).toBe(GREY_DEFAULTS.ink);
    expect(s.theme.paper.value.value).toBe(GREY_DEFAULTS.paper);
    expect(s.theme.preset.value).toBe('grey');
  });

  it('dark and minimal differ from grey in the panel colours', () => {
    expect(themeDark().panelFill).not.toBe(GREY_DEFAULTS.panelFill);
    expect(themeMinimal().panelFill).not.toBe(GREY_DEFAULTS.panelFill);
    expect(themeDark().paper).toBeTruthy();
  });

  it('a preset resolves into a complete usable theme', () => {
    const resolved = resolveTheme(themeDark());
    expect(resolved.panelFill).toBe('#2d2d2d');
    expect(resolved.ink).toBe('#e0e0e0');
    expect(resolved.axisTextSize).toBeGreaterThan(0);
  });
});
