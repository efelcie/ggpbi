import { describe, it, expect } from 'vitest';
import { fromDataView, getObjects, resolveColor, adjustBrightness, DEFAULT_ROLE_MAPPING, NUMBERED_ROLES, resolveLabelBinding, restoreSharedFieldAliases, resolveSoloMeasureMode, resolveReferencePositions } from '../src/powerbi';
import type { DataView, DataViewValueColumns } from '../src/powerbi';

describe('fromDataView', () => {
  it('converts simple categorical DataView to DataPoints', () => {
    const dv: DataView = {
      categorical: {
        categories: [{
          source: { displayName: 'Monat' },
          values: ['Jan', 'Feb', 'Mär'],
        }],
        values: Object.assign([{
          source: { displayName: 'Umsatz' },
          values: [100, 200, 300],
        }]) as DataViewValueColumns,
      },
    };

    const data = fromDataView(dv);
    expect(data).toHaveLength(3);
    expect(data[0]).toEqual({ Monat: 'Jan', Umsatz: 100 });
    expect(data[2]).toEqual({ Monat: 'Mär', Umsatz: 300 });
  });

  it('handles grouped (series) DataView', () => {
    const dv: DataView = {
      categorical: {
        categories: [{
          source: { displayName: 'Jahr' },
          values: ['2023', '2024'],
        }],
        values: Object.assign([
          { source: { displayName: 'Umsatz', groupName: 'Nord' }, values: [10, 20] },
          { source: { displayName: 'Umsatz', groupName: 'Süd' }, values: [30, 40] },
        ], { source: { displayName: 'Region' } }) as DataViewValueColumns,
      },
    };

    const data = fromDataView(dv);
    expect(data).toHaveLength(4);
    // Interleaved by category (preserves Power BI category sort)
    expect(data[0]).toEqual({ Jahr: '2023', Umsatz: 10, Region: 'Nord' });
    expect(data[1]).toEqual({ Jahr: '2023', Umsatz: 30, Region: 'Süd' });
    expect(data[2]).toEqual({ Jahr: '2024', Umsatz: 20, Region: 'Nord' });
    expect(data[3]).toEqual({ Jahr: '2024', Umsatz: 40, Region: 'Süd' });
  });

  it('returns empty array when no rows', () => {
    const dv: DataView = {
      categorical: {
        categories: [{
          source: { displayName: 'X' },
          values: [],
        }],
      },
    };
    expect(fromDataView(dv)).toEqual([]);
  });

  it('throws when no categorical data', () => {
    expect(() => fromDataView({})).toThrow(/must have categorical data/);
  });

  it('respects fieldMapping', () => {
    const dv: DataView = {
      categorical: {
        categories: [{
          source: { displayName: 'Datum' },
          values: ['2024-01'],
        }],
        values: Object.assign([{
          source: { displayName: 'Betrag' },
          values: [999],
        }]) as DataViewValueColumns,
      },
    };

    const data = fromDataView(dv, { fieldMapping: { Datum: 'x', Betrag: 'y' } });
    expect(data[0]).toEqual({ x: '2024-01', y: 999 });
  });

  it('attaches __selectionId when createSelectionId is provided', () => {
    const dv: DataView = {
      categorical: {
        categories: [{
          source: { displayName: 'Monat' },
          values: ['Jan', 'Feb', 'Mär'],
        }],
        values: Object.assign([{
          source: { displayName: 'Umsatz' },
          values: [100, 200, 300],
        }]) as DataViewValueColumns,
      },
    };

    const mockIds = ['id-0', 'id-1', 'id-2'];
    const data = fromDataView(dv, {
      createSelectionId: (index) => mockIds[index],
    });

    expect(data).toHaveLength(3);
    expect(data[0].__selectionId).toBe('id-0');
    expect(data[1].__selectionId).toBe('id-1');
    expect(data[2].__selectionId).toBe('id-2');
  });

  it('attaches __selectionId in grouped (series) mode', () => {
    const dv: DataView = {
      categorical: {
        categories: [{
          source: { displayName: 'Jahr' },
          values: ['2023', '2024'],
        }],
        values: Object.assign([
          { source: { displayName: 'Umsatz', groupName: 'Nord' }, values: [10, 20] },
          { source: { displayName: 'Umsatz', groupName: 'Süd' }, values: [30, 40] },
        ], { source: { displayName: 'Region' } }) as DataViewValueColumns,
      },
    };

    const data = fromDataView(dv, {
      createSelectionId: (index) => `sel-${index}`,
    });

    expect(data).toHaveLength(4);
    expect(data[0].__selectionId).toBe('sel-0');
    expect(data[1].__selectionId).toBe('sel-0');
    expect(data[2].__selectionId).toBe('sel-1');
    expect(data[3].__selectionId).toBe('sel-1');
  });

  it('does not attach __selectionId when createSelectionId is not provided', () => {
    const dv: DataView = {
      categorical: {
        categories: [{
          source: { displayName: 'X' },
          values: ['a'],
        }],
        values: Object.assign([{
          source: { displayName: 'Y' },
          values: [1],
        }]) as DataViewValueColumns,
      },
    };

    const data = fromDataView(dv);
    expect(data[0].__selectionId).toBeUndefined();
  });

  it('maps value columns by role using roleMapping', () => {
    const dv: DataView = {
      categorical: {
        categories: [{
          source: { displayName: 'Stadt' },
          values: ['Berlin', 'München'],
        }],
        values: Object.assign([{
          source: { displayName: 'Sum of Umsatz', roles: { yAxis: true } },
          values: [100, 200],
        }]) as DataViewValueColumns,
      },
    };

    const data = fromDataView(dv, { roleMapping: { yAxis: 'y1' } });
    expect(data).toHaveLength(2);
    expect(data[0]).toEqual({ Stadt: 'Berlin', y1: 100 });
    expect(data[1]).toEqual({ Stadt: 'München', y1: 200 });
  });

  it('maps X measure by role using roleMapping', () => {
    const dv: DataView = {
      categorical: {
        categories: [{
          source: { displayName: 'Branche' },
          values: ['Retail', 'Health'],
        }],
        values: Object.assign([{
          source: { displayName: 'OCR', roles: { x: true } },
          values: [0.82, 0.67],
        }]) as DataViewValueColumns,
      },
    };

    const data = fromDataView(dv, { roleMapping: DEFAULT_ROLE_MAPPING, numberedRoles: NUMBERED_ROLES });
    expect(data).toHaveLength(2);
    expect(data[0]).toEqual({ Branche: 'Retail', x: 0.82 });
    expect(data[1]).toEqual({ Branche: 'Health', x: 0.67 });
  });

  it('keeps detail category for row-level strip plot identity', () => {
    const dv: DataView = {
      categorical: {
        categories: [
          {
            source: { displayName: 'Branche' },
            values: ['Retail', 'Retail', 'Health'],
          },
          {
            source: { displayName: 'Document ID' },
            values: ['doc-1', 'doc-2', 'doc-3'],
          },
        ],
        values: Object.assign([{
          source: { displayName: 'OCR', roles: { x: true } },
          values: [0.82, 0.91, 0.67],
        }]) as DataViewValueColumns,
      },
    };

    const data = fromDataView(dv, {
      fieldMapping: { 'Document ID': 'detail' },
      roleMapping: DEFAULT_ROLE_MAPPING,
      numberedRoles: NUMBERED_ROLES,
    });

    expect(data).toHaveLength(3);
    expect(data[0]).toEqual({ Branche: 'Retail', detail: 'doc-1', x: 0.82 });
    expect(data[1]).toEqual({ Branche: 'Retail', detail: 'doc-2', x: 0.91 });
    expect(data[2]).toEqual({ Branche: 'Health', detail: 'doc-3', x: 0.67 });
  });

  it('maps two Y fields to y1 and y2 via numberedRoles', () => {
    const dv: DataView = {
      categorical: {
        categories: [{
          source: { displayName: 'ID' },
          values: ['A', 'B', 'C'],
        }],
        values: Object.assign([
          { source: { displayName: 'Revenue', roles: { y: true } }, values: [60, 75, 90] },
          { source: { displayName: 'Cost', roles: { y: true } }, values: [170, 180, 165] },
        ]) as DataViewValueColumns,
      },
    };

    const data = fromDataView(dv, { roleMapping: DEFAULT_ROLE_MAPPING, numberedRoles: NUMBERED_ROLES });
    expect(data).toHaveLength(3);
    expect(data[0]).toEqual({ ID: 'A', y1: 60, y2: 170 });
    expect(data[1]).toEqual({ ID: 'B', y1: 75, y2: 180 });
    expect(data[2]).toEqual({ ID: 'C', y1: 90, y2: 165 });
  });

  it('maps y, size and tooltip roles', () => {
    const dv: DataView = {
      categorical: {
        categories: [{
          source: { displayName: 'Country' },
          values: ['DE', 'AT'],
        }],
        values: Object.assign([
          { source: { displayName: 'Population', roles: { y: true } }, values: [83, 9] },
          { source: { displayName: 'Area', roles: { size: true } }, values: [357, 84] },
          { source: { displayName: 'HDI', roles: { tooltip: true } }, values: [0.94, 0.92] },
        ]) as DataViewValueColumns,
      },
    };

    const data = fromDataView(dv, { roleMapping: DEFAULT_ROLE_MAPPING, numberedRoles: NUMBERED_ROLES });
    expect(data).toHaveLength(2);
    expect(data[0]).toEqual({ Country: 'DE', y1: 83, size: 357, tooltip: 0.94 });
    expect(data[1]).toEqual({ Country: 'AT', y1: 9, size: 84, tooltip: 0.92 });
  });

  it('maps label role for text layers', () => {
    const dv: DataView = {
      categorical: {
        categories: [{
          source: { displayName: 'Branche' },
          values: ['Retail', 'Health'],
        }],
        values: Object.assign([
          { source: { displayName: 'OCR', roles: { x: true } }, values: [0.82, 0.67] },
          { source: { displayName: 'Firma', roles: { label: true } }, values: ['Alpha GmbH', 'Beta AG'] },
        ]) as DataViewValueColumns,
      },
    };

    const data = fromDataView(dv, { roleMapping: DEFAULT_ROLE_MAPPING, numberedRoles: NUMBERED_ROLES });
    expect(data).toHaveLength(2);
    expect(data[0]).toEqual({ Branche: 'Retail', x: 0.82, label: 'Alpha GmbH' });
    expect(data[1]).toEqual({ Branche: 'Health', x: 0.67, label: 'Beta AG' });
  });

  it('falls back to displayName when role has no roleMapping entry', () => {
    const dv: DataView = {
      categorical: {
        categories: [{
          source: { displayName: 'X' },
          values: ['a'],
        }],
        values: Object.assign([
          { source: { displayName: 'Umsatz', roles: { unknownRole: true } }, values: [42] },
        ]) as DataViewValueColumns,
      },
    };

    // roleMapping doesn't include 'unknownRole'
    const data = fromDataView(dv, { roleMapping: { yAxis: 'y1' } });
    expect(data[0]).toEqual({ X: 'a', Umsatz: 42 });
  });

  it('maps two Y fields for combo charts (both y role)', () => {
    const dv: DataView = {
      categorical: {
        categories: [{
          source: { displayName: 'Month' },
          values: ['Jan', 'Feb'],
        }],
        values: Object.assign([
          { source: { displayName: 'Revenue', roles: { y: true } }, values: [100, 150] },
          { source: { displayName: 'Cost', roles: { y: true } }, values: [80, 90] },
        ]) as DataViewValueColumns,
      },
    };

    const data = fromDataView(dv, { roleMapping: DEFAULT_ROLE_MAPPING, numberedRoles: NUMBERED_ROLES });
    expect(data).toHaveLength(2);
    expect(data[0]).toEqual({ Month: 'Jan', y1: 100, y2: 80 });
    expect(data[1]).toEqual({ Month: 'Feb', y1: 150, y2: 90 });
  });

  it('maps Y with series grouping', () => {
    const dv: DataView = {
      categorical: {
        categories: [{
          source: { displayName: 'ID' },
          values: ['P1', 'P2'],
        }],
        values: Object.assign([
          { source: { displayName: 'Y', roles: { y: true }, groupName: 'Group A' }, values: [50, 60] },
          { source: { displayName: 'Y', roles: { y: true }, groupName: 'Group B' }, values: [70, 80] },
        ], { source: { displayName: 'Category' } }) as DataViewValueColumns,
      },
    };

    const data = fromDataView(dv, { roleMapping: DEFAULT_ROLE_MAPPING, numberedRoles: NUMBERED_ROLES });
    expect(data).toHaveLength(4);
    // Interleaved by category (ID)
    expect(data[0]).toEqual({ ID: 'P1', y1: 50, Category: 'Group A' });
    expect(data[1]).toEqual({ ID: 'P1', y1: 70, Category: 'Group B' });
    expect(data[2]).toEqual({ ID: 'P2', y1: 60, Category: 'Group A' });
    expect(data[3]).toEqual({ ID: 'P2', y1: 80, Category: 'Group B' });
  });

  it('single Y field gets numbered as y1', () => {
    const dv: DataView = {
      categorical: {
        categories: [{
          source: { displayName: 'Month' },
          values: ['Jan', 'Feb'],
        }],
        values: Object.assign([
          { source: { displayName: 'Revenue', roles: { y: true } }, values: [100, 200] },
        ]) as DataViewValueColumns,
      },
    };

    const data = fromDataView(dv, { roleMapping: DEFAULT_ROLE_MAPPING, numberedRoles: NUMBERED_ROLES });
    expect(data).toHaveLength(2);
    expect(data[0]).toEqual({ Month: 'Jan', y1: 100 });
    expect(data[1]).toEqual({ Month: 'Feb', y1: 200 });
  });
});

