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

  // The epsilon absorbs binary noise: 13.0 - 12.9 is 0.0999…96, whose
  // log10 floors to -2 and would buy a spurious extra decimal.
  let p = Math.pow(10, Math.floor(Math.log10(smallestDiff) + 1e-9) - 1);
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
 * The power of ten `Intl`'s compact notation divides `v` by in `locale`:
 * 1e6 for "7.5M", 1e3 for "450K", 1 for "0" or "120". German has no short
 * form for thousands and Indian English counts in lakh (1e5) — asking
 * `Intl` keeps those rules.
 */
function compactScale(v: number, probe: Intl.NumberFormat): number {
  if (v === 0 || !Number.isFinite(v)) return 1;
  let digits = '';
  for (const part of probe.formatToParts(v)) {
    if (part.type === 'integer') digits += part.value;
    else if (part.type === 'decimal') digits += '.';
    else if (part.type === 'fraction') digits += part.value;
  }
  const shown = Math.abs(Number(digits));
  if (!Number.isFinite(shown) || shown === 0) return 1;
  return Math.pow(10, Math.round(Math.log10(Math.abs(v) / shown)));
}

/**
 * Short scale: 1.2M, 450K — R's
 * `scales::label_number(scale_cut = cut_short_scale())`, with the locale's
 * own suffixes ("1,2 Mio." in German) from `Intl`'s compact notation.
 *
 * Each value gets its own unit, and the decimals come from the breaks
 * like `scales::precision()`: computed per unit, so every label of the
 * same unit carries the same decimals — "7.0M" next to "7.5M", and
 * "1.29M … 1.33M" on a narrow range instead of five times "1.3M". Exact
 * zeros are not scaled and share the group of the unscaled values, as in
 * scales' `scale_cut()`.
 */
export function formatCompact(breaks: number[], opts: FormatOptions = {}): string[] {
  let probe: Intl.NumberFormat;
  try {
    // Latin digits so the probe can be parsed back; the unit choice is the same.
    probe = new Intl.NumberFormat(opts.locale, {
      notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 20, numberingSystem: 'latn',
    });
  } catch {
    probe = new Intl.NumberFormat(undefined, {
      notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 20, numberingSystem: 'latn',
    });
  }
  const scales = breaks.map(v => compactScale(v, probe));

  // Decimals per unit group, like scales' stats::ave(x * scale, scale, FUN = precision).
  const groups = new Map<number, number[]>();
  breaks.forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    const scaled = v / scales[i];
    const group = groups.get(scales[i]);
    if (group) group.push(scaled);
    else groups.set(scales[i], [scaled]);
  });
  // One deliberate departure from scales: a label never misstates its
  // break. scales gives a lone value in its unit no decimals, so breaks
  // 0 and 2.5M (a flat facet panel) read "0" and "2M"; here the group keeps
  // the decimals its values need (up to three).
  const exactDecimals = (v: number): number => {
    for (let d = 0; d < 3; d++) {
      const f = Math.pow(10, d);
      if (Math.abs(Math.round(v * f) / f - v) < 1e-9 * Math.max(1, Math.abs(v))) return d;
    }
    return 3;
  };
  const decimalsOf = new Map<number, number>();
  for (const [scale, values] of groups) {
    decimalsOf.set(scale, Math.max(breakDecimals(values), ...values.map(exactDecimals)));
  }

  const formatters = new Map<number, Intl.NumberFormat>();
  const formatterFor = (decimals: number): Intl.NumberFormat => {
    let nf = formatters.get(decimals);
    if (!nf) {
      nf = intl(opts.locale, {
        notation: 'compact',
        compactDisplay: 'short',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      formatters.set(decimals, nf);
    }
    return nf;
  };
  return breaks.map((v, i) => formatterFor(decimalsOf.get(scales[i]) ?? 0).format(v));
}

/** A fixed display unit for every label of an axis. */
export type LabelUnit = 'none' | 'thousands' | 'millions' | 'billions';

const UNIT_SCALE: Record<Exclude<LabelUnit, 'none'>, number> = {
  thousands: 1e3,
  millions: 1e6,
  billions: 1e9,
};
const UNIT_FALLBACK: Record<Exclude<LabelUnit, 'none'>, string> = {
  thousands: 'K',
  millions: 'M',
  billions: 'B',
};

/**
 * The locale's short suffix for a unit, as `Intl` writes it after the
 * number ("M", " Mio.", "L" …). Falls back to K/M/B where the locale has
 * no short form (German thousands).
 */
function unitSuffix(unit: Exclude<LabelUnit, 'none'>, locale?: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, { notation: 'compact', compactDisplay: 'short' })
      .formatToParts(UNIT_SCALE[unit]);
    const i = parts.findIndex(p => p.type === 'compact');
    if (i >= 0) {
      // Keep the literal between number and suffix (German "1 Mio.").
      const before = i > 0 && parts[i - 1].type === 'literal' ? parts[i - 1].value : '';
      // Only when the locale's unit is the one asked for: "1K" for 1e3,
      // not "10L" for a lakh-counting locale.
      const integer = parts.filter(p => p.type === 'integer').map(p => p.value).join('');
      if (integer === '1') return before + parts[i].value;
    }
  } catch {
    // unknown locale — fall through
  }
  return UNIT_FALLBACK[unit];
}

/**
 * Every label in one fixed unit — Power BI's display units, R's
 * `label_number(scale = 1e-6, suffix = "M")`: 0, 500 M, 1.5 B read "0M",
 * "500M", "1,500M". Decimals come from the scaled breaks; `grouping`
 * adds the locale's separators ("1,500M").
 */
export function formatInUnit(
  breaks: number[],
  unit: Exclude<LabelUnit, 'none'>,
  opts: FormatOptions = {},
  grouping = false,
): string[] {
  const scale = UNIT_SCALE[unit];
  const scaled = breaks.map(v => v / scale);
  const decimals = breakDecimals(scaled);
  const nf = intl(opts.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouping,
  });
  const suffix = unitSuffix(unit, opts.locale);
  return scaled.map(v => nf.format(v) + suffix);
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
