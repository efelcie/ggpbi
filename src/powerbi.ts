/**
 * Power BI DataView integration
 * Converts Power BI DataView to ggpbi internal data format
 */

import type { DataPoint } from './types';

/**
 * Minimal Power BI DataView types (subset needed for ggpbi)
 * These mirror the actual Power BI SDK types
 */
export interface DataViewCategoryColumn {
  source: {
    displayName: string;
    queryName?: string;
    type?: any;
  };
  values: any[];
  identity?: any[];
}

export interface DataViewValueColumn {
  source: {
    displayName: string;
    queryName?: string;
    roles?: { [key: string]: boolean };
    groupName?: string | number | boolean | null;
  };
  values: (number | null)[];
}

export interface DataViewValueColumns extends Array<DataViewValueColumn> {
  source?: any;
}

export interface DataViewCategorical {
  categories?: DataViewCategoryColumn[];
  values?: DataViewValueColumns;
}

export interface DataView {
  categorical?: DataViewCategorical;
  metadata?: {
    columns?: any[];
    objects?: Record<string, any>;
  };
}

export interface ConversionOptions {
  /**
   * Map Power BI field names to ggpbi aesthetic properties
   * E.g., { "Date": "x", "Sales": "y", "Region": "color" }
   */
  fieldMapping?: Record<string, string>;

  /**
   * Map Power BI data role names to ggpbi aesthetic property names.
   * Uses `source.roles` on value columns to determine assignment.
   * E.g., { xAxis: "x_num", yAxis: "y1", yAxis2: "y2", sizeField: "size", labelField: "label" }
   *
   * When provided, value columns are mapped by their role instead of by display name.
   */
  roleMapping?: Record<string, string>;

  /**
   * If true, use display names instead of query names for field keys
   * Default: true
   */
  useDisplayNames?: boolean;

  /**
   * Roles where multiple fields get numbered suffixes (e.g. y→y1, y2).
   * Other roles with duplicates are also auto-numbered.
   */
  numberedRoles?: Set<string>;

  /**
   * Optional factory that creates a Power BI SelectionId for each category row.
   * When provided, each DataPoint gets a `__selectionId` property for cross-filtering.
   */
  createSelectionId?: (categoryIndex: number) => any;
}

/**
 * Convert Power BI DataView (categorical) to ggpbi Data format
 * 
 * @example
 * ```typescript
 * const dataView = options.dataViews[0]; // from Power BI update()
 * const data = fromDataView(dataView, {
 *   fieldMapping: { "Date": "x", "Sales": "y", "Region": "color" }
 * });
 * ```
 */
/**
 * Resolve the output key for a value column.
 * If roleMapping is provided, uses source.roles to find the mapped name.
 * Otherwise falls back to fieldMapping or display/query name.
 */
function resolveValueKey(
  valCol: DataViewValueColumn,
  roleMapping: Record<string, string> | undefined,
  fieldMapping: Record<string, string>,
  useDisplayNames: boolean,
): string {
  // Role-based mapping: check source.roles against roleMapping
  if (roleMapping && valCol.source.roles) {
    for (const roleName of Object.keys(valCol.source.roles)) {
      if (valCol.source.roles[roleName] && roleMapping[roleName]) {
        return roleMapping[roleName];
      }
    }
  }

  // Fallback: field name mapping
  const fieldName = useDisplayNames
    ? valCol.source.displayName
    : valCol.source.queryName || valCol.source.displayName;
  return fieldMapping[fieldName] || fieldName;
}

/**
 * Pre-compute a unique output key for each value column.
 * Roles listed in numberedRoles always get a numeric suffix (y→y1, y2).
 * Other roles that appear only once keep their base name; if they appear
 * multiple times they also get numbered.
 */