describe('DEFAULT_ROLE_MAPPING', () => {
  it('has correct mapping for aesthetic data roles', () => {
    expect(DEFAULT_ROLE_MAPPING).toEqual({
      x: 'x',
      y: 'y',
      size: 'size',
      label: 'label',
      tooltip: 'tooltip',
    });
  });

  it('NUMBERED_ROLES includes y for multi-field numbering', () => {
    expect(NUMBERED_ROLES.has('y')).toBe(true);
    expect(NUMBERED_ROLES.size).toBe(1);
  });
});

describe('getObjects', () => {
  it('returns defaults when no objects set', () => {
    const objs = getObjects({});
    expect(objs.geomType).toBe('bar');
    expect(objs.alpha).toBeUndefined();
    expect(objs.scaleX).toBeUndefined();
    expect(objs.showLegend).toBeUndefined();
  });

  it('reads geom type from objects', () => {
    const objs = getObjects({
      metadata: { objects: { geom: { type: 'point' } } },
    });
    expect(objs.geomType).toBe('point');
  });

  it('reads style properties', () => {
    const objs = getObjects({
      metadata: { objects: { geomStyle: { alpha: 0.5, size: 8 } } },
    });
    expect(objs.alpha).toBe(0.5);
    expect(objs.size).toBe(8);
  });

  it('ignores "auto" scale type', () => {
    const objs = getObjects({
      metadata: { objects: { scaleX: { type: 'auto' } } },
    });
    expect(objs.scaleX).toBeUndefined();
  });

  it('reads non-auto scale type', () => {
    const objs = getObjects({
      metadata: { objects: { scaleY: { type: 'log' } } },
    });
    expect(objs.scaleY).toBe('log');
  });

  it('reads axis labels', () => {
    const objs = getObjects({
      metadata: { objects: { scaleX: { label: 'Datum' }, scaleY: { label: 'EUR' } } },
    });
    expect(objs.xLabel).toBe('Datum');
    expect(objs.yLabel).toBe('EUR');
  });

  it('reads showLegend toggle', () => {
    const objs = getObjects({
      metadata: { objects: { legend: { show: false } } },
    });
    expect(objs.showLegend).toBe(false);
  });

  it('resolves fill from solid color', () => {
    const objs = getObjects({
      metadata: { objects: { geomStyle: { fill: { solid: { color: '#ff0000' } } } } },
    });
    expect(objs.fill).toBe('#ff0000');
  });

  it('resolves fill from ThemeDataColor with palette', () => {
    const palette = ['#aaaaaa', '#bbbbbb', '#cccccc'];
    const objs = getObjects({
      metadata: { objects: { geomStyle: { fill: { ThemeDataColor: { ColorId: 1, Percent: 0 } } } } },
    }, palette);
    expect(objs.fill).toBe('#bbbbbb');
  });

  it('reads theme properties from objects', () => {
    const objs = getObjects({
      metadata: {
        objects: {
          theme: {
            panelFill: { solid: { color: '#2d2d2d' } },
            gridlineColor: { solid: { color: '#444444' } },
            ink: { solid: { color: '#e0e0e0' } },
            paper: { solid: { color: '#1a1a1a' } },
            baseSize: 14,
          },
        },
      },
    });
    expect(objs.panelFill).toBe('#2d2d2d');
    expect(objs.gridlineColor).toBe('#444444');
    expect(objs.ink).toBe('#e0e0e0');
    expect(objs.paper).toBe('#1a1a1a');
    expect(objs.baseSize).toBe(14);
  });

  it('returns undefined theme properties when not set', () => {
    const objs = getObjects({});
    expect(objs.panelFill).toBeUndefined();
    expect(objs.gridlineColor).toBeUndefined();
    expect(objs.ink).toBeUndefined();
    expect(objs.paper).toBeUndefined();
    expect(objs.baseSize).toBeUndefined();
  });
});

