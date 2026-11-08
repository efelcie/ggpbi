/**
 * baseSize for pages laid out at 3× device pixels.
 *
 * A Power BI mobile layout counts device pixels at 3×, so a chart there
 * needs baseSize ≈ 40 to read like 13 px. The Format Pane capped the
 * field at 24 while the report file could carry any value; the pane now
 * goes to 72 and the value reaches the theme unclamped.
 */
import { describe, it, expect } from 'vitest';
import { GgpbiFormattingSettings } from '../src/formatting-settings';
import { renderVisual } from './helpers/pbi-host';

describe('baseSize above the old pane maximum', () => {
  it('the Format Pane accepts up to 72', () => {
    const max = (new GgpbiFormattingSettings().theme.baseSize.options as any).maxValue.value;
    expect(max).toBe(72);
  });

  it('a report value of 40 drives every text size', () => {
    const { container } = renderVisual({
      categories: [
        { name: 'Month', role: 'x', values: ['Jan', 'Feb', 'Jan', 'Feb'] },
        { name: 'Panel', role: 'facet', values: ['A', 'A', 'B', 'B'] },
      ],
      measures: [{ name: 'Sales', values: [1, 3, 2, 4] }],
      objects: { layer1: { enabled: true, type: 'line' }, theme: { baseSize: 40 } },
      width: 1080,
      height: 1200,
    });
    const svg = container.querySelector('svg')!;
    expect(svg, container.textContent ?? '').not.toBeNull();
    // Axis text is rel(0.8): 32 px. Strips use the same size.
    const tick = svg.querySelector('.ggpbi-axis-y text') as SVGTextElement;
    expect(tick.style.fontSize).toBe('32px');
    const strip = svg.querySelector('.ggpbi-facet-strip-wrap') as SVGTextElement;
    expect(strip.style.fontSize).toBe('32px');
    // The y-axis title is rel(1): 40 px.
    expect(svg.querySelector('.ggpbi-axis-label-y')?.getAttribute('font-size')).toBe('40px');
  });
});