function buildValueKeys(
  values: DataViewValueColumn[],
  roleMapping: Record<string, string> | undefined,
  numberedRoles: Set<string>,
  fieldMapping: Record<string, string>,
  useDisplayNames: boolean,
): string[] {
  // First pass: resolve base key per column and count role occurrences
  const baseKeys: string[] = [];
  const roleSources: (string | null)[] = []; // which role produced this key
  const roleCount: Record<string, number> = {};

  for (const valCol of values) {
    let roleName: string | null = null;
    if (roleMapping && valCol.source.roles) {
      for (const rn of Object.keys(valCol.source.roles)) {
        if (valCol.source.roles[rn] && roleMapping[rn]) {
          roleName = rn;
          break;
        }
      }
    }
    roleSources.push(roleName);

    if (roleName && roleMapping) {
      const base = roleMapping[roleName];
      baseKeys.push(base);
      roleCount[roleName] = (roleCount[roleName] || 0) + 1;
    } else {
      baseKeys.push(resolveValueKey(valCol, roleMapping, fieldMapping, useDisplayNames));
    }
  }

  // Second pass: apply numbering
  const roleIdx: Record<string, number> = {};
  const keys: string[] = [];
  for (let i = 0; i < values.length; i++) {
    const roleName = roleSources[i];
    if (roleName && roleMapping) {
      const needsNumber = numberedRoles.has(roleName) || (roleCount[roleName] > 1);
      if (needsNumber) {
        roleIdx[roleName] = (roleIdx[roleName] || 0) + 1;
        keys.push(`${baseKeys[i]}${roleIdx[roleName]}`);
      } else {
        keys.push(baseKeys[i]);
      }
    } else {
      keys.push(baseKeys[i]);
    }
  }
  return keys;
}

export function fromDataView(
  dataView: DataView,
  options: ConversionOptions = {}
): DataPoint[] {
  const { fieldMapping = {}, roleMapping, useDisplayNames = true, createSelectionId } = options;
  const numberedRoles = options.numberedRoles ?? new Set<string>();

  if (!dataView.categorical) {
    throw new Error('ggpbi: DataView must have categorical data');
  }

  const categorical = dataView.categorical;
  const categories = categorical.categories || [];
  const values: DataViewValueColumns = categorical.values || ([] as unknown as DataViewValueColumns);

  // Determine row count.
  // Power BI usually keeps category/value column lengths aligned, but during
  // interactive field changes we can temporarily see mismatched lengths.
  // Using max() makes updates more stable and avoids rendering "empty".
  const rowCount = Math.max(
    0,
    ...categories.map(c => c.values.length),
    ...Array.from(values).map(v => (v?.values?.length ?? 0)),
  );

  if (rowCount === 0) {
    return [];
  }

  // Detect series grouping: when values are grouped by a series field,
  // DataViewValueColumns.source contains the grouping column metadata
  // and each value column has source.groupName for the series value.
  const seriesSource = values.source;
  // Power BI may still populate values.source (series metadata) even when there
  // are *no* value columns (e.g. raw Y in categories with "Don't summarize").
  // Treat as grouped only when we actually have value columns.
  const isGrouped = !!seriesSource && values.length > 0;

  const rows: DataPoint[] = [];

  if (isGrouped) {
    // Grouped by series: create N×M rows (categories × series groups)
    const seriesFieldName = useDisplayNames
      ? seriesSource.displayName
      : seriesSource.queryName || seriesSource.displayName;
    const mappedSeriesName = fieldMapping[seriesFieldName] || seriesFieldName;

    // Group value columns by series group name, collect all measures per group
    const groupMap = new Map<string | number | boolean | null, DataViewValueColumn[]>();
    for (const valCol of values) {
      const gn = valCol.source.groupName ?? null;
      if (!groupMap.has(gn)) groupMap.set(gn, []);
      groupMap.get(gn)!.push(valCol);
    }

    // Pre-compute keys per group so each group numbers independently
    const groups = Array.from(groupMap.entries()).map(([groupName, groupCols]) => ({
      groupName,
      groupCols,
      groupKeys: buildValueKeys(groupCols, roleMapping, numberedRoles, fieldMapping, useDisplayNames),
    }));

    // IMPORTANT: iterate rows (categories) first, then series groups.
    // This preserves the category order exactly as Power BI delivers it
    // (incl. native sort). If we iterate groups first, the first-seen category
    // order becomes dependent on group ordering and can scramble the axis.
    for (let i = 0; i < rowCount; i++) {
      for (const grp of groups) {
        const row: Record<string, any> = {};

        // Category columns
        for (const cat of categories) {
          const fieldName = useDisplayNames
            ? cat.source.displayName
            : cat.source.queryName || cat.source.displayName;
          row[fieldMapping[fieldName] || fieldName] = cat.values[i];
        }

        // All value columns in this group (multiple measures per series group)
        for (let gi = 0; gi < grp.groupCols.length; gi++) {
          row[grp.groupKeys[gi]] = grp.groupCols[gi].values[i];
        }

        // Series group
        row[mappedSeriesName] = grp.groupName;

        if (createSelectionId) {
          row.__selectionId = createSelectionId(i);
        }

        rows.push(row);
      }
    }
  } else {
    // Pre-compute keys with numbering support
    const valueKeys = buildValueKeys(
      values as unknown as DataViewValueColumn[],
      roleMapping, numberedRoles, fieldMapping, useDisplayNames,
    );

    // No series grouping: one row per category value
    for (let i = 0; i < rowCount; i++) {
      const row: Record<string, any> = {};

      for (const cat of categories) {
        const fieldName = useDisplayNames
          ? cat.source.displayName
          : cat.source.queryName || cat.source.displayName;
        row[fieldMapping[fieldName] || fieldName] = cat.values[i];
      }

      for (let vi = 0; vi < values.length; vi++) {
        row[valueKeys[vi]] = values[vi].values[i];
      }

      if (createSelectionId) {
        row.__selectionId = createSelectionId(i);
      }

      rows.push(row);
    }
  }

  return rows;
}

