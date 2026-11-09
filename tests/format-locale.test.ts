/**
 * Axis label formats and locale (#242).
 *
 * Two defects in one: `1200000` on a revenue axis is unreadable, and
 * every number was formatted the JavaScript way — so an Austrian report
 * showed "1234.5" where it must read "1234,5", with English month names
 * on its time axes.
 */
import { describe, it, expect } from 'vitest';
import {
  formatPlain, formatThousands, formatCompact, formatCurrency, formatPercent,
  formatDates, autoDateFormat, breakDecimals,
} from '../src/format';
import { formatBreaksAs } from '../src/breaks';
import { ggpbi } from '../src/index';

const EN = { locale: 'en-US' };
const DE = { locale: 'de-DE' };

function container(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 800 });
  Object.defineProperty(el, 'clientHeight', { value: 600 });
  document.body.appendChild(el);
  return el;
}

describe('number formats', () => {
  it('plain keeps ggplot2 shape: minimal decimals, no grouping', () => {
    expect(formatPlain([0, 500000, 1000000], EN)).toEqual(['0', '500000', '1000000']);
    expect(formatPlain([0, 2.5, 5], EN)).toEqual(['0.0', '2.5', '5.0']);
  });

  it('plain respects the locale decimal mark', () => {
    // The quiet bug: an Austrian report read "1234.5".
    expect(formatPlain([0, 2.5, 5], DE)).toEqual(['0,0', '2,5', '5,0']);
  });

  it('thousands groups the way the locale does', () => {
    expect(formatThousands([1200000], EN)).toEqual(['1,200,000']);
    expect(formatThousands([1200000], DE)).toEqual(['1.200.000']);
  });

  it('compact is the point of the exercise', () => {
    expect(formatCompact([1200000], EN)).toEqual(['1.2M']);
    expect(formatCompact([450000], EN)).toEqual(['450K']);
    // ggplot2's letters by default, with the German decimal mark …
    expect(formatCompact([1200000], DE)).toEqual(['1,2M']);
    // … and the German word on request.
    expect(formatCompact([1200000], { ...DE, unitSuffix: 'locale' })[0]).toMatch(/Mio/);
  });

  it('compact takes its decimals from the breaks, the same within a unit', () => {
    // scales::label_number(scale_cut = cut_short_scale()): 0.5 had "7M"
    // next to "7.5M" — same unit, different decimals.
    expect(formatCompact([0, 2.5e6, 5e6, 7.5e6], EN)).toEqual(['0', '2.5M', '5.0M', '7.5M']);
    expect(formatCompact([7e6, 7.5e6], EN)).toEqual(['7.0M', '7.5M']);
  });

  it('compact keeps narrow ranges apart instead of repeating one label', () => {
    // 0.5 showed "1.3M" five times on a 1.29–1.33 M axis.
    const labels = formatCompact([1.29e6, 1.3e6, 1.31e6, 1.32e6, 1.33e6], EN);
    expect(labels).toEqual(['1.29M', '1.30M', '1.31M', '1.32M', '1.33M']);
    expect(new Set(labels).size).toBe(5);
  });

  it('compact picks the unit per value and the decimals per unit, like scales', () => {
    expect(formatCompact([0, 5e5, 1e6, 1.5e6], EN)).toEqual(['0', '500K', '1.0M', '1.5M']);
    expect(formatCompact([0, 250, 500, 750, 1000], EN)).toEqual(['0', '250', '500', '750', '1K']);
    expect(formatCompact([1e3, 1e4, 1e5, 1e6], EN)).toEqual(['1K', '10K', '100K', '1M']);
    expect(formatCompact([-2e6, 0, 2e6], EN)).toEqual(['-2M', '0', '2M']);
  });

  it('compact never misstates a lone break in its unit', () => {
    // scales would print "2M" for 2.5M here (a flat facet panel with two breaks).
    expect(formatCompact([0, 2.5e6], EN)).toEqual(['0', '2.5M']);
  });

  it('compact names its units three ways, the marks always from the locale', () => {
    // short (default): scales::cut_short_scale() letters.
    expect(formatCompact([7e6, 7.5e6], DE)).toEqual(['7,0M', '7,5M']);
    // shortSpace: the report's "7,6 M", a Power BI format string #,0,,.0 M.
    expect(formatCompact([7e6, 7.5e6], { ...DE, unitSuffix: 'shortSpace' })).toEqual(['7,0 M', '7,5 M']);
    // locale: the language's own word (Intl puts a no-break space before it).
    expect(formatCompact([7e6, 7.5e6], { ...DE, unitSuffix: 'locale' }).map(s => s.replace(/ /g, ' ')))
      .toEqual(['7,0 Mio.', '7,5 Mio.']);
    // Indian English counts in lakh — only in its own words.
    expect(formatCompact([1.29e6, 1.3e6, 1.31e6], { locale: 'en-IN', unitSuffix: 'locale' }))
      .toEqual(['12.9L', '13.0L', '13.1L']);
    expect(formatCompact([1.29e6, 1.3e6, 1.31e6], { locale: 'en-IN' }))
      .toEqual(['1.29M', '1.30M', '1.31M']);
  });

  it('short letters follow cut_short_scale: K, M, B, T, nothing under 1,000', () => {
    expect(formatCompact([0, 250, 500, 750, 1000], EN)).toEqual(['0', '250', '500', '750', '1K']);
    expect(formatCompact([0, 5e8, 1e9, 1.5e9], EN)).toEqual(['0', '500M', '1.0B', '1.5B']);
    expect(formatCompact([2e12], EN)).toEqual(['2T']);
    // German thousands get their letter too — Intl's German has none.
    expect(formatCompact([0, 5e5, 1e6], DE)).toEqual(['0', '500K', '1M']);
  });

  it('currency places the symbol the way the locale expects', () => {
    expect(formatCurrency([1000], { ...EN, currency: 'USD' })[0]).toContain('$');
    const de = formatCurrency([1000], { ...DE, currency: 'EUR' })[0];
    expect(de).toContain('€');
    // German puts the symbol last: "1.000 €".
    expect(de.trim().endsWith('€')).toBe(true);
  });

  it('percent scales fractions and keeps needed decimals', () => {
    expect(formatPercent([0, 0.5, 1], EN)).toEqual(['0%', '50%', '100%']);
    expect(formatPercent([0, 0.025, 0.05], EN)).toEqual(['0.0%', '2.5%', '5.0%']);
  });

  it('survives a nonsense locale or currency instead of failing the chart', () => {
    expect(() => formatPlain([1, 2], { locale: 'not-a-locale' })).not.toThrow();
    expect(() => formatCurrency([1, 2], { locale: 'en-US', currency: 'XXXXX' })).not.toThrow();
  });

  it('breakDecimals matches the scales::precision rule', () => {
    expect(breakDecimals([0, 2.5, 5])).toBe(1);
    expect(breakDecimals([0, 10, 20])).toBe(0);
    expect(breakDecimals([0, 0.25, 0.5])).toBe(2);
  });
});

