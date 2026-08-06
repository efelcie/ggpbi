/**
 * Power BI Custom Visual entry point.
 *
 * Implements IVisual: Power BI calls constructor() once,
 * then update() whenever data or viewport changes.
 *
 * Includes:
 * - Rendering Events API (required for PDF/PPT export)
 * - Landing Page (shown before data is assigned)
 * - Host color palette integration
 * - SelectionManager for cross-filtering
 * - FormattingModel API (getFormattingModel) for Format Pane
 */

// @ts-ignore — types available after SDK install
import powerbi from 'powerbi-visuals-api';
type IVisual = powerbi.extensibility.visual.IVisual;
type VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
type VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { GgpbiFormattingSettings } from './formatting-settings';
import { renderWithState } from './render';
import { fromDataView, DEFAULT_ROLE_MAPPING, NUMBERED_ROLES, resolveLabelBinding, restoreSharedFieldAliases, resolveSoloMeasureMode, resolveReferencePositions, isDataTruncated } from './powerbi';
import { inferGeom } from './auto-geom';
import { themeDark, themeMinimal, GREY_DEFAULTS } from './theme';
import { explainError } from './friendly-errors';
import type { Selection } from './selection';
import type { GeomType, GeomConfig, Layer, ScaleType, PositionType, LinetypeType, ShapeType, DataPoint } from './types';

/** Build landing page DOM — shown when no data fields are assigned. */
function createLandingPage(): DocumentFragment {
  const frag = document.createDocumentFragment();
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'height:100%;padding:24px;font-family:Segoe UI,sans-serif;color:#666;';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '48');
  svg.setAttribute('height', '48');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', '#118DFF');
  svg.setAttribute('stroke-width', '1.5');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '10');
  svg.appendChild(circle);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M8 12h8M12 8v8');
  svg.appendChild(path);
  wrapper.appendChild(svg);

  const title = document.createElement('p');
  title.style.cssText = 'margin:12px 0 4px;font-size:14px;font-weight:600;color:#333;';
  title.textContent = 'ggpbi';
  wrapper.appendChild(title);

  const desc = document.createElement('p');
  desc.style.cssText = 'margin:0;font-size:12px;text-align:center;line-height:1.5;';
  desc.textContent = 'Drag any field onto X or Y — ggpbi picks a fitting chart automatically.';
  wrapper.appendChild(desc);

  const examples = document.createElement('p');
  examples.style.cssText = 'margin:8px 0 0;font-size:11px;text-align:center;color:#999;line-height:1.6;';
  examples.textContent =
    'Measure → distribution · Category → bars · Date + measure → line. ' +
    'Add Color to split into groups; override everything in the Format Pane.';
  wrapper.appendChild(examples);

  frag.appendChild(wrapper);
  return frag;
}

/**
 * Build a notice page: icon + headline + action-oriented hint,
 * optionally with a muted technical detail line.
 */
function createNoticePage(icon: string, title: string, hint: string, detail?: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'height:100%;padding:24px;font-family:Segoe UI,sans-serif;color:#666;';

  const iconEl = document.createElement('span');
  iconEl.style.cssText = 'font-size:28px;margin-bottom:8px;';
  iconEl.textContent = icon;
  wrapper.appendChild(iconEl);

  const titleEl = document.createElement('p');
  titleEl.style.cssText = 'margin:8px 0 4px;font-size:13px;font-weight:600;color:#333;text-align:center;';
  titleEl.textContent = title;
  wrapper.appendChild(titleEl);

  const hintEl = document.createElement('p');
  hintEl.style.cssText = 'margin:0;font-size:12px;text-align:center;max-width:320px;line-height:1.5;';
  hintEl.textContent = hint;
  wrapper.appendChild(hintEl);

  if (detail) {
    const detailEl = document.createElement('p');
    detailEl.style.cssText = 'margin:10px 0 0;font-size:10px;text-align:center;max-width:320px;word-break:break-word;color:#aaa;';
    detailEl.textContent = detail;
    wrapper.appendChild(detailEl);
  }

  frag.appendChild(wrapper);
  return frag;
}

/** Shown when fields are assigned but the filter context returns no rows. */
function createEmptyDataPage(): DocumentFragment {
  return createNoticePage(
    '○',
    'No data to display',
    'The current filters return no rows for this visual. Clear or widen the report, page, or visual filters to see data again.',
  );
}

/** Build error page DOM — shown when rendering fails. */
function createErrorPage(message: string): DocumentFragment {
  const friendly = explainError(message);
  return createNoticePage('\u26A0', friendly.title, friendly.hint, message);
}

export class Visual implements IVisual {
  private container: HTMLElement;
  private host: powerbi.extensibility.visual.IVisualHost;
  private events: powerbi.extensibility.IVisualEventService;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private formattingSettingsService: FormattingSettingsService;
  private formattingSettings: GgpbiFormattingSettings;
  /** Selection instance + data of the most recent render (for restore/bookmarks). */
  private lastSelection?: Selection;
  private lastData: DataPoint[] = [];

  constructor(options: VisualConstructorOptions) {
    this.container = options.element;
    this.container.style.overflow = 'hidden';
    // NOTE: do NOT set pointer-events: none on the container. Desktop
    // testing showed the host needs clicks on the visual DOM to select
    // (and move) the visual at all — with a pass-through container the
    // visual could only be selected via its title area. Body drag-to-move
    // for custom visuals is a platform limitation, not something the
    // visual can grant.
    this.host = options.host;
    this.events = options.host.eventService;
    this.selectionManager = options.host.createSelectionManager();
    this.formattingSettingsService = new FormattingSettingsService();
    this.formattingSettings = new GgpbiFormattingSettings();

    // Bookmarks / external selection changes: re-apply the highlight when
    // Power BI restores a selection (e.g. bookmark applied, report reset).
    this.selectionManager.registerOnSelectCallback?.((ids: unknown) => {
      this.applyManagerSelection(Array.isArray(ids) ? ids : []);
    });
  }

