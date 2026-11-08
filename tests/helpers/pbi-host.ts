/**
 * A minimal Power BI host for driving the real `Visual` class in tests.
 *
 * The library tests render PlotSpecs directly; this harness goes one door
 * further out — a DataView with role-tagged columns and Format Pane
 * objects, exactly what the host hands to `update()`. Bugs that live in
 * the translation (which settings reach the spec, how rows are shaped)
 * only show up here.
 */
import { Visual } from '../../src/pbi-visual';

/** One category column: display name, data role, values per row. */
export interface HarnessCategory {
  name: string;
  role: string;
  values: unknown[];
}

/** One measure column in the Y well (or another value role). */
export interface HarnessMeasure {
  name: string;
  role?: string;
  values: Array<number | null>;
}

export interface HarnessUpdate {
  categories: HarnessCategory[];
  measures: HarnessMeasure[];
  /** dataView.metadata.objects — what the host resolved from the report. */
  objects?: Record<string, Record<string, unknown>>;
  width?: number;
  height?: number;
  locale?: string;
}

/** Build the host stub. Selection ids are plain objects with a key. */
export function createHost(locale = 'en-US') {
  let idCounter = 0;
  const builder = {
    withCategory() { return builder; },
    withMeasure() { return builder; },
    withSeries() { return builder; },
    createSelectionId() {
      const key = `id-${idCounter++}`;
      return { getKey: () => key, equals: (o: { getKey(): string }) => o?.getKey?.() === key };
    },
  };
  return {
    locale,
    eventService: {
      renderingStarted() {},
      renderingFinished() {},
      renderingFailed() {},
    },
    createSelectionManager: () => ({
      registerOnSelectCallback() {},
      hasSelection: () => false,
      getSelectionIds: () => [],
      select: () => Promise.resolve([]),
      clear: () => Promise.resolve(),
      showContextMenu: () => Promise.resolve(),
    }),
    createSelectionIdBuilder: () => builder,
    colorPalette: {
      getColor: () => ({ value: '#118DFF' }),
      isHighContrast: false,
    },
    tooltipService: {
      enabled: () => false,
      show() {},
      move() {},
      hide() {},
    },
    persistProperties() {},
  };
}

/** Construct a Visual in a fresh container and run one update. */
export function renderVisual(update: HarnessUpdate): { container: HTMLElement; visual: Visual } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const host = createHost(update.locale);
  const visual = new Visual({ element: container, host } as any);
  const columns = [
    ...update.categories.map(c => ({ displayName: c.name, queryName: c.name, roles: { [c.role]: true } })),
    ...update.measures.map(m => ({
      displayName: m.name, queryName: m.name, roles: { [m.role ?? 'y']: true }, isMeasure: true,
    })),
  ];
  const dataView = {
    metadata: { columns, objects: update.objects ?? {} },
    categorical: {
      categories: update.categories.map(c => ({
        source: { displayName: c.name, queryName: c.name, roles: { [c.role]: true } },
        values: c.values,
      })),
      values: Object.assign(
        update.measures.map(m => ({
          source: { displayName: m.name, queryName: m.name, roles: { [m.role ?? 'y']: true } },
          values: m.values,
        })),
        {},
      ),
    },
  };
  visual.update({
    dataViews: [dataView],
    viewport: { width: update.width ?? 640, height: update.height ?? 480 },
    type: 2,
  } as any);
  return { container, visual };
}

/** PBIR literal encodings, as Power BI resolves them into dataView objects. */
export const solid = (color: unknown) => ({ solid: { color } });
