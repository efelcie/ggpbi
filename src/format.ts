/**
 * Axis label formatting (#242) — R's scales package, locale-aware.
 *
 * Two problems this solves. First, `1200000` on a revenue axis is the
 * most common formatting complaint in business reports; `1.2M` is what
 * people expect. Second, and more quietly wrong: ggpbi formatted every
 * number the JavaScript way, so an Austrian report showed `1234.5` where
 * it must read `1234,5`, and time axes carried English month names.
 *
 * Everything here goes through `Intl`, so the host's locale decides the
 * decimal mark, the group separator, the compact suffixes ("1,2 Mio."
 * in German) and the month names.
 */

/** Options every formatter shares. Locale defaults to the runtime's. */
export interface FormatOptions {
  /** BCP 47 tag from the host, e.g. "de-AT". */
  locale?: string;
  /** ISO 4217 code for `currency` formatting, e.g. "EUR". */
  currency?: string;
}

/**
 * How many decimals the break sequence needs.
 *
 * R's `scales::precision()`: the accuracy that still distinguishes
 * adjacent breaks, coarsened by one digit when every value ends in a
 * zero at that accuracy. Kept here rather than imported from breaks.ts
 * so the formatters do not depend on the break generator.
 */
export function breakDecimals(breaks: number[]): number {
  const unique = [...new Set(breaks.filter(Number.isFinite))];
  // A single break carries no spacing to infer from; show it whole, the
  // way scales::precision() does.
  if (unique.length <= 1) return 0;

  unique.sort((a, b) => a - b);
  let smallestDiff = Infinity;
  for (let i = 1; i < unique.length; i++) {
    const d = unique[i] - unique[i - 1];
    if (d > 0 && d < smallestDiff) smallestDiff = d;
  }
  if (smallestDiff < Math.sqrt(Number.EPSILON)) return 1;

  let p = Math.pow(10, Math.floor(Math.log10(smallestDiff)) - 1);
  if (unique.every(v => Math.round(v / p) % 10 === 0)) p *= 10;
  p = Math.min(p, 1);

  return Math.max(0, -Math.floor(Math.log10(p)));
}

function intl(locale: string | undefined, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  // An unknown locale tag or a currency code that is not three letters
  // must not take the chart down — a wrong-looking axis beats none.
  const safe: Intl.NumberFormatOptions =
    opts.style === 'currency' && !/^[A-Za-z]{3}$/.test(opts.currency ?? '')
      ? { ...opts, style: 'decimal', currency: undefined }
      : opts;
  try {
    const nf = new Intl.NumberFormat(locale, safe);
    nf.format(0); // some engines only reject an unsupported currency here
    return nf;
  } catch {
    return new Intl.NumberFormat(undefined, {
      ...safe, style: safe.style === 'currency' ? 'decimal' : safe.style, currency: undefined,
    });
  }
}

/**
 * Plain numbers, minimal decimals, no group separators — ggplot2's look,
 * but with the locale's decimal mark so German axes read "12,5".
 */
export function formatPlain(breaks: number[], opts: FormatOptions = {}): string[] {
  const decimals = breakDecimals(breaks);
  const nf = intl(opts.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: false,
  });
  return breaks.map(v => nf.format(v));
}

/** Group separators: 1,200,000 — or 1.200.000, depending on the locale. */
export function formatThousands(breaks: number[], opts: FormatOptions = {}): string[] {
  const decimals = breakDecimals(breaks);
  const nf = intl(opts.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  });
  return breaks.map(v => nf.format(v));
}

/**
 * Short scale: 1.2M, 450K. `Intl`'s compact notation carries the locale's
 * own suffixes, so German gets "1,2 Mio." rather than a translated "M".
 */
export function formatCompact(breaks: number[], opts: FormatOptions = {}): string[] {
  const nf = intl(opts.locale, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  });
  return breaks.map(v => nf.format(v));
}

/** Currency with the locale's own symbol placement and spacing. */
export function formatCurrency(breaks: number[], opts: FormatOptions = {}): string[] {
  const decimals = Math.min(breakDecimals(breaks), 2);
  const nf = intl(opts.locale, {
    style: 'currency',
    currency: opts.currency || 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return breaks.map(v => nf.format(v));
}

/** Percent: the value is a fraction, so 0.05 becomes 5 %. */
export function formatPercent(breaks: number[], opts: FormatOptions = {}): string[] {
  const scaled = breaks.map(v => v * 100);
  const decimals = breakDecimals(scaled);
  const nf = intl(opts.locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return breaks.map(v => nf.format(v));
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * Named date formats. `auto` keeps whatever the tick generator chose,
 * which is d3's calendar-aware default — the others pin the granularity
 * when a report needs "2015" or "Mär 2015" regardless of zoom.
 */
export type DateFormat = 'auto' | 'year' | 'monthYear' | 'monthDay' | 'date' | 'dateTime';

const DATE_OPTIONS: Record<Exclude<DateFormat, 'auto'>, Intl.DateTimeFormatOptions> = {
  year: { year: 'numeric' },
  monthYear: { year: 'numeric', month: 'short' },
  monthDay: { month: 'short', day: 'numeric' },
  date: { year: 'numeric', month: '2-digit', day: '2-digit' },
  dateTime: { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' },
};

/**
 * Pick the granularity d3 would, but render it through `Intl` so the
 * month names follow the locale.
 *
 * The step between ticks decides: sub-daily → time, within a month →
 * day and month, within a couple of years → month and year, else year.
 */
export function autoDateFormat(ticks: Date[]): Exclude<DateFormat, 'auto'> {
  if (ticks.length < 2) return 'date';
  const step = Math.abs(ticks[1].getTime() - ticks[0].getTime());
  const DAY = 86400000;
  if (step < DAY) return 'dateTime';
  if (step < 28 * DAY) return 'monthDay';
  if (step < 300 * DAY) return 'monthYear';
  return 'year';
}

/** Format date ticks for an axis. */
export function formatDates(
  ticks: Date[],
  format: DateFormat = 'auto',
  opts: FormatOptions = {},
): string[] {
  const resolved = format === 'auto' ? autoDateFormat(ticks) : format;
  let df: Intl.DateTimeFormat;
  try {
    df = new Intl.DateTimeFormat(opts.locale, DATE_OPTIONS[resolved]);
  } catch {
    df = new Intl.DateTimeFormat(undefined, DATE_OPTIONS[resolved]);
  }
  return ticks.map(d => df.format(d));
}