describe('resolveColor', () => {
  it('returns undefined for falsy input', () => {
    expect(resolveColor(null)).toBeUndefined();
    expect(resolveColor(undefined)).toBeUndefined();
    expect(resolveColor('')).toBeUndefined();
  });

  it('returns hex string as-is', () => {
    expect(resolveColor('#ff0000')).toBe('#ff0000');
  });

  it('extracts solid.color', () => {
    expect(resolveColor({ solid: { color: '#00ff00' } })).toBe('#00ff00');
  });

  it('resolves ThemeDataColor with palette', () => {
    const palette = ['#111111', '#222222', '#333333'];
    expect(resolveColor({ ThemeDataColor: { ColorId: 0, Percent: 0 } }, palette)).toBe('#111111');
    expect(resolveColor({ ThemeDataColor: { ColorId: 2, Percent: 0 } }, palette)).toBe('#333333');
  });

  it('resolves ThemeDataColor with ColorId wrapping', () => {
    const palette = ['#aaa', '#bbb'];
    expect(resolveColor({ ThemeDataColor: { ColorId: 3, Percent: 0 } }, palette)).toBe('#bbb');
  });

  it('resolves ThemeDataColor with Percent adjustment', () => {
    const palette = ['#000000'];
    const result = resolveColor({ ThemeDataColor: { ColorId: 0, Percent: 50 } }, palette);
    // 50% lighter from black → #808080 area
    expect(result).toBeDefined();
    expect(result!.startsWith('#')).toBe(true);
  });

  it('returns undefined for ThemeDataColor without palette', () => {
    expect(resolveColor({ ThemeDataColor: { ColorId: 0, Percent: 0 } })).toBeUndefined();
  });

  it('resolves nested expr.ThemeDataColor', () => {
    const palette = ['#abcdef'];
    expect(resolveColor({ expr: { ThemeDataColor: { ColorId: 0, Percent: 0 } } }, palette)).toBe('#abcdef');
  });
});

