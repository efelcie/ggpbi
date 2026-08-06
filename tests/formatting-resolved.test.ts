import { describe, it, expect } from 'vitest';
import { GgpbiFormattingSettings } from '../src/formatting-settings';

describe('Format Pane: resolved auto geoms', () => {
  it('shows the resolved auto choice in the layer card title', () => {
    const s = new GgpbiFormattingSettings();
    s.applyResolvedGeoms([
      { type: 'bar', auto: true },
      { type: 'line', auto: false },
      null,
    ]);
    expect(s.layer1.displayName).toBe('Layer 1 · Auto (Bar)');
    expect(s.layer2.displayName).toBe('Layer 2 · Line');
    expect(s.layer3.displayName).toBe('Layer 3');
  });

  it('collapses specialized cards to the geoms that actually resolved', () => {
    const s = new GgpbiFormattingSettings();
    // updateCardVisibility with an 'auto' layer shows all three specialized
    // cards (nothing resolved yet)...
    s.updateCardVisibility();
    expect(s.boxplot.visible).toBe(true);
    expect(s.histogram.visible).toBe(true);
    expect(s.smooth.visible).toBe(true);

    // ...but once auto resolves to a bar, none of them stays.
    s.applyResolvedGeoms([{ type: 'bar', auto: true }, null, null]);
    expect(s.boxplot.visible).toBe(false);
    expect(s.histogram.visible).toBe(false);
    expect(s.smooth.visible).toBe(false);

    // A resolved boxplot keeps exactly its own card.
    s.applyResolvedGeoms([{ type: 'boxplot', auto: true }, null, null]);
    expect(s.boxplot.visible).toBe(true);
    expect(s.histogram.visible).toBe(false);
  });

  it('distribution card: separate trim toggles carry the ggplot2 geom defaults', () => {
    // Regression: a single shared trim toggle (default false, the density
    // default) read as "user turned trim off" for violins, so every Power
    // BI violin was untrimmed — its tails extended 3 bandwidths past the
    // data and were clipped hard at the panel edge.
    const s = new GgpbiFormattingSettings();
    expect(s.distribution.trim.value).toBe(false); // density: untrimmed
    expect(s.distribution.violinTrim.value).toBe(true); // violin: trimmed
    expect(s.distribution.slices).toContain(s.distribution.violinTrim);
  });

  it('labels all geom types including reference lines', () => {
    const s = new GgpbiFormattingSettings();
    s.applyResolvedGeoms([{ type: 'hline', auto: false }, { type: 'density', auto: true }, null]);
    expect(s.layer1.displayName).toBe('Layer 1 · Reference line');
    expect(s.layer2.displayName).toBe('Layer 2 · Auto (Density)');
  });
});