describe('formatBreaksAs dispatch', () => {
  it('routes each named format', () => {
    expect(formatBreaksAs([1200000], 'compact', EN)).toEqual(['1.2M']);
    expect(formatBreaksAs([1200000], 'thousands', EN)).toEqual(['1,200,000']);
    expect(formatBreaksAs([0.5], 'percent', EN)).toEqual(['50%']);
    expect(formatBreaksAs([1000], 'currency', { ...EN, currency: 'USD' })[0]).toContain('$');
  });

  it('still takes a custom function', () => {
    expect(formatBreaksAs([1, 2], v => `#${v}`)).toEqual(['#1', '#2']);
  });

  it('defaults to plain', () => {
    expect(formatBreaksAs([1000], undefined, EN)).toEqual(['1000']);
  });
});

describe('date formats', () => {
  const monthly = [new Date(2015, 0, 1), new Date(2015, 1, 1), new Date(2015, 2, 1)];
  const yearly = [new Date(2010, 0, 1), new Date(2015, 0, 1), new Date(2020, 0, 1)];

  it('picks granularity from the tick spacing', () => {
    expect(autoDateFormat(yearly)).toBe('year');
    expect(autoDateFormat(monthly)).toBe('monthYear');
    expect(autoDateFormat([new Date(2015, 0, 1), new Date(2015, 0, 8)])).toBe('monthDay');
    expect(autoDateFormat([new Date(2015, 0, 1, 0), new Date(2015, 0, 1, 6)])).toBe('dateTime');
  });

  it('renders month names in the report language', () => {
    expect(formatDates(monthly, 'monthYear', EN)[0]).toMatch(/Jan/);
    expect(formatDates(monthly, 'monthYear', DE)[2]).toMatch(/Mär|Mrz/);
  });

  it('pins the granularity when asked', () => {
    expect(formatDates(monthly, 'year', EN)).toEqual(['2015', '2015', '2015']);
  });
});

describe('rendered axes', () => {
  it('a compact y axis shortens the numbers', () => {
    const data = Array.from({ length: 10 }, (_, i) => ({ x: i, y: i * 400000 }));
    const svg = ggpbi().data(data).aes({ x: 'x', y: 'y' }).geom('point')
      .scale({ y: { labels: 'compact' } })
      .size(800, 600).renderTo(container());
    const labels = [...svg.querySelectorAll('.ggpbi-axis-y .tick text')].map(t => t.textContent);
    expect(labels.some(l => /M|K/.test(l ?? ''))).toBe(true);
    expect(labels.every(l => !/000000/.test(l ?? ''))).toBe(true);
  });

  it('a time axis follows the locale instead of d3 English defaults', () => {
    const data = Array.from({ length: 24 }, (_, i) => ({
      t: new Date(2015, i, 1), y: i,
    }));
    const svg = ggpbi().data(data).aes({ x: 't', y: 'y' }).geom('line')
      .format({ locale: 'de-DE' })
      .size(800, 600).renderTo(container());
    const labels = [...svg.querySelectorAll('.ggpbi-axis-x .tick text')].map(t => t.textContent ?? '');
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.some(l => /Mär|Mai|Okt|Dez|20\d\d/.test(l))).toBe(true);
  });

  it('a pinned date format wins over the automatic one', () => {
    const data = Array.from({ length: 24 }, (_, i) => ({ t: new Date(2015, i, 1), y: i }));
    const svg = ggpbi().data(data).aes({ x: 't', y: 'y' }).geom('line')
      .scale({ x: { dateLabels: 'year' } })
      .size(800, 600).renderTo(container());
    const labels = [...svg.querySelectorAll('.ggpbi-axis-x .tick text')].map(t => t.textContent ?? '');
    expect(labels.every(l => /^\d{4}$/.test(l))).toBe(true);
  });
});