describe('adjustBrightness', () => {
  it('returns same color for 0 percent', () => {
    expect(adjustBrightness('#808080', 0)).toBe('#808080');
  });

  it('lightens with positive percent', () => {
    const result = adjustBrightness('#000000', 100);
    expect(result).toBe('#ffffff');
  });

  it('darkens with negative percent', () => {
    const result = adjustBrightness('#ffffff', -100);
    expect(result).toBe('#000000');
  });

  it('clamps within valid range', () => {
    const result = adjustBrightness('#ff0000', 50);
    // Red channel: 255 + (255-255)*0.5 = 255
    // Green: 0 + (255-0)*0.5 = 128
    // Blue: 0 + (255-0)*0.5 = 128
    expect(result).toBe('#ff8080');
  });
});

describe('resolveLabelBinding (shared Label column)', () => {
  it('remaps to the synthetic label field when the column is exclusive', () => {
    expect(resolveLabelBinding('name', ['region', undefined]))
      .toEqual({ remap: true, aesLabel: 'label' });
  });

  it('binds aes.label to the shared field when the column also serves Color/X/Detail', () => {
    expect(resolveLabelBinding('name', ['name', undefined]))
      .toEqual({ remap: false, aesLabel: 'name' });
    expect(resolveLabelBinding('name', [undefined, 'other', 'name']))
      .toEqual({ remap: false, aesLabel: 'name' });
  });

  it('no label field: nothing to remap', () => {
    expect(resolveLabelBinding(undefined, ['name'])).toEqual({ remap: false });
  });
});

