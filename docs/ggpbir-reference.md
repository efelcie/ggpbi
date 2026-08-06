# ggpbir Syntax Definition

> **ggpbir** is ggpbi's subset of PBIR — everything you need to define a valid
> ggpbi visual in a Power BI Enhanced Report (`.pbir`).

This document is the **complete specification**. If you can write a valid
`visual.json` by hand following this reference, you can build any ggpbi chart
without opening Power BI Desktop.

**JSON Schema**: [`ggpbir.schema.json`](ggpbir.schema.json) — validates the
`objects` section. Use it in VS Code for IntelliSense and validation.

---

## Table of Contents

1. [File Structure](#file-structure)
2. [visual.json — Top Level](#visualjson--top-level)
3. [Position](#position)
4. [Visual Type](#visual-type)
5. [Data Role Bindings](#data-role-bindings)
6. [Query](#query)
7. [Objects (ggpbir)](#objects-ggpbir)
   - [Value Encoding](#value-encoding)
   - [Layer Objects](#layer-objects-layer1-layer2-layer3)
   - [Scale Objects](#scale-objects-scalex-scaley)
   - [Legend Object](#legend-object)
   - [Theme Object](#theme-object)
   - [Facet Object](#facet-object-small-multiples)
   - [Distribution Object](#distribution-object-density--violin)
   - [Reference Lines Object](#reference-lines-object)
   - [Boxplot Object](#boxplot-object)
   - [Histogram Object](#histogram-object)
8. [vcObjects (Visual Container)](#vcobjects-visual-container)
9. [Filters](#filters)
10. [Enumerations Reference](#enumerations-reference)
11. [Auto-Detection Rules](#auto-detection-rules)
12. [Complete Examples](#complete-examples)
13. [Accessibility & Interactivity](#accessibility--interactivity)

---

## File Structure

In a PBIR report, every visual lives in its own folder:

```
MyReport.Report/
└── definition/
    └── pages/
        └── <pageId>/
            ├── page.json
            └── visuals/
                └── <visualId>/
                    └── visual.json      ← this is what ggpbir defines
```

Each `<visualId>` is a 20-character unique identifier (e.g. `8f1e206eb6ad1e8a421d`).

---

## visual.json — Top Level

A complete ggpbi `visual.json`:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/1.4.0/schema.json",
  "name": "<visualId>",
  "position": {
    "x": 40,
    "y": 40,
    "z": 0,
    "width": 600,
    "height": 400
  },
  "visual": {
    "visualType": "ggpbiGrammarOfGraphics",
    "objects": { ... },
    "query": { ... }
  },
  "filterConfig": { ... }
}
```

| Property | Required | Description |
|----------|:--------:|-------------|
| `$schema` | yes | PBIR schema URL (see above) |
| `name` | yes | Unique ID, max 50 chars, must match folder name |
| `position` | yes | Placement and size on the canvas |
| `visual` | yes | Visual configuration (type, data, formatting) |
| `filterConfig` | no | Visual-level filters |
| `howCreated` | no | Origin tracking (`"Default"`, `"DraggedToCanvas"`, etc.) |
| `parentGroupName` | no | Group membership |
| `isHidden` | no | Hidden visual (for bookmarks) |
| `annotations` | no | Metadata annotations |

---

## Position

```json
"position": {
  "x": 40,
  "y": 40,
  "z": 0,
  "width": 600,
  "height": 400,
  "tabOrder": 0,
  "angle": 0
}
```

| Property | Type | Required | Description |
|----------|------|:--------:|-------------|
| `x` | number | yes | Left edge (pixels from page left) |
| `y` | number | yes | Top edge (pixels from page top) |
| `z` | number | yes | Stacking order (higher = on top) |
| `width` | number | yes | Width in pixels |
| `height` | number | yes | Height in pixels |
| `tabOrder` | number | no | Keyboard navigation order |
| `angle` | number | no | Rotation in degrees |

---

## Visual Type

ggpbi registers with this identifier:

```json
"visual": {
  "visualType": "ggpbiGrammarOfGraphics"
}
```

The `visualType` value must match the GUID from `pbiviz.json`. For ggpbi this
is always `ggpbiGrammarOfGraphics`.

---

## Data Role Bindings

Data role bindings connect semantic model fields to the visual's wells.
This is the PBIR equivalent of dragging fields into the Field Wells UI.

```json
"visual": {
  "visualType": "ggpbiGrammarOfGraphics",
  "query": { ... },
  "dataRoleBindings": {
    "x": {
      "bindings": [
        { "queryRef": "DimDate.Month", "kind": 0 }
      ]
    },
    "y": {
      "bindings": [
        { "queryRef": "FactSales.Revenue", "kind": 0 },
        { "queryRef": "FactSales.Target", "kind": 0 }
      ]
    },
    "color": {
      "bindings": [
        { "queryRef": "DimRegion.Region", "kind": 0 }
      ]
    },
    "detail": {
      "bindings": [
        { "queryRef": "FactSales.OrderId", "kind": 0 }
      ]
    },
    "label": {
      "bindings": [
        { "queryRef": "DimCustomer.CustomerName", "kind": 0 }
      ]
    }
  }
}
```

### Available Data Roles

| Role | Kind | Max Fields | Maps to | Description |
|------|------|:----------:|---------|-------------|
| `x` | GroupingOrMeasure | 3 | `aes(x=)` | X axis — category or measure; extra measures become `x2`/`x3` for segment ends and point ranges |
| `y` | GroupingOrMeasure | 3 | `aes(y=)` | Y axis — multiple fields → one per layer |
| `color` | Grouping | 1 | `aes(color=)` | Color grouping (creates legend) |
| `size` | GroupingOrMeasure | 1 | `aes(size=)` | Point size (bubble charts). Binds as a measure or as a raw column — area-proportional, like ggplot2 `scale_size()` |
| `tooltip` | GroupingOrMeasure | ∞ | tooltip | Extra tooltip fields |
| `detail` | Grouping | 1 | detail identity | Row/item identity for one point per entity |
| `label` | GroupingOrMeasure | 1 | `aes(label=)` | Text labels for `geom_text`; blanks are skipped |
| `facet` | Grouping | 1 | `aes(facetCol=)` | Small multiples |

**Kind values:**
- `GroupingOrMeasure` — accepts both categories and measures
- `Grouping` — categories only

**queryRef** format: `Table.Column` or `Table.Measure` — references the
semantic model entity.

### Data Reduction

Power BI applies a data reduction algorithm when the dataset exceeds the limit:

```
dataReductionAlgorithm: { "sample": { "count": 30000 } }
```

Maximum **30,000 rows** are sent to the visual — **sampled across the
result**, not the first 30,000. Source tables are usually sorted by date,
region or amount, so `top` would hand the visual a systematically biased
slice. When the reduction bites, the plot says so above the panel
(*"showing a sample of 30,000 rows — the source has more"*), regardless
of the `theme.subtitle` setting.

---

## Query

The `query` property defines which data the visual requests from the model.
Power BI generates this automatically when you assign fields via the UI.
For hand-written ggpbir, the `query` must match the `dataRoleBindings`.

```json
"query": {
  "queryState": {
    "x": {
      "projections": [{ "queryRef": "DimDate.Month", "active": true }]
    },
    "y": {
      "projections": [
        { "queryRef": "FactSales.Revenue", "active": true },
        { "queryRef": "FactSales.Target", "active": true }
      ]
    },
    "color": {
      "projections": [{ "queryRef": "DimRegion.Region", "active": true }]
    }
  }
}
```

Each data role referenced in `dataRoleBindings` must have a matching entry
in `queryState` with the same `queryRef` values.

---

## Objects (ggpbir)

The `objects` section is the heart of ggpbir. It controls all visual formatting:
layers, scales, legend, theme, boxplot parameters.

```json
"visual": {
  "visualType": "ggpbiGrammarOfGraphics",
  "objects": {
    "layer1": [{ "properties": { ... } }],
    "layer2": [{ "properties": { ... } }],
    "layer3": [{ "properties": { ... } }],
    "scaleX": [{ "properties": { ... } }],
    "scaleY": [{ "properties": { ... } }],
    "legend": [{ "properties": { ... } }],
    "theme":  [{ "properties": { ... } }],
    "boxplot": [{ "properties": { ... } }]
  }
}
```

Each object is an **array of one element** containing a `properties` map.

### Value Encoding

All property values use Power BI's expression format:

| Data Type | Encoding | Example |
|-----------|----------|---------|
| String enum | `{ "expr": { "Literal": { "Value": "'value'" } } }` | `"'point'"` |
| Number | `{ "expr": { "Literal": { "Value": "number" } } }` | `"0.7"` |
| Boolean | `{ "expr": { "Literal": { "Value": "bool" } } }` | `"true"` |
| Color (hex) | `{ "solid": { "color": "#hex" } }` | `"#e74c3c"` |
| Color (theme) | `{ "solid": { "color": { "ThemeDataColor": { "ColorId": n, "Percent": p } } } }` | `ColorId: 0` |

**Important:** String values are wrapped in **single quotes** inside the JSON
string: `"Value": "'point'"` (not `"Value": "point"`).

**ThemeDataColor:**
- `ColorId`: Index in the report theme palette (0 = first color)
- `Percent`: Brightness adjustment (-100 to +100, 0 = no change)

ggpbi resolves theme colors automatically via `host.colorPalette`.

---

### Layer Objects (`layer1`, `layer2`, `layer3`)

Each layer is an independent geom with its own type and style.
Up to **3 layers** can be composed. `layer1` is enabled by default.

#### All Layer Properties

| Property | Type | Default | Values | Format Pane | Description |
|----------|------|---------|--------|:-----------:|-------------|
| `enabled` | bool | L1: `true`, L2/L3: `false` | `true` / `false` | yes | Activate/deactivate layer |
| `type` | enum | `auto` | see [Geom Types](#geom-types) | yes | Geom type |
| `yField` | enum | `auto` | `auto`, `y1`, `y2`, `y3` | yes | Which Y field this layer uses |
| `alpha` | number | `0.85` | 0–1 | yes | Transparency |
| `size` | number | `4` | 1–40 | yes | Point size / line width / font size. The default `4` means "auto": each geom keeps its own default (point 4, line 2, text 12, pointrange 1) — any other value overrides it |
| `fill` | color | `""` (auto) | any color | yes | Override color (ignores aes.color) |
| `lineStyle` | enum | `solid` | see [Line Types](#line-types) | yes | Line dash pattern |
| `position` | enum | `identity` | see [Position Types](#position-types) | yes | Position adjustment |
| `orientation` | enum | `x` | `x`, `y` | yes | `x` = vertical, `y` = horizontal |
| `shape` | enum | `circle` | see [Shapes](#shapes) | no | Point shape |
| `pointFill` | color | `""` | any color | no | Fill for border shapes (21–25) |
| `strokeWidth` | number | `0.5` | 0–10 | no | Stroke width |
| `just` | number | `0.5` | 0–1 | no | Bar alignment (0=left, 0.5=center, 1=right) |
| `jitterWidth` | number | `0.4` | 0–2 | no | Jitter width (fraction of bandwidth) |
| `jitterHeight` | number | `0` | 0–2 | no | Jitter height; fraction of bandwidth when Y is categorical |
| `lineEnd` | enum | `butt` | `butt`, `round`, `square` | no | SVG line cap |
| `lineJoin` | enum | `round` | `round`, `miter`, `bevel` | no | SVG line join |
| `arrowShow` | bool | `false` | `true` / `false` | no | Show arrowhead |
| `arrowEnds` | enum | `last` | `first`, `last`, `both` | no | Arrow position |
| `arrowType` | enum | `open` | `open`, `closed` | no | Arrow style |
| `arrowLength` | number | `8` | 2–30 | no | Arrow length (px) |
| `arrowAngle` | number | `30` | 5–90 | no | Arrow angle (degrees) |
| `repel` | bool | `false` | true/false | no | Text layers: labels find non-overlapping positions (like ggrepel); displaced labels get a connector line |
| `applyHighlight` | bool | `true` | true/false | no | Whether the Highlight object affects this layer; off = full colours (text layers: all labels) |
| `filter` | enum | `none` | `none`, `min`, `max`, `extremes` | no | Restrict the layer's rows: Min/Max keep the extreme row per category on the continuous axis, Extremes keeps both (dumbbell ends). Scales still train on the full data |
| `labelTemplate` | text | `""` | e.g. `{label} {x:.1%}` | no | Text layers: label template — placeholders `{label}`, `{x}`, `{y}`, optional d3-format spec after the colon |

---

### Scale Objects (`scaleX`, `scaleY`)

| Property | Type | Default | Values | Description |
|----------|------|---------|--------|-------------|
| `type` | enum | `auto` | see [Scale Types](#scale-types) | Scale transformation. `category` / `ordinal` force a discrete axis (like R's `factor()`) — needed for bars and boxplots over numeric group codes |
| `label` | text | `""` (field name) | any string | Axis title |
| `labelFormat` | enum | `auto` | `auto`, `thousands`, `compact`, `currency`, `percent` | Number format for the tick labels. Separators, symbols and compact suffixes follow the report locale — `1200000` renders as `1.2M` (en) or `1,2 Mio.` (de) |
| `dateFormat` | enum | `auto` | `auto`, `year`, `monthYear`, `monthDay`, `date`, `dateTime` | Granularity of a time axis. `auto` follows the tick spacing; month names always come from the report locale |

---

### Legend Object

| Property | Type | Default | Values | Description |
|----------|------|---------|--------|-------------|
| `show` | bool | `true` | `true` / `false` | Show/hide legend |
| `position` | enum | `right` | `right`, `bottom`, `top`, `left` | Legend placement |

The legend appears automatically when `color` aesthetic is mapped.

---

### Theme Object

| Property | Type | Default | Values | Description |
|----------|------|---------|--------|-------------|
| `subtitle` | enum | `auto` | `off`, `auto`, `always` | Line above the plot describing what is shown. `auto` appears only when the visual computed something itself (sum, count, bins, density, auto-picked geom) |
| `currency` | text | `EUR` | ISO 4217 code | Currency used when an axis `labelFormat` is `currency`. Symbol and placement follow the report locale |
| `showCode` | bool | `false` | true/false | Debug view: overlay the ggpbi code that would produce this chart (field names as bound in the wells, pre-stat mapping, non-defaults only) |
| `warnAggregated` | bool | `true` | true/false | Warn above the panel when a row-counting chart runs on data where no bound field is unique per row — Power BI may have collapsed duplicates first. Data notices appear regardless of `subtitle` |
| `preset` | enum | `grey` | `grey`, `minimal`, `dark` | Base theme (see below). The colour properties override individual parts of it — but only when they differ from the grey defaults, so untouched pickers never cancel a preset |
| `panelFill` | color | `#EBEBEB` | any color | Plot area background |
| `gridlineColor` | color | `#FFFFFF` | any color | Grid line color |
| `ink` | color | `#333333` | any color | Text color (axis labels, titles) |
| `paper` | color | `#FFFFFF` | any color | Outer background (margins) |
| `baseSize` | number | `11` | 6–24 | Base font size |

#### Theme Presets

| Preset | `panelFill` | `gridlineColor` | `ink` | `paper` |
|--------|------------|-----------------|-------|---------|
| **Grey** (default) | `#EBEBEB` | `#FFFFFF` | `#333333` | `#FFFFFF` |
| **Minimal** | `#FFFFFF` | `#E0E0E0` | `#333333` | `#FFFFFF` |
| **Dark** | `#2D2D2D` | `#444444` | `#E0E0E0` | `#1A1A1A` |

#### Derived Values from `baseSize`

| Element | Formula | baseSize=11 | baseSize=16 |
|---------|---------|------------|------------|
| Axis text | `0.8 × baseSize` | 8.8px | 12.8px |
| Axis title | `1.0 × baseSize` | 11px | 16px |
| Tick length | `0.25 × baseSize` | 2.75px | 4px |
| Margins | `0.5 × baseSize` | 5.5px | 8px |
| Legend text | `0.9 × baseSize` | 9.9px | 14.4px |

---

### Highlight Object (gghighlight)

| Property | Type | Default | Values | Description |
|----------|------|---------|--------|-------------|
| `enabled` | bool | `false` | true/false | Turn data-driven highlighting on |
| `values` | text | `""` | comma-separated | Values of the Color field to highlight; all other groups turn grey and leave the legend |
| `color` | fill | `#BEBEBE` | any colour | Colour for unhighlighted marks |

---

### Facet Object (Small Multiples)

A field in the **Facet** well becomes `facet_wrap`: a roughly square grid
(4 levels → 2 × 2, 6 → 3 × 2, 9 → 3 × 3), like ggplot2's `wrap_dims`.

| Property | Type | Default | Values | Description |
|----------|------|---------|--------|-------------|
| `columns` | number | `0` | 0–12 | Grid columns; `0` = automatic |
| `freeX` | bool | `false` | true/false | Each panel scales X to its own data (`scales = "free_x"`) |
| `freeY` | bool | `false` | true/false | Same for the Y axis |

---

### Distribution Object (Density / Violin)

Shared options for the two kernel-density geoms — visible when a `density`
or `violin` layer is active.

| Property | Type | Default | Values | Description |
|----------|------|---------|--------|-------------|
| `adjust` | number | `1` | 0.1–10 | Bandwidth multiplier: 0.5 = wigglier, 2 = smoother (ggplot2 `adjust`) |
| `trim` | bool | `false` | true/false | Density layers: clip the curve to the observed data range (ggplot2 `trim`) |
| `violinTrim` | bool | `true` | true/false | Violin layers: clip each violin to its group's data range (separate toggle because the ggplot2 defaults differ) |
| `densityFill` | bool | `false` | true/false | Density layers: fill the area under the curve |
| `fillAlpha` | number | `0.3` | 0–1 | Opacity of the filled area |
| `violinScale` | enum | `area` | `area`, `count`, `width` | Width scaling across violins (ggplot2 `scale`) |

---

### Reference Lines Object

Overlay lines that do **not** consume one of the three layer slots.
Positions accept plain numbers **and** the keywords `mean` / `median`
(also `avg`, `average`), computed from the mapped X/Y values — the
"show the average" case without a DAX measure.

| Property | Type | Default | Values | Description |
|----------|------|---------|--------|-------------|
| `show` | bool | `false` | true/false | Turn reference lines on |
| `hlineAt` | text | `""` | e.g. `mean` or `mean, 30` | Horizontal line(s) at these Y positions |
| `vlineAt` | text | `""` | e.g. `median, 3.5` | Vertical line(s) at these X positions |
| `lineColor` | fill | `#E15759` | any colour | Line colour |
| `lineStyle` | enum | `dashed` | see [Line Types](#line-types) | Dash pattern |
| `lineWidth` | number | `1` | 0.5–10 | Line width in px |

Unparsable entries are skipped rather than failing the render. Like in
ggplot2, reference lines do not extend the axis limits, and a continuous
intercept cannot be placed on a discrete (category) axis.

---

### Boxplot Object

Separate object for boxplot-specific stat parameters.
Only relevant when a layer uses `type: "boxplot"`.

| Property | Type | Default | ggplot2 | Values | Description |
|----------|------|---------|---------|--------|-------------|
| `coef` | number | `1.5` | `coef` | 0–100 | Whisker length as IQR multiplier |
| `notch` | bool | `false` | `notch` | `true` / `false` | Notched box (CI around median) |
| `notchWidth` | number | `0.5` | `notchwidth` | 0.1–1 | Notch width relative to box |
| `varWidth` | bool | `false` | `varwidth` | `true` / `false` | Box width proportional to √n |
| `stapleWidth` | number | `0` | `staplewidth` | 0–1 | Whisker cap width (0 = no cap) |
| `fatten` | number | `2` | `fatten` | 0.5–10 | Median line thickness multiplier |
| `boxWidth` | number | `0.9` | `width` | 0.1–1 | Box width as fraction of bandwidth |
| `boxFillColor` | color | `""` (white) | `fill` | any color | Box fill color |
| `outlierShow` | bool | `true` | `outliers` | `true` / `false` | Show outlier points |
| `outlierSize` | number | `1.5` | `outlier.size` | 0.5–10 | Outlier point size |
| `outlierShape` | enum | `circle` | `outlier.shape` | see [Shapes](#shapes) (subset) | Outlier shape |

### Histogram Object

Separate object for histogram-specific stat_bin parameters.
Only relevant when a layer uses `type: "histogram"`.

| Property | Type | Default | ggplot2 | Values | Description |
|----------|------|---------|---------|--------|-------------|
| `bins` | number | `30` | `bins` | 1–500 | Number of bins |
| `binwidth` | number | `0` | `binwidth` | 0–∞ | Bin width in data units (overrides bins; 0 = use bins) |
| `boundary` | number | `0` | `boundary` | any | Boundary between two bins (determines alignment) |
| `center` | number | `0` | `center` | any | Center of one bin (determines alignment; ignored when 0) |
| `closed` | enum | `right` | `closed` | `right`, `left` | Which side of the interval is closed |
| `pad` | bool | `false` | `pad` | `true` / `false` | Add zero-count bins at range boundaries |
| `drop` | enum | `none` | `drop` | `none`, `all`, `extremes` | Keep empty bins, remove all empty bins, or trim empty edge bins |
| `histYAxis` | enum | `count` | `after_stat(...)` | `count`, `density`, `ncount`, `ndensity` | Computed statistic mapped to the Y axis |
| `histFillColor` | color | `""` | `fill` | any color | Histogram fill color |
| `histBorderColor` | color | `""` | `colour` | any color | Histogram bin border color |
| `histBorderWidth` | number | `0.5` | `linewidth` | 0–10 | Histogram bin border width |
| `histBorderStyle` | enum | `solid` | `linetype` | see [Line Types](#line-types) | Histogram bin border line type |
| `histTransparency` | number | `0` | `alpha` | 0–100 | Histogram transparency percentage |

**Binning priority**: `breaks` (programmatic only) > `binwidth` > `bins`.
Set only one of `center` and `boundary`; when both are non-zero, `center` takes precedence.

**Example:**

```json
"histogram": [{
  "properties": {
    "bins": { "expr": { "Literal": { "Value": "20" } } },
    "binwidth": { "expr": { "Literal": { "Value": "0" } } },
    "boundary": { "expr": { "Literal": { "Value": "0" } } },
    "center": { "expr": { "Literal": { "Value": "0" } } },
    "closed": { "expr": { "Literal": { "Value": "'right'" } } },
    "pad": { "expr": { "Literal": { "Value": "false" } } },
    "drop": { "expr": { "Literal": { "Value": "'none'" } } },
    "histYAxis": { "expr": { "Literal": { "Value": "'count'" } } },
    "histBorderColor": { "solid": { "color": { "expr": { "Literal": { "Value": "'#333333'" } } } } },
    "histBorderWidth": { "expr": { "Literal": { "Value": "1" } } },
    "histBorderStyle": { "expr": { "Literal": { "Value": "'dashed'" } } },
    "histTransparency": { "expr": { "Literal": { "Value": "25" } } }
  }
}]
```

---

## vcObjects (Visual Container)

`vcObjects` controls the **visual container** — the frame around the chart.
These are standard Power BI properties, not ggpbi-specific.

```json
"vcObjects": {
  "background": [{
    "properties": {
      "show": { "expr": { "Literal": { "Value": "true" } } },
      "color": { "solid": { "color": "#FFFFFF" } },
      "transparency": { "expr": { "Literal": { "Value": "0" } } }
    }
  }],
  "title": [{
    "properties": {
      "show": { "expr": { "Literal": { "Value": "false" } } },
      "text": { "expr": { "Literal": { "Value": "'My Chart'" } } }
    }
  }],
  "border": [{
    "properties": {
      "show": { "expr": { "Literal": { "Value": "false" } } }
    }
  }],
  "padding": [{
    "properties": {
      "top": { "expr": { "Literal": { "Value": "0" } } },
      "bottom": { "expr": { "Literal": { "Value": "0" } } },
      "left": { "expr": { "Literal": { "Value": "0" } } },
      "right": { "expr": { "Literal": { "Value": "0" } } }
    }
  }]
}
```

Common vcObjects:

| Object | Properties | Description |
|--------|-----------|-------------|
| `background` | `show`, `color`, `transparency` | Visual container background |
| `title` | `show`, `text`, `fontColor`, `fontSize` | Visual title bar |
| `border` | `show`, `color`, `radius` | Visual border |
| `padding` | `top`, `bottom`, `left`, `right` | Inner padding |

---

## Filters

Visual-level filters restrict the data sent to the visual.

```json
"filterConfig": {
  "filters": [
    {
      "name": "Filter1",
      "field": { "Column": { "Expression": { "SourceRef": { "Entity": "DimDate" } }, "Property": "Year" } },
      "type": "Categorical",
      "filter": {
        "Version": 2,
        "From": [{ "Name": "d", "Entity": "DimDate", "Type": 0 }],
        "Where": [{
          "Condition": {
            "In": {
              "Expressions": [{ "Column": { "Expression": { "SourceRef": { "Source": "d" } }, "Property": "Year" } }],
              "Values": [[{ "Literal": { "Value": "2024L" } }]]
            }
          }
        }]
      },
      "isHiddenInViewMode": true
    }
  ]
}
```

---

## Enumerations Reference

### Geom Types

| Value | DisplayName | ggplot2 | stat | Description |
|-------|-------------|---------|------|-------------|
| `auto` | Auto | — | auto | Auto-detect from data types |
| `col` | Bar | `geom_col` | identity | Bar chart (Y values from data) |
| `bar` | Count | `geom_bar` | count | Bar chart (counts observations) |
| `point` | Point | `geom_point` | identity | Scatter plot |
| `line` | Line | `geom_line` | identity | Line chart (sorted by X) |
| `area` | Area | `geom_area` | identity | Area chart |
| `text` | Text | `geom_text` | identity | Text labels |
| `boxplot` | Boxplot | `geom_boxplot` | boxplot | Tukey boxplot |
| `histogram` | Histogram | `geom_histogram` | bin | Histogram (bins continuous data) |
| `smooth` | Smooth | `geom_smooth` | smooth | Trend line (lm/loess) with confidence band |
| `segment` | Segment | `geom_segment` | identity | Segments x→x2 (or y1→y2); 2nd measure in the well = end |
| `pointrange` | Point range | `geom_pointrange` | identity | Dot + range line; measures 2/3 in the well = min/max |

### Position Types

| Value | DisplayName | ggplot2 | Description |
|-------|-------------|---------|-------------|
| `identity` | Identity | `position_identity` | No adjustment (overlap) |
| `stack` | Stacked | `position_stack` | Stack bars per category |
| `dodge` | Dodge | `position_dodge` | Side by side per category |
| `dodge2` | Dodge (padded) | `position_dodge2` | Side by side with padding |
| `fill` | Fill (100%) | `position_fill` | Stack normalized to 100% |
| `jitter` | Jitter | `position_jitter` | Random displacement (scatter) |

### Line Types

| Value | ggplot2 Nr | SVG stroke-dasharray | Description |
|-------|-----------|---------------------|-------------|
| `solid` | 1 | — | Solid |
| `dashed` | 2 | `6 4` | Dashed |
| `dotted` | 3 | `2 3` | Dotted |
| `dashdot` | 4 | `6 3 2 3` | Dash-dot |
| `longdash` | 5 | `10 4` | Long dashed |
| `twodash` | 6 | `2 2 8 2` | Two-dash |

### Shapes

| Value | ggplot2 pch | Category | Behavior |
|-------|-------------|----------|----------|
| `circle` | 19 | Filled | `colour` = fill |
| `square` | 15 | Filled | `colour` = fill |
| `triangle` | 17 | Filled | `colour` = fill |
| `diamond` | 18 | Filled | `colour` = fill |
| `circleOpen` | 1 | Open | `colour` = stroke only |
| `squareOpen` | 0 | Open | `colour` = stroke only |
| `triangleOpen` | 2 | Open | `colour` = stroke only |
| `diamondOpen` | 5 | Open | `colour` = stroke only |
| `circleFilled` | 21 | Fill+Border | `fill` = interior, `colour` = stroke |
| `squareFilled` | 22 | Fill+Border | `fill` = interior, `colour` = stroke |
| `triangleFilled` | 24 | Fill+Border | `fill` = interior, `colour` = stroke |
| `diamondFilled` | 23 | Fill+Border | `fill` = interior, `colour` = stroke |
| `plus` | 3 | Line | `colour` = stroke |
| `cross` | 4 | Line | `colour` = stroke |
| `asterisk` | 8 | Line | `colour` = stroke |
| `star` | 11 | Line | `colour` = stroke |

Outlier shapes (subset): `circle`, `square`, `triangle`, `diamond`, `circleOpen`, `plus`, `cross`.

### Scale Types

Both `scaleX` and `scaleY` accept the same set:

| Value | DisplayName | Description |
|-------|-------------|-------------|
| `auto` | Auto | Detect from data |
| `linear` | Linear | Numeric axis |
| `log` | Logarithmic | Log scale (requires positive values) |
| `sqrt` | Square root | Square root transformation |
| `time` | Time | Date/time axis |
| `ordinal` | Ordinal (discrete) | Discrete band axis |
| `category` | Category (discrete) | Discrete band axis that also accepts numeric group codes (`0.5`, `1`, `2`) — the equivalent of R's `factor()`. Use this for bars and boxplots over numeric doses/years |

---

## Auto-Detection Rules

When `layer.type` is `auto`, ggpbi selects the geom based on field types:

| X | Y | Auto Geom | Notes |
|---|---|-----------|-------|
| Category | Numeric | `col` (bar) | stat_identity — or stat_sum when several rows share a category (e.g. a column set to *Don't summarize*) |
| Category | — | `bar` | stat_count |
| Numeric | — | `histogram` | stat_bin (30 bins default) |
| Numeric | Numeric | `point` | Scatter ("Don't summarize" on X) |
| Numeric | Category | `col` (bar, horizontal) | One row per category → value bars (geom_col orientation inference) |
| Numeric | Category | `point` | Multiple rows per category (via `detail`) → horizontal strip; line layers group by Y band |
| Time | Numeric | `line` | Time series |
| — | Numeric | `boxplot` | Distribution |

---

## Complete Examples

### Example 1: Minimal Bar Chart

The simplest valid ggpbi visual — only required fields, everything else auto:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/1.4.0/schema.json",
  "name": "a1b2c3d4e5f6g7h8i9j0",
  "position": { "x": 40, "y": 40, "z": 0, "width": 600, "height": 400 },
  "visual": {
    "visualType": "ggpbiGrammarOfGraphics",
    "query": {
      "queryState": {
        "x": { "projections": [{ "queryRef": "DimProduct.Category", "active": true }] },
        "y": { "projections": [{ "queryRef": "FactSales.Revenue", "active": true }] }
      }
    },
    "dataRoleBindings": {
      "x": { "bindings": [{ "queryRef": "DimProduct.Category", "kind": 0 }] },
      "y": { "bindings": [{ "queryRef": "FactSales.Revenue", "kind": 0 }] }
    },
    "objects": {
      "layer1": [{
        "properties": {
          "enabled": { "expr": { "Literal": { "Value": "true" } } },
          "type": { "expr": { "Literal": { "Value": "'col'" } } }
        }
      }]
    }
  }
}
```

### Example 2: Combo Chart (Bar + Line) with Two Y Fields

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/1.4.0/schema.json",
  "name": "combo01234567890abcde",
  "position": { "x": 40, "y": 40, "z": 0, "width": 800, "height": 450 },
  "visual": {
    "visualType": "ggpbiGrammarOfGraphics",
    "query": {
      "queryState": {
        "x": { "projections": [{ "queryRef": "DimDate.Month", "active": true }] },
        "y": { "projections": [
          { "queryRef": "FactSales.Revenue", "active": true },
          { "queryRef": "FactSales.Target", "active": true }
        ]}
      }
    },
    "dataRoleBindings": {
      "x": { "bindings": [{ "queryRef": "DimDate.Month", "kind": 0 }] },
      "y": { "bindings": [
        { "queryRef": "FactSales.Revenue", "kind": 0 },
        { "queryRef": "FactSales.Target", "kind": 0 }
      ]}
    },
    "objects": {
      "layer1": [{
        "properties": {
          "enabled": { "expr": { "Literal": { "Value": "true" } } },
          "type": { "expr": { "Literal": { "Value": "'col'" } } },
          "yField": { "expr": { "Literal": { "Value": "'y1'" } } },
          "alpha": { "expr": { "Literal": { "Value": "0.8" } } }
        }
      }],
      "layer2": [{
        "properties": {
          "enabled": { "expr": { "Literal": { "Value": "true" } } },
          "type": { "expr": { "Literal": { "Value": "'line'" } } },
          "yField": { "expr": { "Literal": { "Value": "'y2'" } } },
          "size": { "expr": { "Literal": { "Value": "2" } } },
          "lineStyle": { "expr": { "Literal": { "Value": "'dashed'" } } }
        }
      }]
    }
  }
}
```

### Example 3: Scatter with Color Grouping and Dark Theme

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/1.4.0/schema.json",
  "name": "scatter567890abcdefghij",
  "position": { "x": 40, "y": 40, "z": 0, "width": 700, "height": 500 },
  "visual": {
    "visualType": "ggpbiGrammarOfGraphics",
    "query": {
      "queryState": {
        "x": { "projections": [{ "queryRef": "Cars.Weight", "active": true }] },
        "y": { "projections": [{ "queryRef": "Cars.MPG", "active": true }] },
        "color": { "projections": [{ "queryRef": "Cars.Origin", "active": true }] }
      }
    },
    "dataRoleBindings": {
      "x": { "bindings": [{ "queryRef": "Cars.Weight", "kind": 0 }] },
      "y": { "bindings": [{ "queryRef": "Cars.MPG", "kind": 0 }] },
      "color": { "bindings": [{ "queryRef": "Cars.Origin", "kind": 0 }] }
    },
    "objects": {
      "layer1": [{
        "properties": {
          "type": { "expr": { "Literal": { "Value": "'point'" } } },
          "size": { "expr": { "Literal": { "Value": "5" } } },
          "shape": { "expr": { "Literal": { "Value": "'diamondFilled'" } } },
          "pointFill": { "solid": { "color": "#FFD700" } },
          "strokeWidth": { "expr": { "Literal": { "Value": "1.5" } } }
        }
      }],
      "theme": [{
        "properties": {
          "panelFill": { "solid": { "color": "#2D2D2D" } },
          "gridlineColor": { "solid": { "color": "#444444" } },
          "ink": { "solid": { "color": "#E0E0E0" } },
          "paper": { "solid": { "color": "#1A1A1A" } },
          "baseSize": { "expr": { "Literal": { "Value": "12" } } }
        }
      }],
      "legend": [{
        "properties": {
          "show": { "expr": { "Literal": { "Value": "true" } } },
          "position": { "expr": { "Literal": { "Value": "'bottom'" } } }
        }
      }]
    }
  }
}
```

### Example 4: Boxplot with Notch, Faceted

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/1.4.0/schema.json",
  "name": "boxplot890abcdefghijk",
  "position": { "x": 40, "y": 40, "z": 0, "width": 900, "height": 400 },
  "visual": {
    "visualType": "ggpbiGrammarOfGraphics",
    "query": {
      "queryState": {
        "x": { "projections": [{ "queryRef": "Iris.Species", "active": true }] },
        "y": { "projections": [{ "queryRef": "Iris.SepalLength", "active": true }] },
        "facet": { "projections": [{ "queryRef": "Iris.PetalClass", "active": true }] }
      }
    },
    "dataRoleBindings": {
      "x": { "bindings": [{ "queryRef": "Iris.Species", "kind": 0 }] },
      "y": { "bindings": [{ "queryRef": "Iris.SepalLength", "kind": 0 }] },
      "facet": { "bindings": [{ "queryRef": "Iris.PetalClass", "kind": 0 }] }
    },
    "objects": {
      "layer1": [{
        "properties": {
          "type": { "expr": { "Literal": { "Value": "'boxplot'" } } }
        }
      }],
      "boxplot": [{
        "properties": {
          "notch": { "expr": { "Literal": { "Value": "true" } } },
          "stapleWidth": { "expr": { "Literal": { "Value": "0.5" } } },
          "coef": { "expr": { "Literal": { "Value": "1.5" } } },
          "outlierShape": { "expr": { "Literal": { "Value": "'diamond'" } } }
        }
      }]
    }
  }
}
```

### Example 5: Three-Layer Combo with Custom Colors

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/1.4.0/schema.json",
  "name": "threelayer0123456789ab",
  "position": { "x": 40, "y": 40, "z": 0, "width": 800, "height": 500 },
  "visual": {
    "visualType": "ggpbiGrammarOfGraphics",
    "query": {
      "queryState": {
        "x": { "projections": [{ "queryRef": "DimDate.Quarter", "active": true }] },
        "y": { "projections": [
          { "queryRef": "Fact.Revenue", "active": true },
          { "queryRef": "Fact.Costs", "active": true },
          { "queryRef": "Fact.Margin", "active": true }
        ]}
      }
    },
    "dataRoleBindings": {
      "x": { "bindings": [{ "queryRef": "DimDate.Quarter", "kind": 0 }] },
      "y": { "bindings": [
        { "queryRef": "Fact.Revenue", "kind": 0 },
        { "queryRef": "Fact.Costs", "kind": 0 },
        { "queryRef": "Fact.Margin", "kind": 0 }
      ]}
    },
    "objects": {
      "layer1": [{
        "properties": {
          "enabled": { "expr": { "Literal": { "Value": "true" } } },
          "type": { "expr": { "Literal": { "Value": "'col'" } } },
          "yField": { "expr": { "Literal": { "Value": "'y1'" } } },
          "alpha": { "expr": { "Literal": { "Value": "0.6" } } }
        }
      }],
      "layer2": [{
        "properties": {
          "enabled": { "expr": { "Literal": { "Value": "true" } } },
          "type": { "expr": { "Literal": { "Value": "'line'" } } },
          "yField": { "expr": { "Literal": { "Value": "'y2'" } } },
          "size": { "expr": { "Literal": { "Value": "2" } } },
          "fill": { "solid": { "color": "#E66C37" } }
        }
      }],
      "layer3": [{
        "properties": {
          "enabled": { "expr": { "Literal": { "Value": "true" } } },
          "type": { "expr": { "Literal": { "Value": "'point'" } } },
          "yField": { "expr": { "Literal": { "Value": "'y3'" } } },
          "size": { "expr": { "Literal": { "Value": "6" } } },
          "fill": { "solid": { "color": "#2E7D32" } }
        }
      }],
      "scaleX": [{
        "properties": {
          "label": { "expr": { "Literal": { "Value": "'Quarter'" } } }
        }
      }],
      "scaleY": [{
        "properties": {
          "label": { "expr": { "Literal": { "Value": "'EUR'" } } }
        }
      }]
    }
  }
}
```

### Example 6: Horizontal Grouped Bars with Jitter Overlay

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/1.4.0/schema.json",
  "name": "jitter0123456789abcdef",
  "position": { "x": 40, "y": 40, "z": 0, "width": 600, "height": 500 },
  "visual": {
    "visualType": "ggpbiGrammarOfGraphics",
    "query": {
      "queryState": {
        "x": { "projections": [{ "queryRef": "Survey.Department", "active": true }] },
        "y": { "projections": [{ "queryRef": "Survey.Score", "active": true }] },
        "color": { "projections": [{ "queryRef": "Survey.Gender", "active": true }] }
      }
    },
    "dataRoleBindings": {
      "x": { "bindings": [{ "queryRef": "Survey.Department", "kind": 0 }] },
      "y": { "bindings": [{ "queryRef": "Survey.Score", "kind": 0 }] },
      "color": { "bindings": [{ "queryRef": "Survey.Gender", "kind": 0 }] }
    },
    "objects": {
      "layer1": [{
        "properties": {
          "enabled": { "expr": { "Literal": { "Value": "true" } } },
          "type": { "expr": { "Literal": { "Value": "'col'" } } },
          "position": { "expr": { "Literal": { "Value": "'dodge'" } } },
          "orientation": { "expr": { "Literal": { "Value": "'y'" } } },
          "alpha": { "expr": { "Literal": { "Value": "0.4" } } }
        }
      }],
      "layer2": [{
        "properties": {
          "enabled": { "expr": { "Literal": { "Value": "true" } } },
          "type": { "expr": { "Literal": { "Value": "'point'" } } },
          "position": { "expr": { "Literal": { "Value": "'jitter'" } } },
          "jitterWidth": { "expr": { "Literal": { "Value": "0.2" } } },
          "jitterHeight": { "expr": { "Literal": { "Value": "0.1" } } },
          "size": { "expr": { "Literal": { "Value": "3" } } }
        }
      }]
    }
  }
}
```

### Example 7: Line with Arrow

```json
{
  "objects": {
    "layer1": [{
      "properties": {
        "type": { "expr": { "Literal": { "Value": "'line'" } } },
        "size": { "expr": { "Literal": { "Value": "2" } } },
        "arrowShow": { "expr": { "Literal": { "Value": "true" } } },
        "arrowType": { "expr": { "Literal": { "Value": "'closed'" } } },
        "arrowLength": { "expr": { "Literal": { "Value": "12" } } },
        "arrowEnds": { "expr": { "Literal": { "Value": "'last'" } } }
      }
    }]
  }
}
```

---

## ggpbir Property → ggplot2 Mapping

| ggpbir Property | ggplot2 Equivalent | Notes |
|---------------|-------------------|-------|
| `layer1.type` | `geom_*()` | `col` = `geom_col`, `bar` = `geom_bar`, etc. |
| `layer1.alpha` | `alpha` | Transparency |
| `layer1.size` | `size` / `linewidth` | Point radius or line width |
| `layer1.fill` | `colour` / `fill` | Static color override |
| `layer1.lineStyle` | `linetype` | Dash pattern |
| `layer1.position` | `position` | `position_stack()`, `position_dodge()`, etc. |
| `layer1.orientation` | `orientation` | `"x"` or `"y"` |
| `layer1.shape` | `shape` | Point shape (pch number → name) |
| `layer1.pointFill` | `fill` | Fill for shapes 21–25 |
| `layer1.strokeWidth` | `stroke` | Border width |
| `layer1.just` | `just` | Bar alignment |
| `layer1.jitterWidth` | `width` (jitter) | Jitter width |
| `layer1.jitterHeight` | `height` (jitter) | Jitter height |
| `layer1.arrowShow` | `arrow` | Arrow on/off |
| `scaleX.type` | `scale_x_*()` | Scale type |
| `scaleX.label` | `xlab()` | Axis title |
| `scaleX.labelFormat` | `scale_x_continuous(labels=)` | `scales::label_number()` / `label_percent()` / `label_currency()` |
| `scaleX.dateFormat` | `scale_x_date(date_labels=)` | Date granularity |
| `scaleY.type` | `scale_y_*()` | Scale type |
| `scaleY.label` | `ylab()` | Axis title |
| `scaleY.labelFormat` | `scale_y_continuous(labels=)` | `scales::label_number()` / `label_percent()` / `label_currency()` |
| `scaleY.dateFormat` | `scale_y_date(date_labels=)` | Date granularity |
| `legend.show` | `theme(legend.position=)` | `FALSE` = `"none"` |
| `legend.position` | `theme(legend.position=)` | `"right"`, `"bottom"`, etc. |
| `theme.panelFill` | `panel.background` | Plot area background |
| `theme.gridlineColor` | `panel.grid` | Grid lines |
| `theme.ink` | `axis.text`, `axis.title` | Text color |
| `theme.paper` | `plot.background` | Outer background |
| `theme.baseSize` | `base_size` | `theme_grey(base_size=)` |

---

## Accessibility & Interactivity

### Accessibility

- **ARIA**: SVG `role="img"`, data points `role="listitem"` with `aria-label`
- **Keyboard**: Tab → Enter/Space (select) → Arrow keys (navigate) → Escape (clear)
- **High contrast**: Automatically detected via `host.colorPalette.isHighContrast`
- **Focus ring**: Blue outline on focused elements

### Cross-Filtering

Click on data points to cross-filter other visuals:

- **Single click**: Select one data point
- **Shift+click**: Add to selection (multi-select)
- **Background click**: Clear selection

Works with all geom types (bars, points, boxplot elements).

### Capabilities

| Feature | Value |
|---------|-------|
| `supportsHighlight` | `true` |
| `supportsMultiVisualSelection` | `true` |
| `supportsKeyboardFocus` | `true` |
| `supportsLandingPage` | `true` |
