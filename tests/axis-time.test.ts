import { describe, it, expect, beforeEach } from 'vitest';
import { ggpbi } from '../src/index';

describe('time axis tick labels', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('labels time axes with calendar values, not epoch milliseconds', () => {
    // Regression: Wilkinson breaks ran on Number(Date) and labelled raw
    // epoch values like "500000000000". Time scales must fall through to
    // d3's calendar-aware ticks.
    const data = Array.from({ length: 48 }, (_, i) => ({
      date: new Date(Date.UTC(2000 + Math.floor(i / 12), i % 12, 1)),
      value: 10 + (i % 7),
    }));

    const svg = ggpbi()
      .data(data as any)
      .aes({ x: 'date', y: 'value' })
      .geom('line')
      .size(640, 400)
      .renderTo(container);

    const labels = Array.from(svg.querySelectorAll('.ggpbi-axis-x .tick text'))
      .map(t => (t.textContent ?? '').trim())
      .filter(Boolean);

    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(Math.abs(Number(label)), `axis label "${label}" looks like epoch ms`).not.toBeGreaterThan(100000);
    }
    // At least one label should mention a year in the data range.
    expect(labels.some(l => /200[0-4]/.test(l))).toBe(true);
  });
});
