/**
 * Data reduction honesty (#281).
 *
 * Power BI hands the visual at most `DATA_REDUCTION_CAP` rows. A chart
 * drawn from a sample must say so — otherwise it is indistinguishable
 * from a chart drawn from the whole table.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ggpbi } from '../src/index';
import { buildPlot } from '../src/pipeline';
import { isDataTruncated, DATA_REDUCTION_CAP } from '../src/powerbi';

const data = Array.from({ length: 20 }, (_, i) => ({ x: i, y: i * 2, g: i % 2 ? 'a' : 'b' }));

function container(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 800 });
  Object.defineProperty(el, 'clientHeight', { value: 600 });
  document.body.appendChild(el);
  return el;
}

describe('isDataTruncated', () => {
  it('trusts the host segment marker even below the cap', () => {
    expect(isDataTruncated({ metadata: { segment: {} } }, 42)).toBe(true);
  });

  it('falls back to the row cap when no marker is present', () => {
    expect(isDataTruncated({ metadata: {} }, DATA_REDUCTION_CAP)).toBe(true);
    expect(isDataTruncated({ metadata: {} }, DATA_REDUCTION_CAP - 1)).toBe(false);
  });

  it('says no for ordinary result sets', () => {
    expect(isDataTruncated(undefined, 100)).toBe(false);
    expect(isDataTruncated({}, 0)).toBe(false);
  });
});

describe('truncation notice', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const spec = (extra: Record<string, unknown>) => ({
    data,
    aes: { x: 'x', y: 'y' },
    layers: [{ geom: { type: 'point' as const } }],
    width: 800,
    height: 600,
    ...extra,
  });

  it('appears even when descriptions are switched off', () => {
    // The whole point: a reader who turned the subtitle off must still
    // learn that marks are missing.
    const built = buildPlot(spec({ truncation: { shown: 30000 } }) as any);
    expect(built.subtitleText).toMatch(/sample of 30,000 rows/);
    expect(built.subtitleText).toMatch(/the source has more/);
  });

  it('is absent without truncation', () => {
    expect(buildPlot(spec({}) as any).subtitleText).toBeUndefined();
  });

  it('joins an existing description instead of replacing it', () => {
    const built = buildPlot(spec({ subtitle: 'always', truncation: { shown: 30000 } }) as any);
    expect(built.subtitleText).toMatch(/^y by x/);
    expect(built.subtitleText).toMatch(/sample of 30,000 rows/);
  });

  it('keeps an explicit subtitle and appends the notice', () => {
    const built = buildPlot(spec({ subtitle: 'Quarterly revenue', truncation: { shown: 30000 } }) as any);
    expect(built.subtitleText).toBe(
      'Quarterly revenue · showing a sample of 30,000 rows — the source has more',
    );
  });

  it('reserves layout space so the notice cannot overlap the panel', () => {
    const withNote = buildPlot(spec({ truncation: { shown: 30000 } }) as any);
    const without = buildPlot(spec({}) as any);
    expect(withNote.layout.margin.top).toBeGreaterThan(without.layout.margin.top);
  });

  it('renders as the subtitle line', () => {
    const el = container();
    const svg = ggpbi().data(data).aes({ x: 'x', y: 'y' }).geom('point')
      .truncation(30000)
      .size(800, 600).renderTo(el);
    const text = svg.querySelector('.ggpbi-subtitle')?.textContent ?? '';
    expect(text).toMatch(/sample of 30,000 rows/);
  });
});

describe('capabilities data reduction', () => {
  const caps = JSON.parse(
    readFileSync(join(__dirname, '..', 'capabilities.json'), 'utf8'),
  );
  const reduction = caps.dataViewMappings[0].categorical.categories.dataReductionAlgorithm;

  it('samples across the data instead of taking the first N rows', () => {
    // `top` is not a sample: source data is usually sorted by date, region
    // or amount, so the first 30k rows are systematically biased.
    expect(reduction.top, 'top truncates rather than samples').toBeUndefined();
    expect(reduction.sample).toBeTruthy();
  });

  it('matches the cap the truncation check uses', () => {
    expect(reduction.sample.count).toBe(DATA_REDUCTION_CAP);
  });
});