/** Default role mapping for ggpbi aesthetic data roles.
 *  Roles listed in `numberedRoles` get an index suffix (y→y1, y2) when
 *  the user drags multiple fields to the same well.
 *  All other roles map 1-to-1.
 */
export const DEFAULT_ROLE_MAPPING: Record<string, string> = {
  x: 'x',
  y: 'y',
  size: 'size',
  label: 'label',
  tooltip: 'tooltip',
};

/**
 * Decide how the Label well binds when its column may ALSO serve another
 * categorical role (Color, X, Detail, raw Y). Remapping a shared column to
 * the synthetic 'label' field would steal it from the other role ("name in
 * Color and Label" broke colour binding) — bind aes.label to the shared
 * field name directly instead.
 */
export function resolveLabelBinding(
  labelFieldName: string | undefined,
  otherCategoryFields: Array<string | undefined>,
): { remap: boolean; aesLabel?: string } {
  if (!labelFieldName) return { remap: false };
  const shared = otherCategoryFields.some(f => f !== undefined && f === labelFieldName);
  return shared
    ? { remap: false, aesLabel: labelFieldName }
    : { remap: true, aesLabel: 'label' };
}

/**
 * Restore display-name aliases for dual-role category columns.
 *
 * fromDataView keys each category column under exactly one name. When a
 * column is remapped to a synthetic key (raw Y → yRaw1, Detail → 'detail')
 * but ANOTHER role binds the same column by its display name (Color, Facet,
 * a shared Label), that aesthetic would point at a field that no longer
 * exists ("Branche in Y and Color" crashed the visual). Copy the value back
 * under the display name so both bindings see real data.
 */
export function restoreSharedFieldAliases(
  rows: DataPoint[],
  fieldMapping: Record<string, string>,
  boundByDisplayName: Array<string | undefined>,
): void {
  const names = new Set(
    boundByDisplayName.filter((n): n is string => !!n && fieldMapping[n] !== undefined),
  );
  for (const name of names) {
    const key = fieldMapping[name];
    for (const row of rows) {
      row[name] = row[key];
    }
  }
}

