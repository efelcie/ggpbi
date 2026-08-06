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
    // German uses its own suffix, not a translated "M".
    expect(formatCompact([1200000], DE)[0]).toMatch(/Mio/);
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
