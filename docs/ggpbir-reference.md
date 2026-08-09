# ggpbir Syntax Definition

> **ggpbir** is ggpbi's subset of PBIR — everything you need to define a valid
> ggpbi visual in a Power BI Enhanced Report (`.pbir`).

This document is the **complete specification** and the editing contract for
tooling: if you can write a valid `visual.json` following this reference, you
can build or modify any ggpbi chart without opening Power BI Desktop. It is
written to be sufficient on its own — an editor (human or LLM) should not need
the general PBIR documentation for ggpbi work.

**JSON Schema**: [`ggpbir.schema.json`](ggpbir.schema.json) validates a whole
ggpbi `visual.json` — field wells, objects, container. Validate every edit
against it; property typos and wrong enum values fail there instead of
rendering as a silently-default chart. The schema is generated from
`capabilities.json` (the file the visual itself parses) by
`npm run ggpbir-schema`, and the test suite regenerates and compares it, so
it cannot drift from what ggpbi accepts. The same tests validate every
example in this document and every visual in the demo report against it.

---

## Table of Contents

1. [File Structure](#file-structure)
2. [visual.json — Top Level](#visualjson--top-level)
3. [Position](#position)
4. [Visual Type](#visual-type)
5. [Field Wells — query.queryState](#field-wells--queryquerystate)
6. [Objects (ggpbir)](#objects-ggpbir)
   - [Value Encoding](#value-encoding)
   - [Layer Objects](#layer-objects-layer1-layer2-layer3)
   - [Scale Objects](#scale-objects-scalex-scaley)
   - [Legend Object](#legend-object)
   - [Theme Object](#theme-object)
   - [Highlight Object](#highlight-object-gghighlight)
   - [Facet Object](#facet-object-small-multiples)
   - [Distribution Object](#distribution-object-density--violin)
   - [Reference Lines Object](#reference-lines-object)
   - [Smooth Object](#smooth-object)
   - [Boxplot Object](#boxplot-object)
   - [Histogram Object](#histogram-object)
7. [visualContainerObjects](#visualcontainerobjects)
8. [Filters](#filters)
9. [Rules and Invariants](#rules-and-invariants)
10. [Editing Recipes](#editing-recipes)
11. [Enumerations Reference](#enumerations-reference)
12. [Auto-Detection Rules](#auto-detection-rules)
13. [Complete Examples](#complete-examples)
14. [Accessibility & Interactivity](#accessibility--interactivity)

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

A complete ggpbi `visual.json` (skeleton — `…` marks sections detailed below):

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.11.0/schema.json",
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
    "query": { "queryState": { ... } },
    "objects": { ... },
    "visualContainerObjects": { ... },
    "drillFilterOtherVisuals": true
  }
}
```

| Property | Required | Description |
|----------|:--------:|-------------|
| `$schema` | yes | PBIR visualContainer schema URL. Current reports use `2.11.0`; Desktop upgrades old versions on open |
| `name` | yes | Unique ID, max 50 chars, **must match the folder name** the file lives in |
| `position` | yes | Placement and size on the canvas |
| `visual` | yes | Visual configuration (type, data, formatting) |
| `filterConfig` | no | Visual-level filters — Desktop-managed; ggpbi never requires one |
| `howCreated` | no | Origin tracking (`"Default"`, `"DraggedToCanvas"`, etc.) |
| `parentGroupName` | no | Group membership |
| `isHidden` | no | Hidden visual (for bookmarks) |
| `annotations` | no | Metadata annotations |

Inside `visual`:

| Property | Required | Description |
|----------|:--------:|-------------|
| `visualType` | yes | Always `"ggpbiGrammarOfGraphics"` |
| `query.queryState` | for any data | The field wells — see [Field Wells](#field-wells--queryquerystate) |
| `objects` | no | ggpbi formatting — see [Objects](#objects-ggpbir); everything has a working default |
| `visualContainerObjects` | no | Container frame (title, background) — see [visualContainerObjects](#visualcontainerobjects) |
| `drillFilterOtherVisuals` | no | Standard PBIR cross-filter flag; Desktop writes `true` |

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

## Field Wells — query.queryState

`query.queryState` **is** the field wells. Each key is a data role (a well),
each `projections` entry is one field dragged into it. This is the single
place data binding lives:

> **There is no `dataRoleBindings` in PBIR 2.x.** Older material (including
> earlier versions of this document) shows a `dataRoleBindings` section next
> to `query` — no working visual has one, and adding it does nothing.
> Desktop derives the wells entirely from `queryState`.

```json
"query": {
  "queryState": {
    "x": {
      "projections": [
        {
          "field": {
            "Column": {
              "Expression": { "SourceRef": { "Entity": "mtcars" } },
              "Property": "wt"
            }
          },
          "queryRef": "mtcars.wt",
          "nativeQueryRef": "wt",
          "active": true
        }
      ]
    },
    "y": {
      "projections": [
        {
          "field": {
            "Aggregation": {
              "Expression": {
                "Column": {
                  "Expression": { "SourceRef": { "Entity": "mtcars" } },
                  "Property": "mpg"
                }
              },
              "Function": 0
            }
          },
          "queryRef": "Sum(mtcars.mpg)",
          "nativeQueryRef": "Sum of mpg"
        }
      ]
    }
  }
}
```

### Anatomy of a projection

| Property | Required | Description |
|----------|:--------:|-------------|
| `field` | yes | Full field expression — one of the three kinds below |
| `queryRef` | yes | Canonical name of the field in this query. **Must be consistent everywhere it appears** (sorts, filters reference it) and unique per projection |
| `nativeQueryRef` | no | Display name Desktop shows in the well (e.g. `Sum of mpg`) |
| `active` | no | Marks the projection driving drill/axis behaviour; Desktop sets it on the first x projection |

### The three field expression kinds

**Column** — a raw model column. `queryRef` is `Table.Column`:

```json
{
  "Column": {
    "Expression": { "SourceRef": { "Entity": "mtcars" } },
    "Property": "wt"
  }
}
```

**Measure** — a model measure (DAX). Same shape, `queryRef` is `Table.Measure`:

```json
{
  "Measure": {
    "Expression": { "SourceRef": { "Entity": "Stats" } },
    "Property": "Mean MPG"
  }
}
```

**Aggregation** — a column with a summarization applied ("Sum of hp").
Wraps a Column expression; `queryRef` is `Function(Table.Column)`,
`nativeQueryRef` is `"Function of Column"`:

```json
{
  "Aggregation": {
    "Expression": {
      "Column": {
        "Expression": { "SourceRef": { "Entity": "mtcars" } },
        "Property": "hp"
      }
    },
    "Function": 0
  }
}
```

| `Function` | Aggregation | `queryRef` prefix |
|:----------:|-------------|-------------------|
| 0 | Sum | `Sum(…)` |
| 1 | Average | `Avg(…)` |
| 2 | Count (distinct) | `CountNonNull(…)` / `Count(…)` |
| 3 | Min | `Min(…)` |
| 4 | Max | `Max(…)` |
| 5 | Count | `Count(…)` |
| 6 | Median | `Median(…)` |

The demo report exercises `Function: 0`; the other codes follow Power BI's
standard `QueryAggregateFunction` enum. A raw column with *Don't summarize*
is a plain **Column** expression — no wrapper.

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
- `Grouping` — categories only. A Measure/Aggregation projection in a
  Grouping-only role (`color`, `detail`, `facet`) never reaches the visual

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
    "highlight": [{ "properties": { ... } }],
    "facet": [{ "properties": { ... } }],
    "distribution": [{ "properties": { ... } }],
    "referenceLines": [{ "properties": { ... } }],
    "smooth": [{ "properties": { ... } }],
    "boxplot": [{ "properties": { ... } }],
    "histogram": [{ "properties": { ... } }]
  }
}
```

These 14 names are the complete set — anything else under `objects` is
rejected by the schema. Each object is an **array of one element** containing
a `properties` map. Every property has a working default: an empty `objects`
(or none at all) renders the auto-detected chart.

### Value Encoding

All property values use Power BI's expression format:

| Data Type | Encoding | Example |
|-----------|----------|---------|
| String enum | `{ "expr": { "Literal": { "Value": "'value'" } } }` | `"'point'"` |
| Number | `{ "expr": { "Literal": { "Value": "number" } } }` | `"0.7D"` (`D` = decimal, `L` = whole number; bare `"0.7"` parses too) |
| Boolean | `{ "expr": { "Literal": { "Value": "bool" } } }` | `"true"` |
| Color (hex) | `{ "solid": { "color": "#hex" } }` | `"#e74c3c"` |
| Color (theme) | `{ "solid": { "color": { "ThemeDataColor": { "ColorId": n, "Percent": p } } } }` | `ColorId: 0` |

**Important:** String values are wrapped in **single quotes** inside the JSON
string: `"Value": "'point'"` (not `"Value": "point"`). See
[Rules and Invariants](#rules-and-invariants) for the full encoding contract.

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
| `vimMode` | bool | `false` | true/false | Modal (vim-style) editing in the code overlay's editor. A default — `Ctrl+M` in the editor overrides it for the session; set it in a report theme's `visualStyles` to hold for every ggpbi visual in the report |
| `codeSyntax` | enum | `ggpbi` | `ggpbi`, `ggplot2`, `ggpbir` | Which language the code overlay speaks: the fluent ggpbi chain, ggplot2 (R), or ggpbir — this document's own visual.json shape, objects editable and persisted, wells greyed read-only |
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

### Smooth Object

Options for the trend-line geom. Only relevant when a layer uses
`type: "smooth"`.

| Property | Type | Default | ggplot2 | Values | Description |
|----------|------|---------|---------|--------|-------------|
| `method` | enum | `loess` | `method` | `loess`, `lm`, `movingAverage` | Fitting method. `movingAverage` has no direct ggplot2 equivalent |
| `se` | bool | `true` | `se` | true/false | Draw the confidence ribbon |
| `level` | number | `0.95` | `level` | 0.5–0.999 | Confidence level for the ribbon |
| `span` | number | `0.75` | `span` | 0.1–2 | LOESS neighbourhood size (also the moving-average window fraction) |
| `n` | number | `80` | `n` | 10–500 | Number of points the curve is evaluated at |
| `fullrange` | bool | `false` | `fullrange` | true/false | Extend the fit across the full x range instead of the data range |
| `smoothFillColor` | color | `""` (line colour) | `fill` | any color | Ribbon colour |
| `fillAlpha` | number | `0.4` | `alpha` | 0–1 | Ribbon opacity |
| `lineWidth` | number | `1` | `linewidth` | 0.5–10 | Trend line width |

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

## visualContainerObjects

`visualContainerObjects` (inside `visual`, next to `objects`) controls the
**visual container** — the frame around the chart. These are standard PBIR
properties, not ggpbi-specific. (Pre-2.x PBIR called this `vcObjects` at the
top level; in current reports it lives inside `visual` under this name.)

```json
"visual": {
  "visualType": "ggpbiGrammarOfGraphics",
  "query": { ... },
  "objects": { ... },
  "visualContainerObjects": {
    "title": [{
      "properties": {
        "show": { "expr": { "Literal": { "Value": "true" } } },
        "text": { "expr": { "Literal": { "Value": "'My Chart'" } } }
      }
    }],
    "background": [{
      "properties": {
        "show": { "expr": { "Literal": { "Value": "true" } } },
        "color": { "solid": { "color": "#FFFFFF" } },
        "transparency": { "expr": { "Literal": { "Value": "0" } } }
      }
    }]
  }
}
```

Common container objects:

| Object | Properties | Description |
|--------|-----------|-------------|
| `title` | `show`, `text`, `fontColor`, `fontSize` | Visual title bar. The demo report titles every visual this way |
| `background` | `show`, `color`, `transparency` | Visual container background |
| `border` | `show`, `color`, `radius` | Visual border |
| `padding` | `top`, `bottom`, `left`, `right` | Inner padding |

The container title and ggpbi's own `theme.subtitle` are independent: the
title is drawn by Power BI outside the chart, the subtitle by ggpbi inside it.

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

## Rules and Invariants

The constraints that hold across every valid ggpbi `visual.json`. The schema
enforces most of them mechanically; the rest are listed because breaking them
produces a chart that loads but lies.

### Literal encoding

Every Format Pane value is a **string** inside
`{ "expr": { "Literal": { "Value": "<encoded>" } } }`, and the encoding
carries the type:

| Type | Encoding | Examples |
|------|----------|----------|
| String / enum | single quotes **inside** the JSON string | `"'point'"`, `"'My title'"` |
| Decimal | digits, `D` suffix | `"0.6D"`, `"5D"` |
| Whole number | digits, `L` suffix | `"2024L"` |
| Boolean | bare | `"true"`, `"false"` |

Desktop always writes the suffixed number forms; plain digits (`"0.6"`,
`"20"`) parse too. The classic mistake is `"Value": "point"` — without the
inner quotes the enum silently fails to match and the property falls back to
its default.

### Structure

- Every object under `objects` is an **array of exactly one element** with a
  `properties` map inside. `"layer1": { … }` (no array) is invalid.
- The 14 object names and their property names are a **closed set** — a typo
  like `layer1.colour` or `boxplott` is not an error Power BI reports; the
  property is simply ignored. This is why validating against
  [`ggpbir.schema.json`](ggpbir.schema.json) matters: the schema sets
  `additionalProperties: false` everywhere and turns silent typos into
  validation errors.
- `name` must equal the folder the file lives in and be unique in the report.
- Two visuals on one page must not share `position.z`.

### queryState

- **The same `queryRef` string everywhere.** A field is identified by its
  `queryRef`; sorts and filters reference it by that exact string. Renaming a
  projection means updating every occurrence in the file.
- `queryRef` naming is convention, not decoration: `Table.Column` for
  columns and measures, `Function(Table.Column)` for aggregations. Desktop
  regenerates these names — inventing a different scheme survives until the
  next Desktop edit, then diffs noisily.
- Role capacities (3× x, 3× y, 1× color/size/detail/label/facet) are hard
  limits from `capabilities.json` — a fourth y projection never reaches the
  visual.
- `color`, `detail` and `facet` are Grouping-only: a Measure or Aggregation
  projection there is discarded before the visual sees it.
- A projection is **removed**, not disabled — there is no `enabled` flag on
  projections. To take a field out of a well, delete its entry.

### Layers and wells together

- `layerN.yField: 'yN'` refers to the **position** of a projection in the
  `y` well (first = `y1`, second = `y2`, third = `y3`) — not to a field
  name. Removing the second y projection makes a `yField: 'y2'` layer dangle;
  it falls back to auto. Keep layer `yField`s and the y projection list in
  sync.
- `layer1` is enabled by default; `layer2`/`layer3` must set
  `enabled: true` to render. A disabled layer keeps its settings.
- Distribution options live in `distribution`, smooth options in `smooth`,
  boxplot options in `boxplot`, histogram options in `histogram` — the layer
  object only carries `type` and shared aesthetics. Setting `smooth.method`
  without any layer of `type: 'smooth'` does nothing.
- Row-counting geoms (histogram, boxplot, violin, density, bar with count)
  operate on the rows Power BI delivers, which are **distinct combinations
  of the bound fields** — not source rows. To count actual rows, a field
  that is unique per row must be in some well (`detail` exists for this).
  The visual warns when it detects this situation (`theme.warnAggregated`).

### What you never need to write

- `dataRoleBindings` — does not exist in PBIR 2.x.
- `filterConfig` — Desktop-managed; a visual without one shows everything.
- `howCreated`, `annotations` — origin metadata, no rendering effect.

---

## Editing Recipes

The changes an editor actually makes, each with **every place that moves
together**. Paths are relative to `visual.json`. After any edit, validate the
file against [`ggpbir.schema.json`](ggpbir.schema.json).

### Read a visual's current state

1. Wells: `visual.query.queryState` — role → projections → `nativeQueryRef`
   is the human name, the `field` expression is the truth.
2. Chart type: `visual.objects.layer1[0].properties.type`, if absent →
   auto-detected from the wells (see [Auto-Detection Rules](#auto-detection-rules)).
3. Which y feeds which layer: `layerN.yField` (`'y1'` = first y projection).

### Change the geom

Touch **one place**: `objects.layerN[0].properties.type`.

```json
"layer1": [{ "properties": {
  "enabled": { "expr": { "Literal": { "Value": "true" } } },
  "type": { "expr": { "Literal": { "Value": "'line'" } } }
} }]
```

Moves together:
- Geom-specific options live in their own object (`boxplot`, `histogram`,
  `smooth`, `distribution`) — switching the type away leaves them inert, no
  cleanup needed; switching **to** such a type is where you set them.
- Check the wells still fit the geom: `histogram`/`density` want only x
  (numeric); `boxplot`/`violin` want categorical x + numeric y; `point`
  wants numeric x and y. A mismatched well combination renders a hint, not
  a chart.

### Add a second series (measure) to Y

Two places move together:

1. **Append a projection** to `queryState.y.projections` (Aggregation or
   Measure — see [field kinds](#the-three-field-expression-kinds)).
2. Optionally **claim it in a layer**: without any layer changes the new
   field renders with auto settings; to control it, enable `layer2` and bind
   it:

```json
"layer2": [{ "properties": {
  "enabled": { "expr": { "Literal": { "Value": "true" } } },
  "type":    { "expr": { "Literal": { "Value": "'line'" } } },
  "yField":  { "expr": { "Literal": { "Value": "'y2'" } } }
} }]
```

### Remove a layer / a series

The reverse, and **both halves matter**:

1. Delete the projection from `queryState.y.projections`.
2. Delete (or disable) the layer object that carried it, and re-check every
   remaining `yField`: positions shift when an earlier projection goes away
   (the old `y2` becomes `y1`).

Removing only the layer object but not the projection leaves the field in
the query — it still costs a column in the data reduction and reappears on
the next auto layer.

### Add a facet (small multiples)

1. Add the field to `queryState.facet.projections` (Grouping — a raw column).
2. Optionally shape the grid in `objects.facet`:

```json
"facet": [{ "properties": {
  "columns": { "expr": { "Literal": { "Value": "3D" } } },
  "freeX":   { "expr": { "Literal": { "Value": "false" } } }
} }]
```

Removing the projection disables faceting; the `facet` object may stay.

### Add colour grouping

1. Add a Grouping projection to `queryState.color.projections`.
2. Nothing else is required — the legend appears automatically
   (`legend.show` / `legend.position` to adjust).

A `layerN.fill` colour **overrides** the colour aesthetic for that layer;
delete the `fill` property when introducing colour grouping, or the layer
stays monochrome.

### Switch a column between raw and aggregated

Replace the `field` expression **and both refs** in place:

- raw → summed: wrap the Column in an Aggregation
  (`queryRef: "Sum(t.c)"`, `nativeQueryRef: "Sum of c"`),
- summed → raw: unwrap it (`queryRef: "t.c"`, `nativeQueryRef: "c"`).

Anything referencing the old `queryRef` (sorts, `filterConfig`) must change
with it. Raw columns matter for distribution geoms: a histogram over
`Sum(x)` bins one number per category, almost never what was meant.

### Retitle, move, resize

- Container title: `visual.visualContainerObjects.title[0].properties.text`
  — a string literal, so the value keeps its inner quotes: `"'New title'"`.
- Geometry: `position` (`x`, `y`, `width`, `height`) — plain numbers, no
  literal wrapper, page coordinates in px.
- ggpbi's own subtitle line: `objects.theme.subtitle` (`off`/`auto`/`always`).

### Style without touching data

Theme, highlight, reference lines, scales and legend are pure `objects`
edits — `queryState` never changes:

- Dark mode: `theme.preset: 'dark'`.
- Log axis: `scaleY.type: 'log'`.
- Mean line: `referenceLines.show: true`, `hlineAt: 'mean'`.
- Highlight one group: `highlight.enabled: true`, `values: 'Europe'`.

---

## Enumerations Reference

### Geom Types

The complete `layerN.type` enumeration — these 13 values and no others:

| Value | DisplayName | ggplot2 | stat | Description |
|-------|-------------|---------|------|-------------|
| `auto` | Auto | — | auto | Auto-detect from data types |
| `bar` | Bar | `geom_bar` / `geom_col` | auto | Bar chart. With a y field → values (`geom_col`, stat identity); without → counts (`geom_bar`, stat count). There is **no separate `col` value** in ggpbir — `col` exists only in the TypeScript API |
| `point` | Point | `geom_point` | identity | Scatter plot |
| `line` | Line | `geom_line` | identity | Line chart (sorted by X) |
| `area` | Area | `geom_area` | identity | Area chart |
| `text` | Text | `geom_text` | identity | Text labels |
| `boxplot` | Boxplot | `geom_boxplot` | boxplot | Tukey boxplot |
| `histogram` | Histogram | `geom_histogram` | bin | Histogram (bins continuous data) |
| `smooth` | Smooth | `geom_smooth` | smooth | Trend line (lm/loess/moving average) with confidence band |
| `segment` | Segment | `geom_segment` | identity | Segments x→x2 (or y1→y2); 2nd measure in the well = end |
| `pointrange` | Point range | `geom_pointrange` | identity | Dot + range line; measures 2/3 in the well = min/max |
| `density` | Density | `geom_density` | density | Kernel density curve over a numeric x |
| `violin` | Violin | `geom_violin` | density | Violin plot per category |

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
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.11.0/schema.json",
  "name": "a1b2c3d4e5f6g7h8i9j0",
  "position": {
    "x": 40,
    "y": 40,
    "z": 0,
    "width": 600,
    "height": 400
  },
  "visual": {
    "visualType": "ggpbiGrammarOfGraphics",
    "query": {
      "queryState": {
        "x": {
          "projections": [
            {
              "field": {
                "Column": {
                  "Expression": {
                    "SourceRef": {
                      "Entity": "DimProduct"
                    }
                  },
                  "Property": "Category"
                }
              },
              "queryRef": "DimProduct.Category",
              "nativeQueryRef": "Category",
              "active": true
            }
          ]
        },
        "y": {
          "projections": [
            {
              "field": {
                "Column": {
                  "Expression": {
                    "SourceRef": {
                      "Entity": "FactSales"
                    }
                  },
                  "Property": "Revenue"
                }
              },
              "queryRef": "FactSales.Revenue",
              "nativeQueryRef": "Revenue",
              "active": true
            }
          ]
        }
      }
    },
    "objects": {
      "layer1": [
        {
          "properties": {
            "enabled": {
              "expr": {
                "Literal": {
                  "Value": "true"
                }
              }
            },
            "type": {
              "expr": {
                "Literal": {
                  "Value": "'bar'"
                }
              }
            }
          }
        }
      ]
    }
  }
}
```

### Example 2: Combo Chart (Bar + Line) with Two Y Fields

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.11.0/schema.json",
  "name": "combo01234567890abcde",
  "position": {
    "x": 40,
    "y": 40,
    "z": 0,
    "width": 800,
    "height": 450
  },
  "visual": {
    "visualType": "ggpbiGrammarOfGraphics",
    "query": {
      "queryState": {
        "x": {
          "projections": [
            {
              "field": {
                "Column": {
                  "Expression": {
                    "SourceRef": {
                      "Entity": "DimDate"
                    }
                  },
                  "Property": "Month"
                }
              },
              "queryRef": "DimDate.Month",
              "nativeQueryRef": "Month",
              "active": true
            }
          ]
        },
        "y": {
          "projections": [
            {
              "field": {
                "Column": {
                  "Expression": {
                    "SourceRef": {
                      "Entity": "FactSales"
                    }
                  },
                  "Property": "Revenue"
                }
              },
              "queryRef": "FactSales.Revenue",
              "nativeQueryRef": "Revenue",
              "active": true
            },
            {
              "field": {
                "Column": {
                  "Expression": {
                    "SourceRef": {
                      "Entity": "FactSales"
                    }
                  },
                  "Property": "Target"
                }
              },
              "queryRef": "FactSales.Target",
              "nativeQueryRef": "Target",
              "active": true
            }
          ]
        }
      }
    },
    "objects": {
      "layer1": [
        {
          "properties": {
            "enabled": {
              "expr": {
                "Literal": {
                  "Value": "true"
                }
              }
            },
            "type": {
              "expr": {
                "Literal": {
                  "Value": "'bar'"
                }
              }
            },
            "yField": {
              "expr": {
                "Literal": {
                  "Value": "'y1'"
                }
              }
            },
            "alpha": {
              "expr": {
                "Literal": {
                  "Value": "0.8D"
                }
              }
            }
          }
        }
      ],
      "layer2": [
        {
          "properties": {
            "enabled": {
              "expr": {
                "Literal": {
                  "Value": "true"
                }
              }
            },
            "type": {
              "expr": {
                "Literal": {
                  "Value": "'line'"
                }
              }
            },
            "yField": {
              "expr": {
                "Literal": {
                  "Value": "'y2'"
                }
              }
            },
            "size": {
              "expr": {
                "Literal": {
                  "Value": "2D"
                }
              }
            },
            "lineStyle": {
              "expr": {
                "Literal": {
                  "Value": "'dashed'"
                }
              }
            }
          }
        }
      ]
    }
  }
}
```

### Example 3: Scatter with Color Grouping and Dark Theme

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.11.0/schema.json",
  "name": "scatter567890abcdefghij",
  "position": {
    "x": 40,
    "y": 40,
    "z": 0,
    "width": 700,
    "height": 500
  },
  "visual": {
    "visualType": "ggpbiGrammarOfGraphics",
    "query": {
      "queryState": {
        "x": {
          "projections": [
            {
              "field": {
                "Column": {
                  "Expression": {
                    "SourceRef": {
                      "Entity": "Cars"
                    }
                  },
                  "Property": "Weight"
                }
              },
              "queryRef": "Cars.Weight",
              "nativeQueryRef": "Weight",
              "active": true
            }
          ]
        },
        "y": {
          "projections": [
            {
              "field": {
                "Column": {
                  "Expression": {
                    "SourceRef": {
                      "Entity": "Cars"
                    }
                  },
                  "Property": "MPG"
                }
              },
              "queryRef": "Cars.MPG",
              "nativeQueryRef": "MPG",
              "active": true
            }
          ]
        },
        "color": {
          "projections": [
            {
              "field": {
                "Column": {
                  "Expression": {
                    "SourceRef": {
                      "Entity": "Cars"
                    }
                  },
                  "Property": "Origin"
                }
              },
              "queryRef": "Cars.Origin",
              "nativeQueryRef": "Origin",
              "active": true
            }
          ]
        }
      }
    },
    "objects": {
      "layer1": [
        {
          "properties": {
            "type": {
              "expr": {
                "Literal": {
                  "Value": "'point'"
                }
              }
            },
            "size": {
              "expr": {
                "Literal": {
                  "Value": "5D"
                }
              }
            },
            "shape": {
              "expr": {
                "Literal": {
                  "Value": "'diamondFilled'"
                }
              }
            },
            "pointFill": {
              "solid": {
                "color": "#FFD700"
              }
            },
            "strokeWidth": {
              "expr": {
                "Literal": {
                  "Value": "1.5D"
                }
              }
            }
          }
        }
      ],
      "theme": [
        {
          "properties": {
            "panelFill": {
              "solid": {
                "color": "#2D2D2D"
              }
            },
            "gridlineColor": {
              "solid": {
                "color": "#444444"
              }
            },
            "ink": {
              "solid": {
                "color": "#E0E0E0"
              }
            },
            "paper": {
              "solid": {
                "color": "#1A1A1A"
              }
            },
            "baseSize": {
              "expr": {
                "Literal": {
                  "Value": "12D"
                }
              }
            }
          }
        }
      ],
      "legend": [
        {
          "properties": {
            "show": {
              "expr": {
                "Literal": {
                  "Value": "true"
                }
              }
            },
            "position": {
              "expr": {
                "Literal": {
                  "Value": "'bottom'"
                }
              }
            }
          }
        }
      ]
    }
  }
}
```

### Example 4: Boxplot with Notch, Faceted

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.11.0/schema.json",
  "name": "boxplot890abcdefghijk",
  "position": {
    "x": 40,
    "y": 40,
    "z": 0,
    "width": 900,
    "height": 400
  },
  "visual": {
    "visualType": "ggpbiGrammarOfGraphics",
    "query": {
      "queryState": {
        "x": {
          "projections": [
            {
              "field": {
                "Column": {
                  "Expression": {
                    "SourceRef": {
                      "Entity": "Iris"
                    }
                  },
                  "Property": "Species"
                }
              },
              "queryRef": "Iris.Species",
              "nativeQueryRef": "Species",
              "active": true
            }
          ]
        },
        "y": {
          "projections": [
            {
              "field": {
                "Column": {
                  "Expression": {
                    "SourceRef": {
                      "Entity": "Iris"
                    }
                  },
                  "Property": "SepalLength"
                }
              },
              "queryRef": "Iris.SepalLength",
              "nativeQueryRef": "SepalLength",
              "active": true
            }
          ]
        },
        "facet": {
          "projections": [
            {
              "field": {
                "Column": {
                  "Expression": {
                    "SourceRef": {
                      "Entity": "Iris"
                    }
                  },
                  "Property": "PetalClass"
                }
              },
              "queryRef": "Iris.PetalClass",
              "nativeQueryRef": "PetalClass",
              "active": true
            }
          ]
        }
      }
    },
    "objects": {
      "layer1": [
        {
          "properties": {
            "type": {
              "expr": {
                "Literal": {
                  "Value": "'boxplot'"
                }
              }
            }
          }
        }
      ],
      "boxplot": [
        {
          "properties": {
            "notch": {
              "expr": {
                "Literal": {
                  "Value": "true"
                }
              }
            },
            "stapleWidth": {
              "expr": {
                "Literal": {
                  "Value": "0.5D"
                }
              }
            },
            "coef": {
              "expr": {
                "Literal": {
                  "Value": "1.5D"
                }
              }
            },
            "outlierShape": {
              "expr": {
                "Literal": {
                  "Value": "'diamond'"
                }
              }
            }
          }
        }
      ]
    }
  }
}
```

### Example 5: Three-Layer Combo with Custom Colors

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.11.0/schema.json",
  "name": "threelayer0123456789ab",
  "position": {
    "x": 40,
    "y": 40,
    "z": 0,
    "width": 800,
    "height": 500
  },
  "visual": {
    "visualType": "ggpbiGrammarOfGraphics",
    "query": {
      "queryState": {
        "x": {
          "projections": [
            {
              "field": {
                "Column": {
                  "Expression": {
                    "SourceRef": {
                      "Entity": "DimDate"
                    }
                  },
                  "Property": "Quarter"
                }
              },
              "queryRef": "DimDate.Quarter",
              "nativeQueryRef": "Quarter",
              "active": true
            }
          ]
        },
        "y": {
          "projections": [
            {
              "field": {
                "Column": {
                  "Expression": {
                    "SourceRef": {
                      "Entity": "Fact"
                    }
                  },
                  "Property": "Revenue"
                }
              },
              "queryRef": "Fact.Revenue",
              "nativeQueryRef": "Revenue",
              "active": true
            },
            {
              "field": {
                "Column": {
                  "Expression": {
                    "SourceRef": {
                      "Entity": "Fact"
                    }
                  },
                  "Property": "Costs"
                }
              },
              "queryRef": "Fact.Costs",
              "nativeQueryRef": "Costs",
              "active": true
            },
            {
              "field": {
                "Column": {
                  "Expression": {
                    "SourceRef": {
                      "Entity": "Fact"
                    }
                  },
                  "Property": "Margin"
                }
              },
              "queryRef": "Fact.Margin",
              "nativeQueryRef": "Margin",
              "active": true
            }
          ]
        }
      }
    },
    "objects": {
      "layer1": [
        {
          "properties": {
            "enabled": {
              "expr": {
                "Literal": {
                  "Value": "true"
                }
              }
            },
            "type": {
              "expr": {
                "Literal": {
                  "Value": "'bar'"
                }
              }
            },
            "yField": {
              "expr": {
                "Literal": {
                  "Value": "'y1'"
                }
              }
            },
            "alpha": {
              "expr": {
                "Literal": {
                  "Value": "0.6D"
                }
              }
            }
          }
        }
      ],
      "layer2": [
        {
          "properties": {
            "enabled": {
              "expr": {
                "Literal": {
                  "Value": "true"
                }
              }
            },
            "type": {
              "expr": {
                "Literal": {
                  "Value": "'line'"
                }
              }
            },
            "yField": {
              "expr": {
                "Literal": {
                  "Value": "'y2'"
                }
              }
            },
            "size": {
              "expr": {
                "Literal": {
                  "Value": "2D"
                }
              }
            },
            "fill": {
              "solid": {
                "color": "#E66C37"
              }
            }
          }
        }
      ],
      "layer3": [
        {
          "properties": {
            "enabled": {
              "expr": {
                "Literal": {
                  "Value": "true"
                }
              }
            },
            "type": {
              "expr": {
                "Literal": {
                  "Value": "'point'"
                }
              }
            },
            "yField": {
              "expr": {
                "Literal": {
                  "Value": "'y3'"
                }
              }
            },
            "size": {
              "expr": {
                "Literal": {
                  "Value": "6D"
                }
              }
            },
            "fill": {
              "solid": {
                "color": "#2E7D32"
              }
            }
          }
        }
      ],
      "scaleX": [
        {
          "properties": {
            "label": {
              "expr": {
                "Literal": {
                  "Value": "'Quarter'"
                }
              }
            }
          }
        }
      ],
      "scaleY": [
        {
          "properties": {
            "label": {
              "expr": {
                "Literal": {
                  "Value": "'EUR'"
                }
              }
            }
          }
        }
      ]
    }
  }
}
```

### Example 6: Horizontal Grouped Bars with Jitter Overlay

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.11.0/schema.json",
  "name": "jitter0123456789abcdef",
  "position": {
    "x": 40,
    "y": 40,
    "z": 0,
    "width": 600,
    "height": 500
  },
  "visual": {
    "visualType": "ggpbiGrammarOfGraphics",
    "query": {
      "queryState": {
        "x": {
          "projections": [
            {
              "field": {
                "Column": {
                  "Expression": {
                    "SourceRef": {
                      "Entity": "Survey"
                    }
                  },
                  "Property": "Department"
                }
              },
              "queryRef": "Survey.Department",
              "nativeQueryRef": "Department",
              "active": true
            }
          ]
        },
        "y": {
          "projections": [
            {
              "field": {
                "Column": {
                  "Expression": {
                    "SourceRef": {
                      "Entity": "Survey"
                    }
                  },
                  "Property": "Score"
                }
              },
              "queryRef": "Survey.Score",
              "nativeQueryRef": "Score",
              "active": true
            }
          ]
        },
        "color": {
          "projections": [
            {
              "field": {
                "Column": {
                  "Expression": {
                    "SourceRef": {
                      "Entity": "Survey"
                    }
                  },
                  "Property": "Gender"
                }
              },
              "queryRef": "Survey.Gender",
              "nativeQueryRef": "Gender",
              "active": true
            }
          ]
        }
      }
    },
    "objects": {
      "layer1": [
        {
          "properties": {
            "enabled": {
              "expr": {
                "Literal": {
                  "Value": "true"
                }
              }
            },
            "type": {
              "expr": {
                "Literal": {
                  "Value": "'bar'"
                }
              }
            },
            "position": {
              "expr": {
                "Literal": {
                  "Value": "'dodge'"
                }
              }
            },
            "orientation": {
              "expr": {
                "Literal": {
                  "Value": "'y'"
                }
              }
            },
            "alpha": {
              "expr": {
                "Literal": {
                  "Value": "0.4D"
                }
              }
            }
          }
        }
      ],
      "layer2": [
        {
          "properties": {
            "enabled": {
              "expr": {
                "Literal": {
                  "Value": "true"
                }
              }
            },
            "type": {
              "expr": {
                "Literal": {
                  "Value": "'point'"
                }
              }
            },
            "position": {
              "expr": {
                "Literal": {
                  "Value": "'jitter'"
                }
              }
            },
            "jitterWidth": {
              "expr": {
                "Literal": {
                  "Value": "0.2D"
                }
              }
            },
            "jitterHeight": {
              "expr": {
                "Literal": {
                  "Value": "0.1D"
                }
              }
            },
            "size": {
              "expr": {
                "Literal": {
                  "Value": "3D"
                }
              }
            }
          }
        }
      ]
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
| `layer1.type` | `geom_*()` | `bar` = `geom_col` (with y) / `geom_bar` (without), `point` = `geom_point`, etc. |
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