/**
 * Classify a DataView that has measures but no category columns.
 * A measure in X and no Y at all is 'x-only' — the value renders as a
 * horizontal strip against a synthesized single y group. Anything else
 * with values is 'y-only' (the classic distribution-against-pseudo-x
 * path). Null when categories exist or there are no values.
 *
 * Treating x-only as y-only bound aes.y to the measure's display name —
 * a field the converter never wrote ("Sum of X is missing from the data").
 */
/**
 * Row cap requested in `capabilities.json`
 * (`dataViewMappings[0].categorical.categories.dataReductionAlgorithm`).
 * Kept in sync by `tests/capabilities-sync.test.ts`.
 */
export const DATA_REDUCTION_CAP = 30000;

/**
 * Did the host hand over only part of the data?
 *
 * Power BI reduces large results before the visual sees them, and says so
 * in two ways. `metadata.segment` is the explicit signal — set whenever
 * the DataView is one segment of a larger set. Hitting the cap exactly is
 * the fallback: a segment marker is not guaranteed on every host build,
 * and landing on precisely 30 000 rows by chance is not worth the silence.
 *
 * A chart drawn from a sample must never pass for a chart drawn from
 * everything, so this errs towards saying something.
 */
export function isDataTruncated(
  dataView: { metadata?: { segment?: unknown } } | undefined,
  rowCount: number,
  cap: number = DATA_REDUCTION_CAP,
): boolean {
  if (dataView?.metadata?.segment != null) return true;
  return rowCount >= cap;
}

export function resolveSoloMeasureMode(opts: {
  hasCategories: boolean;
  hasValues: boolean;
  xMeasures: number;
  yFields: number;
}): 'x-only' | 'y-only' | null {
  if (opts.hasCategories || !opts.hasValues) return null;
  return opts.xMeasures > 0 && opts.yFields === 0 ? 'x-only' : 'y-only';
}

/**
 * Parse the Reference Lines card's position input into data-space values.
 *
 * Accepts a comma-separated list of numbers and the keywords `mean` and
 * `median`, which are computed from the given field of the bound data —
 * "draw the average" without a DAX measure. Unparsable entries are
 * skipped rather than failing the render.
 */
export function resolveReferencePositions(
  input: string | undefined,
  data: DataPoint[],
  field: string | undefined,
): number[] {
  const text = String(input ?? '').trim();
  if (text === '') return [];

  // null/'' must be dropped BEFORE Number(): Number(null) is 0, which
  // would pull an average towards zero for every empty cell.
  const values = field
    ? data
        .filter(d => d[field] != null && d[field] !== '')
        .map(d => Number(d[field]))
        .filter(v => Number.isFinite(v))
        .sort((a, b) => a - b)
    : [];

  const out: number[] = [];
  for (const rawPart of text.split(',')) {
    const part = rawPart.trim().toLowerCase();
    if (part === '') continue;
    if (part === 'mean' || part === 'avg' || part === 'average') {
      if (values.length > 0) out.push(values.reduce((a, b) => a + b, 0) / values.length);
    } else if (part === 'median') {
      if (values.length > 0) {
        const mid = values.length >> 1;
        out.push(values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2);
      }
    } else {
      const n = Number(part);
      if (Number.isFinite(n)) out.push(n);
    }
  }
  return out;
}

/** Roles where multiple fields should be numbered (y→y1, y2). */
export const NUMBERED_ROLES: Set<string> = new Set(['y']);

/**
 * Read ggpbi-specific objects from DataView metadata.
 *
 * Power BI delivers visual.json `objects` via `dataView.metadata.objects`.
 * This helper extracts geom type, style, and scale config with type safety.
 *
 * @example
 * ```typescript
 * const objs = getObjects(dataView);
 * // objs.geomType → 'point' | 'line' | 'bar' | ...
 * // objs.alpha    → 0.7
 * // objs.size     → 3
 * // objs.scaleX   → 'time'
 * // objs.scaleY   → 'linear'
 * ```
 */
export interface GgpbiObjects {
  geomType: string;
  alpha?: number;
  size?: number;
  color?: string;
  fill?: string;
  scaleX?: string;
  scaleY?: string;
  xLabel?: string;
  yLabel?: string;
  showLegend?: boolean;
  panelFill?: string;
  gridlineColor?: string;
  ink?: string;
  paper?: string;
  baseSize?: number;
}

