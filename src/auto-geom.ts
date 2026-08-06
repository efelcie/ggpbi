/**
 * Auto-Geom Selection — ggplot2-style automatic geometry choice.
 *
 * When no geom is explicitly set, ggpbi picks the best chart type
 * based on the scale levels (numeric, time, categorical) of the
 * mapped aesthetics. This mirrors ggplot2's qplot()/autoplot() behavior.
 */

import type { DataPoint, AesMapping, GeomConfig } from './types';

/**
 * Scale level of a data field — determines which geoms make sense.
 *
 * - numeric:     continuous numbers (integer, double, decimal)
 * - time:        Date/DateTime values
 * - categorical: text, boolean, or other discrete values
 */
export type ScaleLevel = 'numeric' | 'time' | 'categorical';

/**
 * Infer the scale level of a field from data values.
 *
 * Samples the first non-null value to determine the type.
 * This is intentionally simple — ggplot2 does the same via
 * is.numeric() / is.Date() / is.factor().
 */
export function inferScaleLevel(data: DataPoint[], field: string): ScaleLevel {
  for (const d of data) {
    const v = d[field];
    if (v === null || v === undefined) continue;

    if (v instanceof Date) return 'time';

    // Power BI sometimes delivers numeric fields as strings when they are used
    // as Grouping ("Don't summarize"). ggplot2 treats those as numeric if they
    // are parseable, so we do the same.
    if (typeof v === 'number') return 'numeric';
    if (typeof v === 'string') {
      const s = v.trim();
      if (s !== '' && Number.isFinite(Number(s))) return 'numeric';
    }

    return 'categorical';
  }
  return 'categorical';
}

/**
 * Auto-Geom selection matrix.
 *
 * | x             | y           | Auto-Geom      | Reason                     |
 * |---------------|-------------|----------------|----------------------------|
 * | —             | numeric     | boxplot        | Distribution overview      |
 * | —             | categorical | bar (horiz.)   | stat_count over y          |
 * | categorical   | —           | bar            | stat_count                 |
 * | categorical   | numeric     | bar            | Category + value (identity)|
 * | numeric       | —           | histogram      | stat_bin (30 bins default) |
 * | numeric       | numeric     | point          | Scatter                    |
 * | numeric       | categorical | bar (horiz.)   | One row per category       |
 * | numeric       | categorical | point          | Strip plot (multiple rows) |
 * | time          | numeric     | line           | Time series                |
 * | time          | categorical | point          | Strip plot over time       |
 * | time          | —           | bar            | Fallback                   |
 * | —             | —           | point          | Fallback (needs data)      |
 */
export function inferGeom(data: DataPoint[], aes: AesMapping): GeomConfig {
  const hasX = !!aes.x;
  const hasY = !!aes.y;

  const xLevel = hasX ? inferScaleLevel(data, aes.x!) : undefined;
  const yLevel = hasY ? inferScaleLevel(data, aes.y!) : undefined;

  // No x, only y (numeric) → boxplot (distribution overview)
  if (!hasX && hasY && yLevel === 'numeric') {
    return { type: 'boxplot' };
  }

  // No x, only y (categorical) → horizontal count bars
  if (!hasX && hasY && yLevel === 'categorical') {
    return { type: 'bar', orientation: 'y' };
  }

  // Only x, no y → counting geom
  if (hasX && !hasY) {
    // Numeric x → histogram (stat_bin); categorical/time → bar (stat_count)
    if (xLevel === 'numeric') {
      return { type: 'histogram' };
    }
    return { type: 'bar' };
  }

  // Both x and y
  if (hasX && hasY) {
    // Time + numeric → line (time series)
    if (xLevel === 'time' && yLevel === 'numeric') {
      return { type: 'line' };
    }
    // Numeric + numeric → scatter
    if (xLevel === 'numeric' && yLevel === 'numeric') {
      return { type: 'point' };
    }
    // Categorical + numeric → bar (stat auto-detects identity when y is mapped)
    if (xLevel === 'categorical' && yLevel === 'numeric') {
      return { type: 'bar' };
    }
    // Categorical + categorical → bar (stat_count)
    if (xLevel === 'categorical') {
      return { type: 'bar' };
    }
    // Numeric + categorical y: one row per category → horizontal value
    // bars (mirror of "categorical x + numeric y → bar"); multiple rows
    // per category → strip plot on a band y axis.
    if (xLevel === 'numeric' && yLevel === 'categorical') {
      const yVals = data.map(d => d[aes.y!]).filter(v => v != null);
      const unique = new Set(yVals.map(String));
      if (unique.size === yVals.length) {
        return { type: 'bar', orientation: 'y' };
      }
      return { type: 'point' };
    }
    // Time + categorical y → strip plot (points on a band y axis)
    if (yLevel === 'categorical') {
      return { type: 'point' };
    }
    // Time + other → bar (fallback)
    if (xLevel === 'time') {
      return { type: 'bar' };
    }
  }

  // Fallback
  return { type: 'point' };
}