describe('restoreSharedFieldAliases (dual-role category columns)', () => {
  it('copies a remapped raw-Y column back under its display name for Color', () => {
    // "Branche" dragged into Y (raw category → yRaw1) AND Color.
    const rows = [
      { x: 0.1, yRaw1: 'Retail' },
      { x: 0.2, yRaw1: 'Grocery' },
    ];
    restoreSharedFieldAliases(rows, { Branche: 'yRaw1' }, ['Branche', undefined, undefined]);
    expect(rows[0].Branche).toBe('Retail');
    expect(rows[1].Branche).toBe('Grocery');
  });

  it('handles Detail-remapped columns and multiple bound names', () => {
    const rows = [{ detail: 'SPAR', yRaw1: 'Grocery' }];
    restoreSharedFieldAliases(
      rows,
      { Mieter: 'detail', Branche: 'yRaw1' },
      ['Branche', 'Branche', 'Mieter'],
    );
    expect((rows[0] as any).Mieter).toBe('SPAR');
    expect((rows[0] as any).Branche).toBe('Grocery');
  });

  it('leaves rows untouched when no bound name was remapped', () => {
    const rows = [{ x: 1, color: 'a' }];
    restoreSharedFieldAliases(rows, { Something: 'yRaw1' }, ['color', undefined]);
    expect(rows[0]).toEqual({ x: 1, color: 'a' });
  });

  it('end to end: colour aesthetic binds after aliasing (the Branche crash)', () => {
    const dataView: DataView = {
      categorical: {
        categories: [
          { source: { displayName: 'Branche' }, values: ['Retail', 'Grocery', 'Retail'] },
        ],
        values: [
          {
            source: { displayName: 'OCR', roles: { x: true } },
            values: [0.35, 0.09, 0.08],
          },
        ] as unknown as DataViewValueColumns,
      },
    };
    const rows = fromDataView(dataView, {
      fieldMapping: { Branche: 'yRaw1' },
      roleMapping: DEFAULT_ROLE_MAPPING,
      numberedRoles: NUMBERED_ROLES,
    });
    // Before aliasing: the display name is gone — aes.color would dangle.
    expect(rows[0].Branche).toBeUndefined();
    restoreSharedFieldAliases(rows, { Branche: 'yRaw1' }, ['Branche']);
    expect(rows.map(r => r.Branche)).toEqual(['Retail', 'Grocery', 'Retail']);
    expect(rows.map(r => r.yRaw1)).toEqual(['Retail', 'Grocery', 'Retail']);
    expect(rows.map(r => r.x)).toEqual([0.35, 0.09, 0.08]);
  });
});