  /** Map SelectionManager ids back to data rows and sync the visual highlight. */
  private applyManagerSelection(ids: any[]): void {
    if (!this.lastSelection) return;
    // Same comparison as Selection.managerIdKey: getKey() when available,
    // structural fallback otherwise — raw object identity fails across
    // re-renders and silently breaks highlight restore (stuck selections).
    const idKey = (id: any): unknown => {
      if (typeof id?.getKey === 'function') return id.getKey();
      try { return JSON.stringify(id); } catch { return id; }
    };
    const keys = new Set(ids.map(idKey));
    const selected = keys.size === 0 ? [] : this.lastData.filter(d => {
      const sid = (d as any).__selectionId;
      return sid != null && keys.has(idKey(sid));
    });
    this.lastSelection.syncFromExternal(selected);
  }

  public update(options: VisualUpdateOptions): void {
    // Signal render start — required for PDF/PPT export
    this.events.renderingStarted(options);

    try {
      // No categorical data? Always show landing page.
      if (
        !options.dataViews ||
        !options.dataViews[0] ||
        !options.dataViews[0].categorical
      ) {
        this.container.replaceChildren();
        this.container.appendChild(createLandingPage());
        this.events.renderingFinished(options);
        return;
      }
      const dataView = options.dataViews[0];
      const categorical = dataView.categorical!;

      // Populate formatting settings from DataView (reads persisted user values)
      this.formattingSettings = this.formattingSettingsService
        .populateFormattingSettingsModel(GgpbiFormattingSettings, dataView);

      // Update card visibility based on active layer geom types
      this.formattingSettings.updateCardVisibility();

      // Detect Y field(s) in categories (happens when "Don't summarize" is set on Y).
      // PBI converts GroupingOrMeasure fields to category columns when not aggregated.
      const yCatIndices = (categorical.categories ?? [])
        .map((c, i) => ((c.source as any).roles?.['y'] ? i : -1))
        .filter(i => i >= 0);
      const yInCategories = yCatIndices.length > 0;
      const yCatFieldNames = yInCategories
        ? yCatIndices.map(i => categorical.categories![i].source.displayName)
        : [];

      // Find X category by role (don't assume categories[0] is always X)
      const xCatIdx = categorical.categories?.findIndex(
        c => (c.source as any).roles?.['x']
      ) ?? -1;

      // Color can come either as grouped series (categorical.values.source)
      // OR as a regular category column (when we want row-level behaviour).
      const colorCatIdx = categorical.categories?.findIndex(
        c => (c.source as any).roles?.['color']
      ) ?? -1;
      const colorFieldName = colorCatIdx >= 0
        ? categorical.categories![colorCatIdx].source.displayName
        : undefined;

      const facetCatIdx = categorical.categories?.findIndex(
        c => (c.source as any).roles?.['facet']
      ) ?? -1;
      const facetFieldName = facetCatIdx >= 0
        ? categorical.categories![facetCatIdx].source.displayName
        : undefined;

      const detailCatIdx = categorical.categories?.findIndex(
        c => (c.source as any).roles?.['detail']
      ) ?? -1;
      const detailFieldName = detailCatIdx >= 0
        ? categorical.categories![detailCatIdx].source.displayName
        : undefined;

      // Size can arrive as a category column too (numeric column without
      // aggregation) — detecting it only on value columns left bubbles
      // all the same size.
      const sizeCatIdx = categorical.categories?.findIndex(
        c => (c.source as any).roles?.['size']
      ) ?? -1;
      const sizeCatFieldName = sizeCatIdx >= 0
        ? categorical.categories![sizeCatIdx].source.displayName
        : undefined;

      const labelCatIdx = categorical.categories?.findIndex(
        c => (c.source as any).roles?.['label']
      ) ?? -1;
      const labelFieldName = labelCatIdx >= 0
        ? categorical.categories![labelCatIdx].source.displayName
        : undefined;

      // Convert PBI DataView → ggpbi DataPoint[] with role-based mapping
      const mappedValues = categorical.values?.map(v => ({
        source: {
          displayName: v.source.displayName,
          roles: (v.source as any).roles as { [key: string]: boolean } | undefined,
          groupName: (v.source as { groupName?: string | number | boolean | null }).groupName,
        },
        values: v.values as (number | null)[],
      })) ?? [];

      // Build SelectionId factory: prefer Detail for row-level point identity,
      // then X, then first available category.
      const pbiCategory =
        (detailCatIdx >= 0 ? categorical.categories?.[detailCatIdx] : undefined)
        ?? (xCatIdx >= 0 ? categorical.categories?.[xCatIdx] : undefined)
        ?? categorical.categories?.[0];
      const createSelectionId = pbiCategory
        ? (index: number) =>
            this.host.createSelectionIdBuilder()
              .withCategory(pbiCategory as any, index)
              .createSelectionId()
        : undefined;

      // When Y is in categories, map its displayName(s) → yRaw1, yRaw2, ...
      // This avoids collisions with measure keys (y/y1/y2) and supports Layer 2
      // with raw (Don't summarize) Y fields.
      const catFieldMapping: Record<string, string> = {};
      if (yInCategories) {
        for (let yi = 0; yi < yCatFieldNames.length; yi++) {
          catFieldMapping[yCatFieldNames[yi]] = `yRaw${yi + 1}`;
        }
      }
      if (detailFieldName) {
        catFieldMapping[detailFieldName] = 'detail';
      }
      if (sizeCatFieldName) {
        catFieldMapping[sizeCatFieldName] = 'size';
      }
      // Same column in Label AND another well (Color/X/Detail/raw Y):
      // don't remap it to 'label' — that would steal the field from the
      // other role. aes.label binds to the shared field name instead.
      const labelBinding = resolveLabelBinding(labelFieldName, [
        colorFieldName,
        detailFieldName,
        xCatIdx >= 0 ? categorical.categories![xCatIdx].source.displayName : undefined,
        ...yCatFieldNames,
      ]);
      if (labelBinding.remap && labelFieldName) {
        catFieldMapping[labelFieldName] = 'label';
      }

      const data = fromDataView({
        categorical: {
          categories: categorical.categories?.map(c => ({
            source: { displayName: c.source.displayName },
            values: c.values as (string | number | boolean | Date | null)[],
          })),
          values: Object.assign(mappedValues, {
            source: (categorical.values as { source?: { displayName: string } } | undefined)?.source,
          }),
        },
      }, { fieldMapping: catFieldMapping, roleMapping: DEFAULT_ROLE_MAPPING, numberedRoles: NUMBERED_ROLES, createSelectionId });

      // Power BI reduces large results before we see them — say so rather
      // than presenting a sample as the whole picture.
      const isTruncated = isDataTruncated(dataView, data.length);

      // Same column in Color/Facet/Label AND a remapped role (raw Y, Detail):
      // restore the display name as an alias so those aesthetics still bind
      // ("Branche in Y and Color" must colour by Branche, not crash).
      restoreSharedFieldAliases(data, catFieldMapping, [
        colorFieldName,
        facetFieldName,
        labelBinding.remap ? undefined : labelBinding.aesLabel,
      ]);

      if (data.length === 0) {
        // Fields are assigned but the filter context yields no rows —
        // "drag fields in" would be misleading here.
        this.container.replaceChildren();
        this.container.appendChild(createEmptyDataPage());
        this.events.renderingFinished(options);
        return;
      }

      // Determine X field name (from a category column or an X measure).
      const xColumns = mappedValues.filter(v => v.source.roles?.['x']);
      let xFieldName: string;
      if (xCatIdx >= 0) {
        xFieldName = categorical.categories![xCatIdx].source.displayName;
      } else if (xColumns.length > 0) {
        // Multiple X measures are auto-numbered by the converter (x1, x2, x3)
        // and feed segment ends / point ranges; a single one stays 'x'.
        xFieldName = xColumns.length > 1 ? 'x1' : 'x';
      } else {
        // Fallback: first category that is NOT one of the Y category fields
        const nonYCat = categorical.categories?.find((_, i) =>
          !yCatIndices.includes(i) &&
          i !== detailCatIdx &&
          i !== labelCatIdx &&
          i !== colorCatIdx &&
          i !== facetCatIdx
        );
        xFieldName = nonYCat?.source.displayName ?? 'x';
      }

      // Detect which Y fields are present (via roles on value columns OR categories)
      const yColumns = mappedValues.filter(v => v.source.roles?.['y']);
      const totalYFields = yCatIndices.length + yColumns.length;
      const hasY1 = totalYFields >= 1;
      const hasSizeField = mappedValues.some(v => v.source.roles?.['size']) || sizeCatIdx >= 0;
      const hasLabelField = !!labelFieldName || mappedValues.some(v => v.source.roles?.['label']);

      // Detect if X values are numeric (scatter mode) by checking actual data
      const hasAnyCategory = (categorical.categories?.length ?? 0) > 0;
      const hasAnyValues = (categorical.values?.length ?? 0) > 0;
      const soloMode = resolveSoloMeasureMode({
        hasCategories: hasAnyCategory,
        hasValues: hasAnyValues,
        xMeasures: xColumns.length,
        yFields: totalYFields,
      });
      const isXOnlyMode = soloMode === 'x-only';
      const isYOnlyMode = soloMode === 'y-only';

      // --- Single-variable support (ggplot2-like stats) ---
      // If the user only assigns a categorical field (no measures) and Y is NOT
      // in categories (via "Don't summarize"), use stat transforms.
      // Numeric x → histogram (stat_bin in pipeline), categorical x → bar (stat_count in pipeline).
      // No manual aggregation needed — the pipeline handles it via stat_bin/stat_count.
      let singleVarNumeric = false;
      if (hasAnyCategory && !hasAnyValues && !yInCategories) {
        const xs = data
          .map(r => Number((r as any)[xFieldName]))
          .filter(v => !Number.isNaN(v));
        const uniqueX = new Set(xs);
        singleVarNumeric = xs.length > 0 && uniqueX.size >= Math.min(20, Math.floor(xs.length * 0.8));

        if (!singleVarNumeric) {
          // Categorical: stat_count aggregation (bar pipeline handles this)
          const COUNT_FIELD = '__count';
          const counts = new Map<any, number>();
          for (const row of data) {
            const key = (row as any)[xFieldName];
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
          const aggregated: any[] = [];
          for (const [key, n] of counts.entries()) {
            aggregated.push({ [xFieldName]: key, [COUNT_FIELD]: n });
          }
          data.splice(0, data.length, ...aggregated);
        }
        // Numeric: leave data as-is; stat_bin in the pipeline will bin it
      }

      // Determine Y field name for aes mapping
      // Priority:
      // 1) raw Y in categories (Don't summarize) → yRaw1
      // 2) first Y measure in values (numberedRoles always maps Y measures to y1, y2, ...)
      // 3) auto count fallback
      const firstYMeasureKey = hasAnyValues
        ? 'y1'
        : undefined;

      const yFieldName = yInCategories
        ? 'yRaw1'
        : isXOnlyMode
        ? '__all'
        : (hasY1 && firstYMeasureKey)
          ? firstYMeasureKey
          : (!hasAnyValues && hasAnyCategory && !singleVarNumeric)
            ? '__count'
            : (!hasAnyValues && hasAnyCategory && singleVarNumeric)
              ? undefined // histogram: stat_bin computes y via aesOverrides
              : categorical.values?.[0]?.source.displayName ?? 'y';

      // y-only mode (no category): synthesize a single x group so boxplot can render.
      if (isYOnlyMode) {
        const ALL_FIELD = '__all';
        xFieldName = ALL_FIELD;
        for (const row of data as any[]) {
          row[ALL_FIELD] = 'All';
        }
      }

      // x-only mode (a measure in X, nothing else): mirror image — synthesize
      // a single y group so the value renders as a horizontal strip.
      if (isXOnlyMode) {
        for (const row of data as any[]) {
          row['__all'] = 'All';
        }
      }

      // Detect series field (color grouping)
      // - grouped series: categorical.values.source (PBI series grouping)
      // - row-level color: categorical.categories contains a 'color' role column
      const seriesSource = (categorical.values as { source?: { displayName: string } } | undefined)?.source;
      const groupedSeriesName: string | undefined = (categorical.values?.length ?? 0) > 0
        ? seriesSource?.displayName
        : undefined;
      const seriesName: string | undefined = groupedSeriesName ?? colorFieldName;

      // Extract PBI host color palette so chart colors match report theme
      const hostPalette: string[] = [];
      const palette = this.host.colorPalette;
      if (palette) {
        if (groupedSeriesName) {
          const seriesValues = categorical.values?.map(
            v => (v.source as { groupName?: string | number | boolean | null }).groupName
          ).filter(Boolean) ?? [];
          const uniqueSeries = [...new Set(seriesValues)];
          for (const val of uniqueSeries) {
            const color = palette.getColor(String(val));
            if (color?.value) hostPalette.push(color.value);
          }
        } else if (colorFieldName) {
          const colorCol = categorical.categories?.[colorCatIdx];
          const unique = colorCol?.values ?? [];
          const uniqVals = [...new Set(unique.map(v => String(v)))];
          for (const val of uniqVals) {
            const c = palette.getColor(String(val));
            if (c?.value) hostPalette.push(c.value);
          }
        } else {
          const unique = categorical.categories?.[0]?.values ?? [];
          for (let i = 0; i < unique.length; i++) {
            const color = palette.getColor(String(unique[i]));
            if (color?.value) hostPalette.push(color.value);
          }
        }
      }

      // Detect high contrast mode from PBI host
      const isHighContrast = !!(palette as any)?.isHighContrast;

      // Build aes mapping
      const aesMapping: Record<string, string> = {
        x: xFieldName,
      };
      if (yFieldName) aesMapping.y = yFieldName;
      if (seriesName) aesMapping.color = seriesName;
      if (hasSizeField) aesMapping.size = 'size';
      if (hasLabelField) aesMapping.label = labelBinding.aesLabel ?? 'label';

      // Read layer settings from FormattingModel → build GeomConfig[]
      const s = this.formattingSettings;

      const extractEnum = (val: any): string =>
        typeof val === 'object' ? val?.value ?? '' : String(val ?? '');

      const extractFill = (val: any): string | undefined => {
        if (!val) return undefined;
        if (typeof val === 'object' && val?.value && val.value !== '') return val.value;
        if (typeof val === 'string' && val !== '') return val;
        return undefined;
      };

      // Y field names for each layer (up to 3).
      // We support a mix of:
      // - raw Y fields in categories (Don't summarize) → yRaw1, yRaw2, yRaw3
      // - Y measures in values → y1/y2/y3 (numbered even when only one is present)
      const yLayerKeys: string[] = [];
      if (yInCategories) {
        for (let yi = 0; yi < yCatIndices.length; yi++) yLayerKeys.push(`yRaw${yi + 1}`);
      }
      if (yColumns.length > 0) {
        for (let yi = 0; yi < yColumns.length; yi++) yLayerKeys.push(`y${yi + 1}`);
      }

      // Resolve yField setting for a layer: 'auto' → Layer N takes Y-field N (or Y1 as fallback).
      // Explicit y1/y2/y3 → override to that specific Y field.
      const resolveYField = (layerIndex: number, yFieldSetting: string): string => {
        const fallback = yLayerKeys[0] ?? yFieldName;
        if (!yFieldSetting || yFieldSetting === 'auto') {
          return yLayerKeys[layerIndex] ?? fallback;
        }
        // Explicit override: y1 → index 0, y2 → index 1, y3 → index 2
        const idx = parseInt(yFieldSetting.replace('y', ''), 10) - 1;
        return yLayerKeys[idx] ?? fallback;
      };

      const layers: Layer[] = [];
      // Per-layer resolution info for the Format Pane (layer card titles
      // show the resolved auto choice); null = layer disabled.
      const resolvedInfo: Array<{ type: string; auto: boolean } | null> = [null, null, null];
      for (let li = 0; li < s.layers.length; li++) {
        const layerSettings = s.layers[li];
        if (!layerSettings.enabled.value) continue;
        const rawLayerType = extractEnum(layerSettings.type.value);
        // 'auto' or empty → let inferGeom pick the best type
        // 'col' → 'bar' (unified: bar auto-detects stat_identity when y is mapped)
        const resolvedType = rawLayerType === 'col' ? 'bar' : rawLayerType;
        const isAutoType = !resolvedType || resolvedType === 'auto';
        const layerType: GeomType = !isAutoType
          ? resolvedType as GeomType
          : inferGeom(data, aesMapping).type;
        resolvedInfo[li] = { type: layerType, auto: isAutoType };
        const layerFill = extractFill(layerSettings.fill.value);
        const layerLinetype = extractEnum((layerSettings as any).lineStyle?.value) as LinetypeType || undefined;
        const layerPosition = extractEnum((layerSettings as any).position?.value) as PositionType || undefined;
        const layerShape = extractEnum((layerSettings as any).shape?.value) as ShapeType || undefined;
        const layerPointFill = extractFill((layerSettings as any).pointFill?.value);
        const layerStrokeWidth = (layerSettings as any).strokeWidth?.value as number | undefined;
        const layerJitterWidth = (layerSettings as any).jitterWidth?.value as number | undefined;
        const layerJitterHeight = (layerSettings as any).jitterHeight?.value as number | undefined;
        const layerLineEnd = extractEnum((layerSettings as any).lineEnd?.value) as 'butt' | 'round' | 'square' || undefined;
        const layerLineJoin = extractEnum((layerSettings as any).lineJoin?.value) as 'round' | 'miter' | 'bevel' || undefined;
        const layerArrowShow = (layerSettings as any).arrowShow?.value as boolean | undefined;
        const layerArrowEnds = extractEnum((layerSettings as any).arrowEnds?.value) as 'first' | 'last' | 'both' || undefined;
        const layerArrowType = extractEnum((layerSettings as any).arrowType?.value) as 'open' | 'closed' || undefined;
        const layerArrowLength = (layerSettings as any).arrowLength?.value as number | undefined;
        const layerArrowAngle = (layerSettings as any).arrowAngle?.value as number | undefined;
        const layerJust = (layerSettings as any).just?.value as number | undefined;
        const layerOrientation = extractEnum((layerSettings as any).orientation?.value) as 'x' | 'y' || undefined;
        const layerRepel = (layerSettings as any).repel?.value as boolean | undefined;
        const layerApplyHighlight = (layerSettings as any).applyHighlight?.value as boolean | undefined;
        const layerFilter = extractEnum((layerSettings as any).layerFilter?.value) as 'min' | 'max' | 'extremes' | 'none' | '' || undefined;
        const layerLabelTemplate = ((layerSettings as any).labelTemplate?.value as string | undefined)?.trim();

        // Per-layer aes override: resolve yField setting (auto or explicit y1/y2/y3)
        const layerYFieldSetting = extractEnum((layerSettings as any).yField?.value);
        const layerAes: Record<string, string> = {
          y: resolveYField(li, layerYFieldSetting),
        };
        if (hasSizeField) layerAes.size = 'size';

        // Range aesthetics from extra measures in the wells:
        // X well → x1 (start/centre), x2 (end/min), x3 (max) — horizontal;
        // Y well → y1 (start/centre), y2 (end/min), y3 (max) — vertical.
        if (layerType === 'segment') {
          if (xColumns.length > 1) layerAes.xend = 'x2';
          else if (yColumns.length > 1) layerAes.yend = 'y2';
        } else if (layerType === 'pointrange') {
          if (xColumns.length > 2) {
            layerAes.xmin = 'x2';
            layerAes.xmax = 'x3';
          } else if (yColumns.length > 2) {
            layerAes.ymin = 'y2';
            layerAes.ymax = 'y3';
          }
        }

        layers.push({
          geom: {
            type: layerType,
            alpha: layerSettings.alpha.value,
            // The generic Size slice defaults to 4 (the point default).
            // Passing it unconditionally forced 4px lines and unreadable
            // 4px text — only override when the user changed it, so each
            // geom keeps its own default (line 2, text 12, pointrange 1).
            ...(layerSettings.size.value !== 4 && { size: layerSettings.size.value }),
            ...(layerFill && { color: layerFill }),
            ...(layerLinetype && layerLinetype !== 'solid' && { linetype: layerLinetype }),
            ...(layerPosition && layerPosition !== 'identity' && { position: layerPosition }),
            ...(layerShape && layerShape !== 'circle' && { shape: layerShape }),
            ...(layerPointFill && { fill: layerPointFill }),
            ...(layerStrokeWidth != null && layerStrokeWidth !== 0.5 && { strokeWidth: layerStrokeWidth }),
            ...(layerJitterWidth != null && layerJitterWidth !== 0.4 && { jitterWidth: layerJitterWidth }),
            ...(layerJitterHeight != null && layerJitterHeight !== 0 && { jitterHeight: layerJitterHeight }),
            ...(layerLineEnd && layerLineEnd !== 'butt' && { lineend: layerLineEnd }),
            ...(layerLineJoin && layerLineJoin !== 'round' && { linejoin: layerLineJoin }),
            ...(layerArrowShow && { arrowShow: layerArrowShow }),
            ...(layerArrowEnds && layerArrowEnds !== 'last' && { arrowEnds: layerArrowEnds }),
            ...(layerArrowType && layerArrowType !== 'open' && { arrowType: layerArrowType }),
            ...(layerArrowLength != null && layerArrowLength !== 8 && { arrowLength: layerArrowLength }),
            ...(layerArrowAngle != null && layerArrowAngle !== 30 && { arrowAngle: layerArrowAngle }),
            ...(layerJust != null && layerJust !== 0.5 && { just: layerJust }),
            ...(layerOrientation && layerOrientation !== 'x' && { orientation: layerOrientation }),
            ...(layerRepel && { repel: true }),
            ...(layerApplyHighlight === false && { highlight: false }),
            ...(layerFilter && layerFilter !== 'none' && { filter: layerFilter }),
            ...(layerLabelTemplate && { labelTemplate: layerLabelTemplate }),
          } as GeomConfig,
          aes: layerAes,
        });
      }

      // Wire boxplot-specific settings from Format Pane into GeomConfig
      const bp = s.boxplot;
      for (const layer of layers) {
        if (layer.geom.type === 'boxplot') {
          const geom = layer.geom as import('./types').BoxplotGeomConfig;
          geom.boxCoef = bp.coef.value;
          geom.boxNotch = bp.notch.value;
          geom.boxNotchWidth = bp.notchWidth.value;
          geom.boxVarWidth = bp.varWidth.value;
          geom.boxStapleWidth = bp.stapleWidth.value;
          geom.boxFatten = bp.fatten.value;
          geom.boxOutlierShow = bp.outlierShow.value;
          geom.boxOutlierSize = bp.outlierSize.value;
          const bpWidth = bp.boxWidth.value;
          if (bpWidth != null && bpWidth !== 0.9) geom.width = bpWidth;
          const bpFill = extractFill(bp.boxFillColor.value);
          if (bpFill) geom.color = bpFill;
          const bpOutlierShape = extractEnum(bp.outlierShape.value) as ShapeType || undefined;
          if (bpOutlierShape && bpOutlierShape !== 'circle') geom.boxOutlierShape = bpOutlierShape;
        }
      }

      // Wire histogram-specific settings from Format Pane into GeomConfig
      const hist = s.histogram;
      for (const layer of layers) {
        if (layer.geom.type === 'histogram') {
          const geom = layer.geom as import('./types').HistogramGeomConfig;
          const histBins = hist.bins.value;
          if (histBins != null && histBins !== 30) geom.bins = histBins;
          const histBinwidth = hist.binwidth.value;
          if (histBinwidth != null && histBinwidth > 0) geom.binwidth = histBinwidth;
          const histBoundary = hist.boundary.value;
          if (histBoundary != null && histBoundary !== 0) geom.boundary = histBoundary;
          const histCenter = hist.center.value;
          if (histCenter != null && histCenter !== 0) geom.center = histCenter;
          const histClosed = extractEnum(hist.closed.value) as 'right' | 'left';
          if (histClosed && histClosed !== 'right') geom.closed = histClosed;
          geom.pad = hist.pad.value;
          const histDrop = extractEnum(hist.drop.value) as 'none' | 'all' | 'extremes';
          if (histDrop && histDrop !== 'none') geom.drop = histDrop;
          const histYAxis = extractEnum(hist.histYAxis.value) as 'count' | 'density' | 'ncount' | 'ndensity';
          if (histYAxis && histYAxis !== 'count') geom.yAxis = histYAxis;
          const histFill = extractFill(hist.histFillColor.value);
          if (histFill) geom.color = histFill;
          const histBorder = extractFill(hist.histBorderColor.value);
          if (histBorder) geom.stroke = histBorder;
          const histBorderWidth = hist.histBorderWidth.value;
          if (histBorderWidth != null && histBorderWidth !== 0.5) geom.strokeWidth = histBorderWidth;
          const histBorderStyle = extractEnum(hist.histBorderStyle.value) as LinetypeType;
          if (histBorderStyle && histBorderStyle !== 'solid') geom.linetype = histBorderStyle;
          const histTransparency = hist.histTransparency.value;
          if (histTransparency != null) geom.alpha = 1 - histTransparency / 100;
        }
      }

      // Wire smooth-specific settings from Format Pane into GeomConfig
      const sm = s.smooth;
      for (const layer of layers) {
        if (layer.geom.type === 'smooth') {
          const geom = layer.geom as import('./types').SmoothGeomConfig;
          const smMethod = extractEnum(sm.method.value);
          if (smMethod && smMethod !== 'loess') geom.method = smMethod as any;
          geom.se = sm.se.value;
          const smLevel = sm.level.value;
          if (smLevel != null && smLevel !== 0.95) geom.level = smLevel;
          const smSpan = sm.span.value;
          if (smSpan != null && smSpan !== 0.75) geom.span = smSpan;
          const smN = sm.n.value;
          if (smN != null && smN !== 80) geom.n = smN;
          geom.fullrange = sm.fullrange.value;
          const smFill = extractFill(sm.smoothFillColor.value);
          if (smFill) geom.fill = smFill;
          const smFillAlpha = sm.fillAlpha.value;
          if (smFillAlpha != null && smFillAlpha !== 0.4) geom.fillAlpha = smFillAlpha;
          const smLineWidth = sm.lineWidth.value;
          if (smLineWidth != null && smLineWidth !== 1) geom.lineWidth = smLineWidth;
        }
      }

      // Wire the shared Distribution card into density/violin layers
      const dist = s.distribution;
      for (const layer of layers) {
        if (layer.geom.type === 'density' || layer.geom.type === 'violin') {
          const geom = layer.geom as import('./types').DensityGeomConfig | import('./types').ViolinGeomConfig;
          const adjust = dist.adjust.value;
          if (adjust != null && adjust !== 1) geom.adjust = adjust;
          // Separate toggles per geom (defaults: density off, violin on);
          // only deviations from the geom default are written to the spec.
          if (layer.geom.type === 'density' && dist.trim.value) geom.trim = true;
          if (layer.geom.type === 'violin' && !dist.violinTrim.value) geom.trim = false;
        }
        if (layer.geom.type === 'density' && dist.densityFill.value) {
          const geom = layer.geom as import('./types').DensityGeomConfig;
          geom.fill = true;
          const fa = dist.fillAlpha.value;
          if (fa != null && fa !== 0.3) geom.fillAlpha = fa;
        }
        if (layer.geom.type === 'violin') {
          const vs = extractEnum(dist.violinScale.value) as 'area' | 'count' | 'width';
          if (vs && vs !== 'area') (layer.geom as import('./types').ViolinGeomConfig).violinScale = vs;
        }
      }

      // Auto-geom: when y-only or other special data shapes, let inferGeom
      // pick the best geom (ggplot2 behavior). Preserves user's alpha/size defaults.
      if (isYOnlyMode) {
        // y-only: prefer distribution overview
        const auto = inferGeom(data, { y: yFieldName });
        layers.splice(0, layers.length, { geom: { ...auto, alpha: 0.7, size: 3 } });
        resolvedInfo.fill(null);
        resolvedInfo[0] = { type: auto.type, auto: true };
      } else if (isXOnlyMode) {
        // x-only: numeric x + single pseudo y band → horizontal strip point
        const auto = inferGeom(data, { x: xFieldName, y: yFieldName });
        layers.splice(0, layers.length, { geom: { ...auto, alpha: 0.7, size: 3 } });
        resolvedInfo.fill(null);
        resolvedInfo[0] = { type: auto.type, auto: true };
      }

      // Reference lines: an overlay card rather than a layer type, so they
      // don't consume a layer slot. Positions accept numbers or the
      // keywords mean/median, resolved against the bound data.
      const refCard = s.referenceLines;
      if (refCard.show.value) {
        const refStyle = {
          color: extractFill(refCard.lineColor.value) ?? '#E15759',
          linetype: (extractEnum(refCard.lineStyle.value) || 'dashed') as LinetypeType,
          size: refCard.lineWidth.value ?? 1,
        };
        const hy = resolveReferencePositions(refCard.hlineAt.value, data, yFieldName);
        if (hy.length > 0) {
          layers.push({ geom: { type: 'hline', yintercept: hy, ...refStyle } as GeomConfig });
        }
        const vx = resolveReferencePositions(refCard.vlineAt.value, data, xFieldName);
        if (vx.length > 0) {
          layers.push({ geom: { type: 'vline', xintercept: vx, ...refStyle } as GeomConfig });
        }
      }

      // Refine the Format Pane with the resolved layer types: card titles
      // show the auto choice, specialized cards collapse to active geoms.
      this.formattingSettings.applyResolvedGeoms(resolvedInfo);

      // If no layers are enabled, don't render anything — show a hint instead.
      if (layers.length === 0) {
        this.container.replaceChildren();
        this.container.appendChild(createErrorPage('No layers active — please enable at least one layer in the Format Pane.'));
        this.events.renderingFinished(options);
        return;
      }

      const extractDropdown = (val: any): string =>
        typeof val === 'object' ? (val as any)?.value ?? '' : String(val ?? '');
      const scaleXRaw = extractDropdown(s.scaleX.type.value);
      const scaleYRaw = extractDropdown(s.scaleY.type.value);
      const scaleX = scaleXRaw !== 'auto' ? scaleXRaw as ScaleType : undefined;
      const scaleY = scaleYRaw !== 'auto' ? scaleYRaw as ScaleType : undefined;
      const labelFormatXRaw = extractDropdown(s.scaleX.labelFormat.value);
      const labelFormatYRaw = extractDropdown(s.scaleY.labelFormat.value);
      const asLabelFormat = (v: string | undefined) =>
        v && v !== 'auto' ? v as import('./types').LabelFormat : undefined;
      const labelFormatX = asLabelFormat(labelFormatXRaw);
      const labelFormatY = asLabelFormat(labelFormatYRaw);
      const asDateFormat = (v: string | undefined) =>
        v && v !== 'auto' ? v as NonNullable<import('./types').AxisScaleConfig['dateLabels']> : undefined;
      const currencyCode = (s.theme.currency.value ?? '').trim().toUpperCase() || undefined;
      const dateFormatX = asDateFormat(extractDropdown(s.scaleX.dateFormat.value));
      const dateFormatY = asDateFormat(extractDropdown(s.scaleY.dateFormat.value));
      // Axis labels: default to field name (ggplot2 always shows the variable name)
      const yDisplayName = yInCategories
        ? yCatFieldNames[0]
        : yColumns.length > 0
          ? yColumns[0].source.displayName
          : yFieldName === '__count' ? 'count' : undefined;
      // The Size and Label wells bind to internal keys ('size', 'label'),
      // so the debug view and the description need their display names —
      // "Sum of hp", not "size".
      const sizeDisplayName = sizeCatFieldName
        ?? mappedValues.find(v => v.source.roles?.['size'])?.source.displayName;
      const xLabel = s.scaleX.label.value || xFieldName;
      const yLabel = s.scaleY.label.value || yDisplayName || 'y';
      const showLegend = s.legend.show.value;
      const legendPosition = (s.legend.position?.value as string) || 'right';

      // Read theme properties from Format Pane (set by user or by PBI Style Presets)
      const extractColor = (val: any): string | undefined => {
        if (!val) return undefined;
        if (typeof val === 'string' && val) return val;
        if (typeof val === 'object' && val?.value && val.value !== '') return val.value;
        return undefined;
      };
      const themePanelFill = extractColor(s.theme.panelFill.value);
      const themeGridColor = extractColor(s.theme.gridlineColor.value);
      const themeInk = extractColor(s.theme.ink.value);
      const themePaper = extractColor(s.theme.paper.value);
      const themeBaseSize = s.theme.baseSize.value;

      // Build theme: preset first, then individual pickers, then the host
      // palette (which ALWAYS wins — PBI-native colours have priority).
      // The pickers ship with the grey-theme defaults, so a picker only
      // counts as an override when it differs from those: otherwise an
      // untouched picker would silently undo the chosen preset.
      const facetColumns = s.facet.columns.value ?? 0;
      const subtitleMode = extractEnum(s.theme.subtitle.value) || 'auto';
      const themePreset = extractEnum(s.theme.preset.value) || 'grey';
      const themeConfig: Record<string, any> = themePreset === 'dark'
        ? { ...themeDark(themeBaseSize) }
        : themePreset === 'minimal'
          ? { ...themeMinimal(themeBaseSize) }
          : {};
      if (themePanelFill && themePanelFill !== GREY_DEFAULTS.panelFill) themeConfig.panelFill = themePanelFill;
      if (themeGridColor && themeGridColor !== GREY_DEFAULTS.gridColor) themeConfig.gridColor = themeGridColor;
      if (themeInk && themeInk !== GREY_DEFAULTS.ink) themeConfig.ink = themeInk;
      if (themePaper && themePaper !== GREY_DEFAULTS.paper) themeConfig.paper = themePaper;
      if (themeBaseSize && themeBaseSize !== 11) themeConfig.baseSize = themeBaseSize;
      if (isHighContrast) themeConfig.isHighContrast = true;
      // Host palette ALWAYS overrides — PBI-native colors have priority
      if (hostPalette.length > 0) themeConfig.colorPalette = hostPalette;

      const rendered = renderWithState(
        this.container,
        {
          data,
          aes: aesMapping,
          layers,
          ...(subtitleMode !== 'off' && { subtitle: subtitleMode as 'auto' | 'always' }),
          ...(isTruncated && { truncation: { shown: data.length } }),
          ...(s.theme.warnAggregated.value && { warnAggregated: true }),
          ...(s.theme.showCode.value && { showCode: true }),
          // Axis numbers and month names follow the report language, not
          // the JavaScript default: "1.234,5" and "Mär" in a German report.
          format: {
            ...(this.host.locale && { locale: this.host.locale }),
            ...(currencyCode && { currency: currencyCode }),
          },
          // Field wells carry internal keys (yRaw1, y1, x); the description
          // must name what the user sees in the wells.
          fieldLabels: {
            ...(xLabel && { x: xLabel }),
            ...(yLabel && { y: yLabel }),
            ...(seriesName && { color: seriesName }),
            ...(sizeDisplayName && { size: sizeDisplayName }),
            ...(labelFieldName && { label: labelFieldName }),
            ...(facetFieldName && { facetCol: facetFieldName }),
          },
          ...(scaleX || scaleY || labelFormatX || labelFormatY || dateFormatX || dateFormatY ? {
            scales: {
              ...((scaleX || labelFormatX || dateFormatX) && {
                x: {
                  ...(scaleX && { type: scaleX }),
                  ...(labelFormatX && { labels: labelFormatX }),
                  ...(dateFormatX && { dateLabels: dateFormatX }),
                },
              }),
              ...((scaleY || labelFormatY || dateFormatY) && {
                y: {
                  ...(scaleY && { type: scaleY }),
                  ...(labelFormatY && { labels: labelFormatY }),
                  ...(dateFormatY && { dateLabels: dateFormatY }),
                },
              }),
            },
          } : {}),
          xLabel,
          yLabel,
          showLegend,
          legendPosition: legendPosition as any,
          tooltipService: this.host.tooltipService,
          ...(s.highlight.enabled.value && String(s.highlight.values.value ?? '').trim() !== '' && colorFieldName ? (() => {
            const wanted = String(s.highlight.values.value ?? '')
              .split(',').map(v => v.trim()).filter(Boolean);
            const unhlColor = extractFill(s.highlight.color.value) || '#BEBEBE';
            return {
              highlight: {
                filter: (row: DataPoint) => wanted.includes(String(row[colorFieldName])),
                color: unhlColor,
              },
            };
          })() : {}),
          selection: { selectionManager: this.selectionManager },
          theme: themeConfig,
          // Power BI has ONE facet well, so the faithful translation is
          // facet_wrap (roughly square grid) — facet_col would line every
          // level up in a single row, squeezing each panel to a sliver.
          ...(facetFieldName && {
            facet: {
              wrap: facetFieldName,
              ...(facetColumns > 0 && { ncol: facetColumns }),
              ...(s.facet.freeX.value && { freeX: true }),
              ...(s.facet.freeY.value && { freeY: true }),
            },
          }),
          width: options.viewport.width,
          height: options.viewport.height,
        },
      );

      // Re-apply an existing cross-filter selection after the re-render —
      // otherwise resize/format changes drop the highlight while the report
      // stays filtered by an invisible selection.
      this.lastSelection = rendered.selection;
      this.lastData = data;
      if (rendered.selection && this.selectionManager.hasSelection?.()) {
        this.applyManagerSelection(this.selectionManager.getSelectionIds() as any[]);
      }

      // Signal render complete — enables PDF/PPT export
      this.events.renderingFinished(options);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.container.replaceChildren();
      this.container.appendChild(createErrorPage(msg));
      this.events.renderingFailed(options, msg);
    }
  }

  /**
   * FormattingModel API: return the formatting model for the Format Pane.
   * Replaces the old enumerateObjectInstances() method.
   */
  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
  }

  public destroy(): void {
    this.container.replaceChildren();
  }
}
