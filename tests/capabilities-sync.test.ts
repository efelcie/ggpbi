/**
 * Validates that formatting-settings.ts and capabilities.json stay in sync.
 *
 * Catches bugs like a card referencing an object name that doesn't exist
 * in capabilities.json — which silently breaks the entire Power BI Format Pane.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { GgpbiFormattingSettings } from '../src/formatting-settings';
import { statSmooth, STAT_SMOOTH_Y } from '../src/stats';

const capabilitiesPath = resolve(__dirname, '..', 'capabilities.json');
const capabilities = JSON.parse(readFileSync(capabilitiesPath, 'utf-8'));
const objects: Record<string, any> = capabilities.objects;

describe('capabilities.json ↔ formatting-settings.ts sync', () => {
  const model = new GgpbiFormattingSettings();

  it('every card name must have a matching object in capabilities.json', () => {
    const missing: string[] = [];
    for (const card of model.cards) {
      if (!objects[card.name]) {
        missing.push(card.name);
      }
    }
    expect(missing, `Missing objects in capabilities.json: ${missing.join(', ')}`).toEqual([]);
  });

  it('every slice/property in each card must exist in its capabilities object', () => {
    const errors: string[] = [];

    for (const card of model.cards) {
      const obj = objects[card.name];
      if (!obj) continue; // already caught by previous test

      const props = Object.keys(obj.properties ?? {});

      // Collect all slice names from the card
      const sliceNames: string[] = [];

      // SimpleCard: slices are directly on the card
      if ('slices' in card && Array.isArray((card as any).slices)) {
        for (const slice of (card as any).slices) {
          if (slice?.name) sliceNames.push(slice.name);
        }
      }

      // CompositeCard: slices are in groups + topLevelSlice
      if ('groups' in card && Array.isArray((card as any).groups)) {
        for (const group of (card as any).groups) {
          if (group?.slices) {
            for (const slice of group.slices) {
              if (slice?.name) sliceNames.push(slice.name);
            }
          }
        }
      }

      // topLevelSlice (e.g. the "enabled" toggle on layer cards)
      if ('topLevelSlice' in card && (card as any).topLevelSlice?.name) {
        sliceNames.push((card as any).topLevelSlice.name);
      }

      for (const name of sliceNames) {
        if (!props.includes(name)) {
          errors.push(`${card.name}.${name}`);
        }
      }
    }
    expect(errors, `Properties missing in capabilities.json: ${errors.join(', ')}`).toEqual([]);
  });

  it('every capabilities object must have a matching card', () => {
    const cardNames = new Set(model.cards.map((c) => c.name));
    const orphaned = Object.keys(objects).filter((name) => !cardNames.has(name));
    expect(
      orphaned,
      `Orphaned objects in capabilities.json (no matching card): ${orphaned.join(', ')}`,
    ).toEqual([]);
  });

  it('organizes boxplot settings into basic and advanced groups', () => {
    const boxplot = model.boxplot;

    expect(boxplot.groups.map((group) => group.displayName)).toEqual([
      'Style',
      'Outliers',
      'Statistics (advanced)',
    ]);
    expect(boxplot.appearanceGroup.slices.map((slice) => slice.name)).toEqual([
      'boxFillColor',
      'boxWidth',
      'fatten',
    ]);
    expect(boxplot.outlierGroup.slices.map((slice) => slice.name)).toEqual([
      'outlierShow',
      'outlierSize',
      'outlierShape',
    ]);
    expect(boxplot.statisticsGroup.slices.map((slice) => slice.name)).toEqual([
      'coef',
      'notch',
      'notchWidth',
      'varWidth',
      'stapleWidth',
    ]);
    expect(boxplot.statisticsGroup.collapsible).toBe(true);
  });

  it('exposes histogram bin alignment settings', () => {
    expect(model.histogram.slices.map((slice) => slice.name)).toContain('center');
    expect(objects.histogram.properties).toHaveProperty('center');
  });

  it('shows only one histogram bin alignment control when configured', () => {
    model.histogram.center.value = 5;
    model.histogram.onPreProcess();
    expect(model.histogram.boundary.visible).toBe(false);
    expect(model.histogram.center.visible).toBe(true);

    model.histogram.center.value = 0;
    model.histogram.boundary.value = 2;
    model.histogram.onPreProcess();
    expect(model.histogram.boundary.visible).toBe(true);
    expect(model.histogram.center.visible).toBe(false);
  });

  it('exposes histogram Y-axis statistics', () => {
    expect(model.histogram.slices.map((slice) => slice.name)).toContain('histYAxis');
    expect(objects.histogram.properties).toHaveProperty('histYAxis');
  });

  it('exposes histogram border color', () => {
    expect(model.histogram.slices.map((slice) => slice.name)).toContain('histBorderColor');
    expect(objects.histogram.properties).toHaveProperty('histBorderColor');
  });

  it('exposes histogram border width', () => {
    expect(model.histogram.slices.map((slice) => slice.name)).toContain('histBorderWidth');
    expect(objects.histogram.properties).toHaveProperty('histBorderWidth');
  });

  it('exposes histogram border line type', () => {
    expect(model.histogram.slices.map((slice) => slice.name)).toContain('histBorderStyle');
    expect(objects.histogram.properties).toHaveProperty('histBorderStyle');
  });

  it('exposes histogram transparency', () => {
    expect(model.histogram.slices.map((slice) => slice.name)).toContain('histTransparency');
    expect(objects.histogram.properties).toHaveProperty('histTransparency');
  });

  it('every smooth method offered in the pane actually reaches the stat engine', () => {
    // Regression: the pane offered "moving", statSmooth switches on
    // "movingAverage" — an unknown method silently falls through to the
    // LOESS branch, so the option rendered a LOESS curve. Compare each
    // enum value against a deliberately invalid one: only 'loess' and
    // 'auto' (which resolves to loess below 1000 rows) may match it.
    const data = Array.from({ length: 40 }, (_, i) => ({
      x: i,
      y: Math.sin(i * 0.4) * 10 + i,
    }));
    const fitFor = (method: string) =>
      statSmooth(data, 'x', 'y', { method: method as never, n: 20, se: false })
        .map((r) => r[STAT_SMOOTH_Y] as number);
    const fallback = fitFor('__not_a_method__');

    const values: string[] = objects.smooth.properties.method.type.enumeration
      .map((e) => e.value);
    for (const value of values) {
      const fit = fitFor(value);
      if (value === 'loess' || value === 'auto') continue; // legitimately the fallback
      expect(
        fit.some((y, i) => Math.abs(y - fallback[i]) > 1e-9),
        `smooth method "${value}" produced the LOESS fallback — the stat engine does not know it`,
      ).toBe(true);
    }
  });
});

describe('data roles can actually reach the visual', () => {
  const mapping = capabilities.dataViewMappings[0].categorical;
  const asCategory = new Set<string>(
    mapping.categories.select.map((s: any) => s.for.in),
  );
  const asValue = new Set<string>(
    mapping.values.group.select.map((s: any) => s.bind.to),
  );

  /**
   * `tooltip` is knowingly value-only: extra tooltip fields do not reach the
   * tooltip renderer yet either way (the converter never sets aes.tooltip),
   * so widening the binding alone would fix nothing. Tracked separately.
   */
  const KNOWN_VALUE_ONLY = new Set(['tooltip']);

  it('every role appears in at least one binding list', () => {
    for (const role of capabilities.dataRoles) {
      expect(
        asCategory.has(role.name) || asValue.has(role.name),
        `role "${role.name}" is declared but bound nowhere — a field dropped there is silently discarded`,
      ).toBe(true);
    }
  });

  it('a GroupingOrMeasure role binds both ways', () => {
    // The bug this pins: `size` was GroupingOrMeasure but listed only under
    // values.group.select, so a raw column dropped into Size had nowhere to
    // land in the DataView. The field vanished, aes.size was never set, and
    // every bubble came out at the layer's default size.
    for (const role of capabilities.dataRoles) {
      if (role.kind !== 'GroupingOrMeasure') continue;
      if (KNOWN_VALUE_ONLY.has(role.name)) continue;
      expect(
        asCategory.has(role.name),
        `"${role.name}" accepts grouping columns but cannot bind as one`,
      ).toBe(true);
      expect(
        asValue.has(role.name),
        `"${role.name}" accepts measures but cannot bind as one`,
      ).toBe(true);
    }
  });

  it('a Grouping-only role binds as a category', () => {
    for (const role of capabilities.dataRoles) {
      if (role.kind !== 'Grouping') continue;
      // color groups the value columns instead of listing itself.
      if (role.name === mapping.values.group.by) continue;
      expect(asCategory.has(role.name), `"${role.name}"`).toBe(true);
    }
  });
});