describe('resolveSoloMeasureMode (measure-only field wells)', () => {
  it('a measure in X and nothing else is x-only', () => {
    expect(resolveSoloMeasureMode({ hasCategories: false, hasValues: true, xMeasures: 1, yFields: 0 }))
      .toBe('x-only');
  });

  it('a measure in Y (or any other values-only shape) is y-only', () => {
    expect(resolveSoloMeasureMode({ hasCategories: false, hasValues: true, xMeasures: 0, yFields: 1 }))
      .toBe('y-only');
    expect(resolveSoloMeasureMode({ hasCategories: false, hasValues: true, xMeasures: 1, yFields: 1 }))
      .toBe('y-only');
  });

  it('categories present or no values: no solo mode', () => {
    expect(resolveSoloMeasureMode({ hasCategories: true, hasValues: true, xMeasures: 1, yFields: 0 }))
      .toBeNull();
    expect(resolveSoloMeasureMode({ hasCategories: false, hasValues: false, xMeasures: 0, yFields: 0 }))
      .toBeNull();
  });
});

describe('resolveReferencePositions (Reference Lines card)', () => {
  const data = [{ v: 10 }, { v: 20 }, { v: 60 }, { v: 30 }];

  it('parses a comma-separated list of numbers', () => {
    expect(resolveReferencePositions('10, 25.5', data, 'v')).toEqual([10, 25.5]);
  });

  it("resolves 'mean' against the field", () => {
    expect(resolveReferencePositions('mean', data, 'v')).toEqual([30]);
  });

  it("resolves 'median' (even count → midpoint of the two middle values)", () => {
    // sorted: 10, 20, 30, 60 → (20 + 30) / 2
    expect(resolveReferencePositions('median', data, 'v')).toEqual([25]);
  });

  it('mixes keywords and numbers, case-insensitively', () => {
    expect(resolveReferencePositions('MEAN, 5', data, 'v')).toEqual([30, 5]);
  });

  it('accepts avg/average as aliases of mean', () => {
    expect(resolveReferencePositions('avg', data, 'v')).toEqual([30]);
    expect(resolveReferencePositions('average', data, 'v')).toEqual([30]);
  });

  it('skips unparsable entries instead of failing', () => {
    expect(resolveReferencePositions('20, nonsense, , 40', data, 'v')).toEqual([20, 40]);
  });

  it('empty input or no numeric values → no lines', () => {
    expect(resolveReferencePositions('', data, 'v')).toEqual([]);
    expect(resolveReferencePositions('  ', data, 'v')).toEqual([]);
    expect(resolveReferencePositions('mean', [{ v: 'a' }] as any, 'v')).toEqual([]);
    expect(resolveReferencePositions('mean', data, undefined)).toEqual([]);
  });

  it('ignores NA rows when averaging', () => {
    const withNa = [{ v: 10 }, { v: null }, { v: 30 }, { v: NaN }];
    expect(resolveReferencePositions('mean', withNa as any, 'v')).toEqual([20]);
  });
});