/**
 * Resolve a color value from PBI metadata.
 * Handles plain hex, { solid: { color } }, and ThemeDataColor expressions.
 */
export function resolveColor(val: any, palette: string[] = []): string | undefined {
  if (!val) return undefined;
  if (typeof val === 'string') return val;
  if (val?.solid?.color) return val.solid.color;
  const tdc = val?.expr?.ThemeDataColor ?? val?.ThemeDataColor;
  if (tdc && palette.length > 0) {
    const base = palette[tdc.ColorId % palette.length];
    return tdc.Percent ? adjustBrightness(base, tdc.Percent) : base;
  }
  return undefined;
}

/**
 * Adjust brightness of a hex color by a percentage (-100 to +100).
 * Positive = lighter, negative = darker.
 */
export function adjustBrightness(hex: string, percent: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const adjust = (c: number) => {
    if (percent > 0) {
      return Math.round(c + (255 - c) * (percent / 100));
    }
    return Math.round(c * (1 + percent / 100));
  };

  const nr = Math.max(0, Math.min(255, adjust(r)));
  const ng = Math.max(0, Math.min(255, adjust(g)));
  const nb = Math.max(0, Math.min(255, adjust(b)));

  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

export function getObjects(dataView: DataView, palette: string[] = []): GgpbiObjects {
  const objs: any = dataView.metadata?.objects ?? {};

  // Read geom type (defaults to 'bar' for backwards compatibility)
  const geomType: string =
    objs.geom?.type ?? 'bar';

  // Read geom style
  const alpha: number | undefined =
    objs.geomStyle?.alpha != null ? Number(objs.geomStyle.alpha) : undefined;
  const size: number | undefined =
    objs.geomStyle?.size != null ? Number(objs.geomStyle.size) : undefined;
  const color: string | undefined =
    objs.geomStyle?.color ?? undefined;
  const fill: string | undefined =
    resolveColor(objs.geomStyle?.fill, palette);

  // Read scale types ('auto' means no override)
  const rawScaleX = objs.scaleX?.type;
  const rawScaleY = objs.scaleY?.type;
  const scaleX: string | undefined =
    rawScaleX && rawScaleX !== 'auto' ? rawScaleX : undefined;
  const scaleY: string | undefined =
    rawScaleY && rawScaleY !== 'auto' ? rawScaleY : undefined;

  // Read axis labels
  const xLabel: string | undefined = objs.scaleX?.label || undefined;
  const yLabel: string | undefined = objs.scaleY?.label || undefined;

  // Read legend toggle
  const showLegend: boolean | undefined =
    objs.legend?.show != null ? Boolean(objs.legend.show) : undefined;

  // Read theme properties
  const panelFill: string | undefined =
    resolveColor(objs.theme?.panelFill, palette) ?? undefined;
  const gridlineColor: string | undefined =
    resolveColor(objs.theme?.gridlineColor, palette) ?? undefined;
  const ink: string | undefined =
    resolveColor(objs.theme?.ink, palette) ?? undefined;
  const paper: string | undefined =
    resolveColor(objs.theme?.paper, palette) ?? undefined;
  const baseSize: number | undefined =
    objs.theme?.baseSize != null ? Number(objs.theme.baseSize) : undefined;

  return { geomType, alpha, size, color, fill, scaleX, scaleY, xLabel, yLabel, showLegend, panelFill, gridlineColor, ink, paper, baseSize };
}

/**
 * Extract available field names from DataView
 * Useful for debugging or auto-mapping
 */
export function getFields(dataView: DataView): {
  categories: string[];
  values: string[];
} {
  const categorical = dataView.categorical;
  if (!categorical) {
    return { categories: [], values: [] };
  }

  const categories =
    categorical.categories?.map((c) => c.source.displayName) || [];
  const values =
    categorical.values?.map((v) => v.source.displayName) || [];

  return { categories, values };
}
