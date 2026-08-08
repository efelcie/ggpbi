# ggpbi Guide

> Grammar of Graphics for Power BI — ggplot2 logic in TypeScript/D3.

Coming from ggplot2? The **[Sample Gallery](gallery.md)** shows classic
ggplot2 examples side by side with their ggpbi equivalents — every image is
generated from the code next to it.

---

## Quick Start

### Installation

```bash
git clone <repo-url>
cd ggpbi
npm install
```

### Start the Demo

```bash
npm run demo:build
npx serve demo -p 3333
# → http://localhost:3333
```

The demo shows an interactive playground with all features:
choose a dataset, add geoms, adjust scales/styles —
everything live. Bottom-right you'll see the generated code as
TypeScript API **and** as ggplot2 R code.

### First Chart in Your Own Code

```html
<div id="chart"></div>
<script type="module">
import { ggpbi } from './ggpbi.esm.js';

ggpbi()
  .data([
    { month: 'Jan', revenue: 120 },
    { month: 'Feb', revenue: 180 },
    { month: 'Mar', revenue: 150 },
  ])
  .aes({ x: 'month', y: 'revenue' })
  .geom('bar')
  .renderTo(document.getElementById('chart'));
</script>
```

That's it. No config, no setup — data in, chart out.

---

## API Reference

### `ggpbi()` — Builder

The fluent API builds a chart step by step:

```typescript
ggpbi()
  .data(data)             // array of objects
  .aes({ ... })           // columns → visual properties
  .geom('point')          // add a geometry layer
  .geom('line')           // as many layers as you want
  .scale({ x: 'log' })   // scale overrides
  .labels('X', 'Y')       // axis titles
  .legend(true)            // legend on/off
  .size(800, 400)          // width × height in pixels
  .theme({ ... })          // styling
  .renderTo(container)     // render to DOM → returns SVGSVGElement
```

Every method returns `this` — everything is chainable.

### `.data(data)`

An array of objects. Each object = one row.

```typescript
.data([
  { date: '2024-01', revenue: 100, region: 'North' },
  { date: '2024-02', revenue: 200, region: 'South' },
])
```

### `.aes({ x, y, color?, size?, alpha?, label? })`

Maps columns to visual properties:

| Aesthetic | Description | Required? |
|-----------|------------|-----------|
| `x` | X axis | Yes |
| `y` | Y axis | Yes |
| `color` | Color (groups automatically) | No |
| `size` | Point size (area-proportional, radius 2–12px, like ggplot2 `scale_size()`) | No |
| `alpha` | Transparency (0–1) | No |
| `label` | Text label (for `geom('text')`) | No |

```typescript
.aes({ x: 'date', y: 'revenue', color: 'region' })
```

**Error messages:** If `x` or `y` is missing or the field name doesn't exist in the data, you get a clear message:

```
ggpbi: Field "Revenue" not found in data. Available: revenue, date, region
```

### `.geom(type, options?)`

Adds a geometry layer. Multiple geoms = multiple layers stacked on top of each other.

```typescript
.geom('point')                          // points
.geom('line', { color: '#e74c3c' })     // red line
.geom('bar', { alpha: 0.7 })            // bars (auto-detects stat from y mapping)
.geom('bar')                            // bars (counts if no y, values if y mapped)
```

**Without `.geom()`** ggpbi automatically picks the best type — see [Auto-Geom](#auto-geom).

### `.scale({ x?, y? })`

Override the automatically detected scale:

```typescript
.scale({ x: 'time', y: 'log' })
```

### `.subtitle(text | 'auto' | 'always')`

A line above the panel saying what the plot shows — including
transformations the visual performed on its own, which the marks alone
never reveal:

```typescript
.subtitle('auto')     // → "Sum of len by dose, coloured by supp"
.subtitle('always')   // describes every plot, even a plain scatter
.subtitle('Q3 sales') // explicit text
```

| Mode | Behaviour |
|------|-----------|
| `'auto'` | Speaks up **only** when something is not visible from the marks: an auto-picked geom, [`stat_sum`](#bar--bar-chart), `stat_count`, binning, density |
| `'always'` | Describes every plot |
| any string | Used verbatim |
| omitted | No subtitle (default in the JS API) |

Generated sentences name the value, the grouping axis and the mapped
aesthetics: *"Count of rows by cyl"*, *"Histogram of psavert"*,
*"Boxplot of len by dose"*, *"mpg by wt · with trend line"*.

**Power BI:** Format Pane → *Theme* → **Describe the chart**
(Off / Auto / Always), defaulting to **Auto**. Field names come from the
wells, so the sentence uses the names you see there — not the internal
keys. This matters most for the automatic aggregation: a value column
dropped into Y without summarization renders as a sum, and the subtitle
says so.

### `.labels(xLabel?, yLabel?)`

Set axis titles:

```typescript
.labels('Month', 'Revenue (EUR)')
```

### `.legend(show)`

Toggle legend on/off (default: `true`):

```typescript
.legend(false)
```

### `.size(width, height)`

Chart dimensions in pixels:

```typescript
.size(1200, 600)
```

Default: 600 × 400.

### `.theme(config)`

Styling — details in the [Themes](#themes) section.

### `.tooltip(config)`

```typescript
.tooltip({ enabled: true, fields: ['revenue', 'region'] })
```

### `.selection(config)`

```typescript
.selection({ mode: 'multi', onSelectionChange: (sel) => console.log(sel) })
```

### `.facet(config)`

Small multiples — details in the [Faceting](#faceting) section.

### `.renderTo(container)` / `.render(container)`

Renders the chart into a DOM element. Returns the `SVGSVGElement`.

```typescript
const svg = ggpbi()
  .data(data)
  .aes({ x: 'x', y: 'y' })
  .geom('point')
  .renderTo(document.getElementById('chart'));
```

---

## Auto-Geom

When no `.geom()` is set, ggpbi automatically picks the best chart type —
based on the scale levels of the data fields. The behavior matches ggplot2's
`qplot()` logic.

### Selection Matrix

| X Field | Y Field | Auto-Geom | Rationale |
|---------|---------|-----------|-----------|
| — | Numeric | `boxplot` | Only y → distribution overview |
| — | Categorical | `bar` (horizontal) | Only y category → stat_count over y |
| Categorical | — | `bar` | Only x category → stat_count |
| Categorical | Numeric | `bar` | Category + value → stat_identity |
| Numeric | — | `histogram` | Only numeric → stat_bin (30 bins) |
| Numeric | Numeric | `point` | 2 numeric → scatter |
| Numeric | Categorical | `point` | Strip plot |
| Time | Numeric | `line` | Time + value → time series |
| Time | Categorical | `point` | Strip plot over time |

The `color` aesthetic doesn't change the type — a scatter stays a scatter,
but gets color-coded groups (a lone boxplot dodges into one box per group).

**Every combination renders.** Specs that map only `y` get a constant
pseudo x — a single unlabelled band — so a lone measure still shows a
boxplot and a lone dimension shows horizontal count bars instead of an
error. This is enforced by `tests/always-render.test.ts`, which renders
the full x × y × color matrix. The auto choice is only a default: an
explicit `.geom(...)` (or the Format Pane layer type) always wins.

### Examples

```typescript
// Auto → bar (categorical + numeric, stat_identity)
ggpbi()
  .data([{ month: 'Jan', revenue: 100 }, { month: 'Feb', revenue: 200 }])
  .aes({ x: 'month', y: 'revenue' })
  .renderTo(el);

// Auto → point (numeric + numeric)
ggpbi()
  .data([{ x: 1, y: 10 }, { x: 2, y: 20 }])
  .aes({ x: 'x', y: 'y' })
  .renderTo(el);

// Auto → line (time + numeric)
ggpbi()
  .data([{ t: new Date('2024-01'), v: 100 }, { t: new Date('2024-02'), v: 200 }])
  .aes({ x: 't', y: 'v' })
  .renderTo(el);

// Explicit .geom() overrides auto-selection
ggpbi()
  .data([{ month: 'Jan', revenue: 100 }])
  .aes({ x: 'month', y: 'revenue' })
  .geom('point')  // → points instead of bars
  .renderTo(el);
```

### Power BI

In the Format Pane, the layer type is set to **Auto** by default.
ggpbi detects the best chart type based on the assigned fields:

- Only category field → bar chart (stat_count)
- Category + values → bar chart (stat_identity)
- Only a measure in Y (no category field) → boxplot against a single "All" group
- Only a measure in X (no category field) → a single horizontal value bar against an "All" group
- Measure in X + category in Y, one row per category → horizontal value bars (geom_col)
- Measure in X + category in Y, multiple rows per category (Detail well) → strip plot
- X axis + values (scatter/strip mode) → scatter plot
- Time field + values → line chart

**Scatter mode:** As soon as a field is dragged to **X Axis**, the visual
automatically switches to scatter mode. X can be a measure or a category.
If the other axis is categorical, ggpbi renders a strip plot (for example
`X = OCR`, `Y = Branche`). Use the **Detail** bucket for the row/item identity
that defines one point (for example customer, document, company, or record ID).
Without Detail, Power BI aggregates the measure per category — one row per
group, which auto-renders as horizontal value bars; add a Detail field to get
the row-level strip. Add a **Label** field and enable a `text` layer to
annotate only the rows where that label is non-empty. An explicit `bar` layer
infers its orientation from the data like ggplot2's `geom_col`: value in X +
grouping in Y flips it horizontal automatically (set **Orientation** to
override).

The automatic selection can be overridden at any time via the type dropdown
in the Format Pane.

#### How much data the visual sees

Power BI reduces large results before a custom visual receives them. ggpbi
requests **30 000 rows, sampled across the result** rather than the first
30 000: source tables are usually sorted by date, region or amount, so the
first N rows would be a systematically biased slice — a trend the full data
does not have. A sample keeps the shape.

When the host does reduce the data, the visual **says so above the panel**:

> *showing a sample of 30,000 rows — the source has more*

That line appears regardless of the **Describe the chart** setting. A chart
drawn from part of the data must not be indistinguishable from one drawn
from all of it, and every in-visual statistic — boxplot quartiles, density,
histogram counts, trend fits — is computed over what arrived.

#### When Power BI has already collapsed your rows

Power BI hands the visual the **distinct combinations** of the bound
fields, not the underlying rows. Without a field that identifies a row,
every observation sharing the same values arrives as one — and a chart
that counts rows then counts distinct values instead.

The savings-rate histogram in the demo report hit this: with only
`psavert` bound, all months sharing a rate collapsed into one row, so
each bin counted distinct rates. One-decimal data has at most ten of
those per bin of width 1, which produced eight bars all ending at exactly
10 — a plausible-looking plateau instead of the real peak at 6–7 %.

| Bin | Rows in the data | What was drawn |
|-----|------------------|----------------|
| 5–6 | 49 | 9 |
| 6–7 | **81** | 10 |
| 7–8 | 59 | 10 |

**The fix is one field:** drag something unique per row — an ID, a date,
a document number — into the **Detail** well. It changes nothing visually
and keeps every row separate.

**The visual now says so.** When a row-counting chart (histogram, count
bars, boxplot, violin, density) runs on data where no bound field is
unique, a notice appears above the panel:

> *rows may be aggregated — add a unique field to Detail to count rows*

It says *may* on purpose: the collapsed rows never reach the visual, so
what is detectable is the condition that permits the collapse, not the
collapse itself. Working deliberately on aggregated data is legitimate —
switch the notice off under **Theme → Warn about aggregated rows**.

Scatter plots, lines and trend fits are exempt: they draw one mark per
returned row, so what the reader sees is exactly what arrived.

#### Working precisely on large tables

Two ways:

- **Aggregate in the model.** A DAX measure returns one row per category,
  so the cap never binds. This is the recommended route for anything the
  model can compute — see the *Model or visual?* rule of thumb in the
  [`pointrange`](#pointrange--point-with-range-geom_pointrange) section.
- **Pre-compute the statistic.** A boxplot from `PERCENTILE.INC` measures
  or a point range from `AVERAGE` ± `STDEV.S` uses the whole table, because
  the aggregation happens in the engine — the visual only draws the result.

### `inferScaleLevel(data, field)`

Helper function for detecting the scale level of a field:

```typescript
import { inferScaleLevel } from 'ggpbi';

inferScaleLevel([{ x: 42 }], 'x');           // → 'numeric'
inferScaleLevel([{ x: new Date() }], 'x');    // → 'time'
inferScaleLevel([{ x: 'foo' }], 'x');         // → 'categorical'
```

---

## Geoms

### `point` — Scatter Plot

```typescript
ggpbi()
  .data(iris)
  .aes({ x: 'sepalLength', y: 'petalLength', color: 'species' })
  .geom('point', { size: 5, alpha: 0.7, shape: 'diamond' })
  .renderTo(el);
```

All parameters match ggplot2 `geom_point()`:

| Option | ggplot2 Equivalent | Default | Description |
|--------|-------------------|---------|-------------|
| `color` | `colour` | `#4682B4` | Point color (filled: fill, open/line: stroke) |
| `fill` | `fill` | `#FFFFFF` | Fill color only for shapes 21–25 (circleFilled etc.) |
| `size` | `size` | 4 | Point radius in px |
| `shape` | `shape` | `'circle'` | Point shape — see shape reference below |
| `alpha` | `alpha` | 0.8 | Transparency (0–1) |
| `strokeWidth` | `stroke` | 0.5 | Stroke width for shapes 21–25 |
| `position` | `position` | `'identity'` | `'identity'` or `'jitter'` |
| `jitterWidth` | `width` (jitter) | 0.4 | Jitter width (fraction of bandwidth) |
| `jitterHeight` | `height` (jitter) | 0 | Jitter height (fraction of bandwidth when Y is categorical) |
| `naRm` | `na.rm` | `false` | Silently remove NA values |

**Shape Reference (16 ggplot2 Shapes):**

| Shape | ggplot2 pch | Category | Behavior |
|-------|-------------|----------|----------|
| `'circle'` | 19 | Filled | `colour` = fill |
| `'square'` | 15 | Filled | `colour` = fill |
| `'triangle'` | 17 | Filled | `colour` = fill |
| `'diamond'` | 18 | Filled | `colour` = fill |
| `'circleOpen'` | 1 | Open | `colour` = stroke, interior transparent |
| `'squareOpen'` | 0 | Open | `colour` = stroke, interior transparent |
| `'triangleOpen'` | 2 | Open | `colour` = stroke, interior transparent |
| `'diamondOpen'` | 5 | Open | `colour` = stroke, interior transparent |
| `'circleFilled'` | 21 | Fill+Border | `fill` = interior, `colour` = stroke |
| `'squareFilled'` | 22 | Fill+Border | `fill` = interior, `colour` = stroke |
| `'triangleFilled'` | 24 | Fill+Border | `fill` = interior, `colour` = stroke |
| `'diamondFilled'` | 23 | Fill+Border | `fill` = interior, `colour` = stroke |
| `'plus'` | 3 | Line | `colour` = stroke color |
| `'cross'` | 4 | Line | `colour` = stroke color |
| `'asterisk'` | 8 | Line | `colour` = stroke color |
| `'star'` | 11 | Line | `colour` = stroke color |

**Examples:**

```typescript
// Scatter plot with open circles
.geom('point', { shape: 'circleOpen', size: 6 })

// Two-tone points (stroke + fill, like ggplot2 shape 21)
.geom('point', { shape: 'circleFilled', color: '#333', fill: '#FFD700', strokeWidth: 1.5 })

// Jitter for categorical x axis (like geom_jitter())
.geom('point', { position: 'jitter', jitterWidth: 0.3 })

// Horizontal strip plot (numeric X, categorical Y)
ggpbi()
  .data(records)
  .aes({ x: 'ocr', y: 'branche', group: 'documentId' })
  .geom('point', { position: 'jitter', jitterWidth: 0, jitterHeight: 0.35 })
  .renderTo(el);

// Plus symbols
.geom('point', { shape: 'plus', color: 'red', size: 5 })

// Silently remove NA values
.geom('point', { naRm: true })
```

#### Power BI Strip Plot

For one point per entity with a measure on the X axis:

| Bucket | Field |
|--------|-------|
| X | OCR measure |
| Y | Branche |
| Detail | Row identity, e.g. document/customer/company ID |
| Label | Optional label text for selected points |

Recommended layer settings:

| Setting | Value |
|---------|-------|
| Layer 1 -> Type | Point |
| Layer 1 -> Position | Jitter |
| Layer 1 -> Jitter width | 0 |
| Layer 1 -> Jitter height | 0.3-0.5 |
| Layer 2 -> Type | Line |
| Layer 2 -> Size | 1-2 |
| Layer 3 -> Type | Text |

For horizontal strip plots, line layers are drawn at the center of each
categorical Y band, so Layer 2 sits on the same baseline as the unjittered
points. Text layers use the same X/Y position and skip blank Label values.

### `line` — Line Chart

```typescript
ggpbi()
  .data(timeseries)
  .aes({ x: 'month', y: 'revenue', color: 'product' })
  .geom('line', { size: 2, linetype: 'dashed' })
  .renderTo(el);
```

When `aes.color` is set, **one line per group** is drawn.
Points are automatically sorted by X (geom_line behavior, not geom_path).

All parameters match ggplot2 `geom_line()`:

| Option | ggplot2 Equivalent | Default | Description |
|--------|-------------------|---------|-------------|
| `color` | `colour` | `#4682B4` | Line color |
| `size` | `linewidth` | 2 | Stroke width in px |
| `linetype` | `linetype` | `'solid'` | Line style — see reference below |
| `alpha` | `alpha` | 1 | Transparency (0–1) |
| `lineend` | `lineend` | `'butt'` | Line cap: `'butt'`, `'round'`, `'square'` |
| `linejoin` | `linejoin` | `'round'` | Line join: `'round'`, `'miter'`, `'bevel'` |
| `linemitre` | `linemitre` | 10 | Mitre limit (only for `linejoin='miter'`) |
| `naRm` | `na.rm` | `false` | Silently remove NA values (no gaps) |
| `arrowShow` | `arrow` | `false` | Show arrowhead |
| `arrowAngle` | `arrow(angle=)` | 30 | Arrowhead angle (5–90°) |
| `arrowLength` | `arrow(length=)` | 8 | Arrowhead length in px |
| `arrowEnds` | `arrow(ends=)` | `'last'` | `'first'`, `'last'`, `'both'` |
| `arrowType` | `arrow(type=)` | `'open'` | `'open'` or `'closed'` |
| `arrowFill` | Arrow fill | — | Fill color for closed arrows (default: line color) |

**Linetype Reference (all 6 ggplot2 linetypes):**

| Linetype | ggplot2 Nr | SVG stroke-dasharray | Description |
|----------|-----------|---------------------|-------------|
| `'solid'` | 1 | — | Solid |
| `'dashed'` | 2 | `6 4` | Dashed |
| `'dotted'` | 3 | `2 3` | Dotted |
| `'dashdot'` | 4 | `6 3 2 3` | Dash-dot |
| `'longdash'` | 5 | `10 4` | Long dashed |
| `'twodash'` | 6 | `2 2 8 2` | Two-dash |

**NA Handling:**
- NAs **in the middle** → line is interrupted (gap)
- NAs **at the edges** → segment is clipped
- `naRm: true` → NAs are silently removed, line stays continuous

**Examples:**

```typescript
// Dashed line with round caps
.geom('line', { linetype: 'dashed', lineend: 'round', size: 3 })

// Arrow at the end
.geom('line', { arrowShow: true, arrowType: 'closed', arrowLength: 12 })

// Arrow at both ends
.geom('line', { arrowShow: true, arrowEnds: 'both' })

// Long dashed with miter joins
.geom('line', { linetype: 'longdash', linejoin: 'miter' })

// Silently remove NA values (continuous line)
.geom('line', { naRm: true })
```

### `bar` — Bar Chart

```typescript
ggpbi()
  .data(categories)
  .aes({ x: 'category', y: 'value', color: 'group' })
  .geom('bar', { position: 'dodge' })
  .renderTo(el);
```

Bars always start at y=0 (ggplot2 behavior).
Width comes from `d3.scaleBand()` — bars automatically fill the band width
with ggplot2-conformant padding (outer and inner spacing).

**stat_count:** Without y aesthetic, `geom('bar')` automatically counts observations per category
(like ggplot2 `geom_bar(stat = "count")`). With `aes.weight`, weights are summed instead of counted.

```typescript
// Automatic counting (no y needed)
ggpbi()
  .data([{ animal: 'Cat' }, { animal: 'Dog' }, { animal: 'Cat' }])
  .aes({ x: 'animal' })
  .geom('bar')
  .renderTo(el);
// → Cat: 2, Dog: 1

// Weighted sums
ggpbi()
  .data([{ animal: 'Cat', w: 10 }, { animal: 'Dog', w: 20 }, { animal: 'Cat', w: 15 }])
  .aes({ x: 'animal', weight: 'w' })
  .geom('bar')
  .renderTo(el);
// → Cat: 25, Dog: 20
```

**stat_sum — row-level data:** With a y aesthetic and **several rows per
category** (× colour × facet), bars sum those rows into one rectangle per
group, like `stat_summary(fun = sum)`:

```typescript
// Six rows per dose, two supp groups → 3 × 2 = 6 rectangles
.aes({ x: 'dose', y: 'len', color: 'supp' })
.geom('bar', { position: 'stack' })
```

ggplot2's `geom_col()` instead draws one rectangle **per observation** and
lets `position_stack` pile them up. The bar reaches the same total, but the
segment seams are visible, and under `position = 'dodge'` the rectangles
land on top of each other and show the largest single row instead of the
sum. Power BI routinely delivers exactly this shape — a column set to
*Don't summarize*, or one row per Detail item — so summing is the
sensible default. Pass `stat: 'identity'` for the ggplot2 stacking
behaviour:

```typescript
.geom('bar', { stat: 'identity' })   // one rect per row, ggplot2-style
```

With one row per group nothing changes: `identity` and `sum` are identical.

**What does a raw value column show?** Dragging a numeric column into Y
without summarization (Power BI: *Don't summarize*) makes the bar show the
**sum of that column per category** — the same number the field would
produce with its aggregation pill set to *Sum*. Bars have no other
sensible reading: a category maps to one bar, so several rows have to be
combined. Use the pill (Sum / Average / Min / Max) or a measure when you
want a different aggregate; the visual never second-guesses an explicit
one.

**Stacking order** follows ggplot2's `position_stack()`: all rows of one
colour group form a contiguous block, regardless of the order the rows
arrive in. (Stacking in raw data order would interleave the groups and
turn a two-colour bar into stripes.)

All parameters match ggplot2 `geom_bar()` / `geom_col()`:

| Option | ggplot2 Equivalent | Default | Description |
|--------|-------------------|---------|-------------|
| `alpha` | `alpha` | 0.85 | Transparency (0–1) |
| `color` | `fill` | `#4682B4` | Fill color (static, overrides `aes.color`) |
| `position` | `position` | `'stack'` | `'stack'`, `'dodge'`, `'dodge2'`, `'fill'`, `'identity'` |
| `width` | `width` | 0.9 | Bar width as fraction of bandwidth |
| `just` | `just` | 0.5 | Alignment: 0=left, 0.5=center, 1=right |
| `orientation` | `orientation` | `'x'` | `'x'` (vertical) or `'y'` (horizontal) |
| `stat` | `stat` | `'identity'` | `'identity'` (y from data) or `'count'` (counting) |
| `stroke` | `colour` | — | Border color (ggplot2: `NA` = no border) |
| `strokeWidth` | `linewidth` | 0 | Border width in px |
| `linetype` | `linetype` | `'solid'` | Border style — all 6 ggplot2 linetypes |
| `lineend` | `lineend` | `'butt'` | Border cap: `'butt'`, `'round'`, `'square'` |
| `linejoin` | `linejoin` | `'miter'` | Border join: `'miter'`, `'round'`, `'bevel'` |
| `naRm` | `na.rm` | `false` | Silently remove NA values |

**Position Types:**

- **`stack`** — Bars stacked per category (default, totals visible)
- **`dodge`** — Bars side by side per category (grouped bar chart)
- **`dodge2`** — Side by side with padding between sub-bars
- **`fill`** — Stacked + normalized to 100% (compare proportions, like `position_fill()`)
- **`identity`** — Bars overlap (rarely useful)

**Examples:**

```typescript
// Stacked (default)
.geom('bar')
.geom('bar', { position: 'stack' })

// Side by side
.geom('bar', { position: 'dodge' })

// Side by side with padding
.geom('bar', { position: 'dodge2' })

// 100% stacked (proportions)
.geom('bar', { position: 'fill' })

// With border (ggplot2: colour + linewidth)
.geom('bar', { stroke: 'black', strokeWidth: 1 })

// Dashed border with round corners
.geom('bar', { stroke: '#333', strokeWidth: 0.5, linetype: 'dashed', linejoin: 'round' })

// Narrower bars
.geom('bar', { width: 0.6 })

// Left-aligned bars
.geom('bar', { width: 0.5, just: 0 })

// Horizontal bars (orientation: 'y')
ggpbi()
  .data(data)
  .aes({ x: 'value', y: 'category' })
  .geom('bar', { orientation: 'y' })
  .renderTo(el);

// Silently remove NA values
.geom('bar', { naRm: true })

// Explicit stat_count (even when y is present)
.geom('bar', { stat: 'count' })
```

### `col` — Alias for `bar` (stat_identity)

`geom('col')` is an alias for `geom('bar')` that forces `stat = "identity"`.
In practice you rarely need it: `geom('bar')` auto-detects the stat — when `y`
is mapped it uses `stat_identity`, when `y` is absent it uses `stat_count`.

In ggplot2, `GeomCol` is an empty subclass of `GeomBar` with `stat = stat_identity()`.
Same here: all styling/position options are identical.

In the Power BI Format Pane there is only one **"Bar"** entry. The visual
automatically uses stat_identity when a Y measure is present, and stat_count
when only an X category is assigned.

```typescript
// These are equivalent when y is mapped:
.geom('bar')    // auto-detects stat_identity
.geom('col')    // explicitly stat_identity
```

| Option | ggplot2 equivalent | Default | Description |
|--------|---------------------|---------|-------------|
| `alpha` | `alpha` | 0.85 | Transparency (0–1) |
| `color` | `fill` | `#4682B4` | Fill color (static, overrides `aes.color`) |
| `position` | `position` | `'stack'` | `'stack'`, `'dodge'`, `'dodge2'`, `'fill'`, `'identity'` |
| `width` | `width` | 0.9 | Bar width as share of band width |
| `just` | `just` | 0.5 | Alignment: 0=left, 0.5=center, 1=right |
| `orientation` | `orientation` | `'x'` | `'x'` (vertical) or `'y'` (horizontal) |
| `stroke` | `colour` | — | Border color (ggplot2: `NA` = no border) |
| `strokeWidth` | `linewidth` | 0 | Border width in px |
| `linetype` | `linetype` | `'solid'` | Border style — all 6 ggplot2 linetypes |
| `lineend` | `lineend` | `'butt'` | Border ends: `'butt'`, `'round'`, `'square'` |
| `linejoin` | `linejoin` | `'miter'` | Border corners: `'miter'`, `'round'`, `'bevel'` |
| `naRm` | `na.rm` | `false` | Silently remove NA values |

**Examples:**

```typescript
// Simple bars with explicit values
ggpbi()
  .data([
    { month: 'Jan', revenue: 120 },
    { month: 'Feb', revenue: 180 },
    { month: 'Mar', revenue: 150 },
  ])
  .aes({ x: 'month', y: 'revenue' })
  .geom('col')
  .renderTo(el);

// Grouped (dodge)
.geom('col', { position: 'dodge' })

// 100% stacked (shares)
.geom('col', { position: 'fill' })

// With border
.geom('col', { stroke: 'black', strokeWidth: 1 })

// Negative values (bars go below zero)
ggpbi()
  .data([
    { q: 'Q1', profit: 50 },
    { q: 'Q2', profit: -30 },
  ])
  .aes({ x: 'q', y: 'profit' })
  .geom('col')
  .renderTo(el);

// Horizontal bars
ggpbi()
  .data(data)
  .aes({ x: 'value', y: 'category' })
  .geom('col', { orientation: 'y' })
  .renderTo(el);
```

### `area` — Area Chart

```typescript
ggpbi()
  .data(timeseries)
  .aes({ x: 'month', y: 'revenue' })
  .geom('area', { alpha: 0.3 })
  .renderTo(el);
```

| Option | Default | Description |
|--------|---------|-------------|
| `alpha` | 0.3 | Transparency |
| `color` | `#4682B4` | Fill and line color |
| `naRm` | `false` | Silently remove NA values |

Rows with missing x/y are removed (with a console warning unless `naRm: true`) —
a single missing value never blanks the whole area.

### `text` — Text Labels

```typescript
ggpbi()
  .data(data)
  .aes({ x: 'x', y: 'y', label: 'name' })
  .geom('text', { size: 12 })
  .renderTo(el);
```

If no `aes.label` is set, the y value is displayed as text.
When `aes.label` is set, blank or null labels are skipped. This makes selective
annotation easy: fill the label field only for the points that should be named.

| Option | ggplot2 | Default | Description |
|--------|---------|---------|-------------|
| `size` | `size` | 12 | Font size in px |
| `color` | `colour` | `#333333` | Text color |
| `textAnchor` | `hjust` | `'middle'` | `'start'`, `'middle'`, `'end'` |
| `hjust` | `hjust = "inward"` | — | `'inward'`: edge labels align toward the panel centre — text never protrudes past the sides (overrides `textAnchor`) |
| `vjust` | `vjust = "inward"` | — | `'inward'`: upper-half labels go below their point, lower-half above (overrides `dy`) |
| `checkOverlap` | `check_overlap` | `false` | Hide labels that would overlap an earlier label; first in data order wins |
| `repel` | ggrepel `geom_text_repel` | `false` | Labels find their own non-overlapping spots (greedy ring search around each point); displaced labels get a thin connector line. Supersedes `hjust`/`vjust`/`checkOverlap`. **When space runs out, labels that find no free spot are hidden** (like ggrepel's `max.overlaps` — a console warning reports the count); above 250 labels the search degrades to first-wins hiding. Power BI: **Repel labels** toggle in the layer's Position & Layout group |
| `labelTemplate` | `aes(label = paste(...))` | — | Template for the label text, e.g. `'{label} {x:.1%}'` → `"SPAR 8.5%"`. Placeholders `{label}`, `{x}`, `{y}` take the row's bound values; an optional [d3-format](https://d3js.org/d3-format) spec after the colon formats numbers. Power BI: **Label template** input in the layer's Position & Layout group |
| `angle` | `angle` | 0 | Rotation in degrees |
| `fontFamily` | `family` | `'sans-serif'` | Font family |
| `naRm` | `na.rm` | `false` | Silently remove NA values |

**Repel across layers:** all repel text layers of a panel coordinate — labels
avoid the label boxes of earlier text layers and the marks of point layers, so
two text layers (e.g. min and max labels of a dumbbell) never collide.

```typescript
// Clean labelling: no overlaps, nothing outside the panel
.geom('text', { hjust: 'inward', vjust: 'inward', checkOverlap: true })

// Labels place themselves, like R's ggrepel (connector lines included)
.geom('text', { repel: true })
```

### `boxplot` — Boxplot (Tukey)

```typescript
ggpbi()
  .data(measurements)
  .aes({ x: 'group', y: 'value', color: 'treatment' })
  .geom('boxplot', { boxNotch: true, boxStapleWidth: 0.5 })
  .renderTo(el);
```

Full ggplot2-compatible boxplot with all stat_boxplot parameters. Defaults match ggplot2 exactly.

**All parameters match ggplot2 `geom_boxplot()` / `stat_boxplot()`:**

| Option | ggplot2 Equivalent | Default | Description |
|--------|-------------------|---------|-------------|
| `color` | `fill` | `'#FFFFFF'` | Box fill color (ggplot2 default: white) |
| `alpha` | `alpha` | 1.0 | Transparency (0–1) |
| `width` | `width` | 0.9 | Box width as fraction of bandwidth |
| `stroke` | `colour` | `'#333333'` | Base border/line color |
| `strokeWidth` | `linewidth` | 0.5 | Base line width |
| `boxCoef` | `coef` | 1.5 | Whisker length as IQR multiplier. `Infinity` = full range. |
| `boxNotch` | `notch` | `false` | Show notched box (confidence interval around median) |
| `boxNotchWidth` | `notchwidth` | 0.5 | Notch width relative to box width |
| `boxVarWidth` | `varwidth` | `false` | Box width proportional to √n |
| `boxStapleWidth` | `staplewidth` | 0 | Whisker cap width (0 = no caps, like ggplot2 default) |
| `boxFatten` | `fatten` | 2 | Median line thickness multiplier |
| `boxOutlierShow` | `outliers` | `true` | Show outlier points |
| `boxOutlierShape` | `outlier.shape` | `'circle'` | Outlier point shape |
| `boxOutlierSize` | `outlier.size` | 1.5 | Outlier point size |
| `boxOutlierStroke` | `outlier.stroke` | 0.5 | Outlier border width |
| `boxOutlierColor` | `outlier.colour` | inherits | Outlier border color |
| `boxOutlierFill` | `outlier.fill` | inherits | Outlier fill color |
| `boxOutlierAlpha` | `outlier.alpha` | inherits | Outlier transparency |

**Per-component styling** (each falls back to base `stroke`/`strokeWidth`/`linetype`):

| Component | Color | Line Style | Line Width |
|-----------|-------|------------|------------|
| Box border | `boxBorderColor` | `boxBorderLineStyle` | `boxBorderLineWidth` |
| Whisker | `boxWhiskerColor` | `boxWhiskerLineStyle` | `boxWhiskerLineWidth` |
| Staple (cap) | `boxStapleColor` | `boxStapleLineStyle` | `boxStapleLineWidth` |
| Median line | `boxMedianColor` | `boxMedianLineStyle` | `boxMedianLineWidth` |

**stat_boxplot algorithm:**
- Q1, Q2 (median), Q3 via type-7 quantiles (same as R default)
- IQR = Q3 − Q1
- Whisker bounds: Q1 − coef×IQR / Q3 + coef×IQR
- Whisker endpoints: most extreme data point still inside fence
- Outliers: values outside whisker range
- Notch: median ± 1.58 × IQR / √n

**Rendering order** (matches ggplot2, bottom → top):
1. Outlier points
2. Staple lines (only if stapleWidth > 0)
3. Whisker segments (two per box: lower + upper)
4. Box (rect or notched polygon)
5. Median line (fattened)

**Examples:**

```typescript
// Basic boxplot
ggpbi()
  .data(data)
  .aes({ x: 'category', y: 'value' })
  .geom('boxplot')
  .renderTo(el);

// Notched boxplot with whisker caps
.geom('boxplot', { boxNotch: true, boxStapleWidth: 0.5 })

// Variable width (wider = more data)
.geom('boxplot', { boxVarWidth: true })

// No outliers displayed
.geom('boxplot', { boxOutlierShow: false })

// Extended whiskers (3× IQR)
.geom('boxplot', { boxCoef: 3 })

// Full range whiskers (no outliers)
.geom('boxplot', { boxCoef: Infinity })

// Custom component colors
.geom('boxplot', {
  boxBorderColor: '#333',
  boxWhiskerColor: '#666',
  boxMedianColor: 'red',
  boxStapleColor: '#666',
})

// Dodged boxplots (color groups side by side)
ggpbi()
  .data(data)
  .aes({ x: 'category', y: 'value', color: 'group' })
  .geom('boxplot')
  .renderTo(el);
```

**Power BI Format Pane:**

The Boxplot card appears in the Format Pane with these essential settings:
- Whisker length (IQR ×), Notch, Notch width, Variable width
- Staple width, Median line thickness
- Box width, Fill color
- Show outliers, Outlier size, Outlier shape

### `violin` — Violin Plot

Mirrored density per category, like ggplot2's `geom_violin()` /
`stat_ydensity()`. Needs a categorical `x` and a numeric `y`:

```typescript
ggpbi()
  .data(data)
  .aes({ x: 'group', y: 'value' })
  .geom('violin')
  .renderTo(el);

// Classic combo: violin + jittered raw points
.geom('violin')
.geom('point', { position: 'jitter', jitterWidth: 0.2, alpha: 0.5 })

// Every violin spans the full width (ggplot2 scale = "width")
.geom('violin', { violinScale: 'width' })
```

| Option | ggplot2 | Default | Description |
|--------|---------|---------|-------------|
| `violinScale` | `scale` | `'area'` | `'area'` = equal areas, `'count'` = area ∝ n, `'width'` = full width each |
| `bw` | `bw` | Silverman per group | Fixed kernel bandwidth |
| `adjust` | `adjust` | `1` | Bandwidth multiplier |
| `n` | `n` | `512` | KDE evaluation points along y |
| `trim` | `trim` | `true` | Clip each violin to its group's data range |
| `width` | `width` | `0.9` | Violin width as fraction of the band |
| `fill` | `fill` | `'#FFFFFF'` | Fill when no colour aesthetic is mapped (colour-mapped groups use the palette and dodge side by side) |
| `stroke` | `colour` | `#333333` | Outline colour |
| `strokeWidth` | `linewidth` | `0.5` | Outline width in px |
| `alpha` | `alpha` | `1` | Opacity |

The density estimate is the same Gaussian KDE as [`density`](#density--kernel-density-estimate);
groups with fewer than 2 observations are skipped with a console warning.

**Power BI:** layer type **Violin**, plus the **Distribution
(Density / Violin)** card for smoothing (`adjust`), trimming and width
scaling. The card has separate trim toggles because the ggplot2 defaults
differ: *Trim violin to data range* is **on** (untrimmed tails extend
3 bandwidths past min/max and get clipped at the panel edge), *Trim
density to data range* is off. The classic combo — violin with jittered
raw points on top — is Layer 1 `violin` + Layer 2 `point` with Position
`jitter`.

### `histogram` — Histogram

```typescript
ggpbi()
  .data(measurements)
  .aes({ x: 'height' })
  .geom('histogram', { bins: 20 })
  .renderTo(el);
```

Bins continuous data into equal-width intervals and counts observations per bin.
Matches ggplot2 `geom_histogram()` / `stat_bin()` exactly.

**stat_bin:** Automatically bins data — no pre-aggregation needed. Just map a numeric field to `x`.
Height defaults to count; density and normalized variants are available as computed variables.

> **Power BI:** put a unique field (an ID or date column) into the
> **Detail** well alongside X. Power BI collapses rows that share the
> same field values *before* the visual sees them, so without a row
> identity the histogram counts **distinct X values** per bin instead of
> rows — for one-decimal data that caps every bar at 10.

```typescript
// Basic histogram (30 bins, default)
ggpbi()
  .data(data)
  .aes({ x: 'value' })
  .geom('histogram')
  .renderTo(el);

// Custom bin width
ggpbi()
  .data(data)
  .aes({ x: 'value' })
  .geom('histogram', { binwidth: 5 })
  .renderTo(el);

// Explicit breaks
ggpbi()
  .data(data)
  .aes({ x: 'value' })
  .geom('histogram', { breaks: [0, 10, 20, 50, 100] })
  .renderTo(el);

// Stacked histogram with color grouping
ggpbi()
  .data(data)
  .aes({ x: 'value', color: 'group' })
  .geom('histogram', { bins: 15, position: 'stack' })
  .renderTo(el);

// Dodged histogram (side by side)
ggpbi()
  .data(data)
  .aes({ x: 'value', color: 'group' })
  .geom('histogram', { bins: 15, position: 'dodge' })
  .renderTo(el);
```

**All parameters match ggplot2 `geom_histogram()` / `stat_bin()`:**

| Option | ggplot2 Equivalent | Default | Description |
|--------|-------------------|---------|-------------|
| `bins` | `bins` | 30 | Number of bins |
| `binwidth` | `binwidth` | — | Bin width in data units (overrides `bins`) |
| `breaks` | `breaks` | — | Explicit break points (overrides `bins` and `binwidth`) |
| `center` | `center` | — | Center of one bin (aligns bins) |
| `boundary` | `boundary` | 0 | Boundary between two bins (aligns bins) |
| `closed` | `closed` | `'right'` | Which side is closed: `'right'` = (a,b], `'left'` = [a,b) |
| `pad` | `pad` | `false` | Add zero-count bins at range boundaries |
| `drop` | `drop` | `'none'` | Empty-bin handling: `'none'`, `'all'`, or `'extremes'` |
| `yAxis` | `after_stat(...)` | `'count'` | Y statistic: `'count'`, `'density'`, `'ncount'`, or `'ndensity'` |
| `alpha` | `alpha` | 0.85 | Transparency (0–1) |
| `color` | `fill` | `#4682B4` | Fill color |
| `position` | `position` | `'stack'` | `'stack'`, `'dodge'`, `'dodge2'`, `'fill'`, `'identity'` |
| `stroke` | `colour` | `'#333333'` | Border color |
| `strokeWidth` | `linewidth` | 0.5 | Border width in px |
| `linetype` | `linetype` | `'solid'` | Border style |
| `orientation` | `orientation` | `'x'` | `'x'` (vertical) or `'y'` (horizontal) |
| `naRm` | `na.rm` | `false` | Silently remove NA values |

**Binning priority** (matches ggplot2): `breaks` > `binwidth` > `bins`.

**Bin width formula** (ggplot2): `width = (max - min) / (bins - 1)`.

**Computed variables** (available in stat_bin output):

| Variable | Description |
|----------|-------------|
| `count` | Number of observations in bin |
| `density` | count / (total × width) — integrates to 1 |
| `ncount` | count / max(count) — normalized to [0, 1] |
| `ndensity` | density / max(density) — normalized to [0, 1] |
| `width` | Bin width |
| `x` | Bin midpoint |
| `xmin` | Left bin edge |
| `xmax` | Right bin edge |

**Auto-detection:** When you map only a numeric field to `x` (no `y`), ggpbi automatically
picks `histogram` (like ggplot2's `qplot(x)` behavior).

**Power BI Format Pane:**

The Histogram card appears in the Format Pane with these settings:
- Number of bins, Bin width, Boundary, Center
- Closed side (right/left), Pad with empty bins, Drop empty bins
- Y-axis statistic
- Fill color

### `smooth` — Smoothed Conditional Means

Adds a smoothing line with optional confidence band.
Matches ggplot2 `geom_smooth()` / `stat_smooth()`.

```typescript
// Scatter + smooth (most common use case)
ggpbi()
  .data(data)
  .aes({ x: 'x', y: 'y' })
  .geom('point', { alpha: 0.5 })
  .geom('smooth')
  .renderTo(el);

// Linear regression without confidence band
ggpbi()
  .data(data)
  .aes({ x: 'x', y: 'y' })
  .geom('smooth', { method: 'lm', se: false, color: '#E66C37' })
  .renderTo(el);

// LOESS with custom span
ggpbi()
  .data(data)
  .aes({ x: 'x', y: 'y' })
  .geom('smooth', { method: 'loess', span: 0.5 })
  .renderTo(el);

// Grouped smooth (one curve per color group)
ggpbi()
  .data(data)
  .aes({ x: 'x', y: 'y', color: 'group' })
  .geom('point', { alpha: 0.3 })
  .geom('smooth')
  .renderTo(el);
```

**All parameters match ggplot2 `geom_smooth()` / `stat_smooth()`:**

| Option | ggplot2 Equivalent | Default | Description |
|--------|-------------------|---------|-------------|
| `method` | `method` | `'auto'` | `'auto'`, `'loess'`, `'lm'`, or `'movingAverage'` |
| `se` | `se` | `true` | Show confidence band |
| `level` | `level` | `0.95` | Confidence level (0–1) |
| `span` | `span` | `0.75` | LOESS smoothing parameter (0–1, smaller = more detail) |
| `n` | `n` | `80` | Number of evaluation points along x |
| `fullrange` | `fullrange` | `false` | Extend smooth to full axis range |
| `color` | `colour` | `'#3366FF'` | Line color |
| `fill` | `fill` | same as color | Confidence band fill color |
| `fillAlpha` | `alpha` | `0.4` | Band transparency (0–1) |
| `lineWidth` | `linewidth` | `2` | Line width in px (ggplot2: 2× base) |
| `linetype` | `linetype` | `'solid'` | Line style |
| `window` | — | `5` | Window size (only for `movingAverage`) |

**Method auto-detection** (matches ggplot2):
- < 1000 observations → `loess`
- ≥ 1000 observations → `lm`

**Methods:**

| Method | Description |
|--------|-------------|
| `loess` | Local polynomial regression (tricube weighting, like R's `loess()`) |
| `lm` | Ordinary Least Squares linear regression with t-distribution confidence bands |
| `movingAverage` | Centered rolling window average (Power BI extension, not in ggplot2) |

**Rendering** (matches ggplot2 `draw_group`):
1. Confidence ribbon — filled area, no border, semi-transparent (alpha=0.4)
2. Smooth line — fully opaque, drawn on top of ribbon

### `density` — Kernel Density Estimate

Smooth distribution curve, like ggplot2's `geom_density()`. Only needs an
`x` mapping — the y axis becomes the estimated density:

```typescript
ggpbi()
  .data(data)
  .aes({ x: 'value' })
  .geom('density')
  .renderTo(el);

// One curve per group, filled with the group colour
ggpbi()
  .data(data)
  .aes({ x: 'value', color: 'species' })
  .geom('density', { fill: true })
  .renderTo(el);

// Smoother / wigglier curves
.geom('density', { adjust: 2 })     // double bandwidth
.geom('density', { bw: 0.5 })       // fixed bandwidth
```

| Option | ggplot2 | Default | Description |
|--------|---------|---------|-------------|
| `bw` | `bw` | Silverman (R `bw.nrd0`) | Fixed kernel bandwidth |
| `adjust` | `adjust` | `1` | Bandwidth multiplier — `0.5` wigglier, `2` smoother |
| `n` | `n` | `512` | Evaluation points along x |
| `trim` | `trim` | `false` | Clip the curve to the data range instead of extending by 3·bw |
| `fill` | `fill` | — | `true` = fill with the line/group colour, string = explicit colour |
| `fillAlpha` | `alpha` | `0.3` | Fill opacity when `fill` is enabled |
| `color` | `colour` | steel blue | Line colour (per group when colour-mapped) |
| `size` | `linewidth` | `2` | Line width in px |
| `linetype` | `linetype` | `'solid'` | All 6 ggplot2 linetypes |

The estimate uses a Gaussian kernel; groups with fewer than 2 observations
are skipped with a console warning, like ggplot2.

**Power BI:** layer type **Density**, plus the **Distribution
(Density / Violin)** card for smoothing (`adjust`), trimming (*Trim
density to data range*, off by default like ggplot2) and the fill under
the curve.

### `hline` / `vline` / `abline` — Reference Lines

Fixed lines at data-space positions, like ggplot2's `geom_hline()`,
`geom_vline()` and `geom_abline()`. Reference lines ignore the bound data —
their position comes from the layer config alone — so they work as overlay
layers on any chart:

```typescript
// Horizontal target line on a bar chart
ggpbi()
  .data(data)
  .aes({ x: 'month', y: 'revenue' })
  .geom('col')
  .geom('hline', { yintercept: 10000, linetype: 'dashed', color: 'red' })
  .renderTo(el);

// Several intercepts at once
.geom('hline', { yintercept: [8, 12] })

// Vertical line — Date values work on time axes
.geom('vline', { xintercept: new Date('2024-01-01') })

// Diagonal y = intercept + slope · x (continuous scales only)
.geom('abline', { slope: 1, intercept: 0, linetype: 'dotted' })
```

| Option | ggplot2 | Default | Description |
|--------|---------|---------|-------------|
| `yintercept` | `yintercept` | — | `hline` only: y position(s) — number or array |
| `xintercept` | `xintercept` | — | `vline` only: x position(s) — number, Date, or array |
| `slope` | `slope` | `1` | `abline` only: slope of the line |
| `intercept` | `intercept` | `0` | `abline` only: y value at x = 0 |
| `color` | `colour` | `#333333` | Line colour |
| `size` | `linewidth` | `1` | Line width in px |
| `linetype` | `linetype` | `'solid'` | All 6 ggplot2 linetypes |
| `alpha` | `alpha` | `1` | Opacity |

Behaviour notes (like ggplot2): reference lines do **not** affect axis
limits — an intercept outside the data range is clipped by the panel; on a
band (category) axis a continuous intercept cannot be placed, so `hline`
on a categorical y / `vline` on a categorical x / `abline` on either draw
nothing.

**Power BI:** the **Reference Lines** card — an overlay that does *not*
consume one of the three layer slots. Enter positions as numbers or the
keywords `mean` / `median` (also `avg`), computed from the mapped X/Y
values, so "show the average" needs no DAX measure:

| Field | Example | Result |
|-------|---------|--------|
| Horizontal line(s) at | `mean` | one line at the average of the Y values |
| Horizontal line(s) at | `mean, 30` | average **and** a fixed line at 30 |
| Vertical line(s) at | `median` | one line at the median of the X values |

Unparsable entries are skipped rather than failing the render; colour,
line type and width apply to all reference lines.

### `segment` — Line Segments (geom_segment)

Straight segments from `(x, y)` to `(xend, yend)` — the mapped-data
counterpart to reference lines, and the natural geom for dumbbells built
from **pre-aggregated data** ([gallery](gallery.md#dumbbell-from-pre-aggregated-data-geom_segment)):

```typescript
// One row per group with lo/hi columns (in Power BI: DAX measures)
ggpbi()
  .data(stats) // { branche, lo, hi }
  .aes({ x: 'lo', y: 'branche', xend: 'hi' })
  .geom('segment', { color: '#C8D0D9', size: 2 })
  .geom('point', { size: 5 })                      // dot at lo
  .geom('point', { aes: { x: 'hi' }, size: 5 })    // dot at hi
  .renderTo(el);
```

A missing `xend`/`yend` falls back to the start value, so mapping only
`xend` draws horizontal segments and only `yend` vertical ones. Segment
ends **extend the axis domain** — a segment to `xend` never leaves the
panel. Arrows work exactly like `line` (`arrowShow`, `arrowEnds`,
`arrowType`, `arrowLength`, `arrowAngle`):

```typescript
// Flow arrows from (x,y) to (xend,yend)
.geom('segment', { arrowShow: true, arrowType: 'closed' })
```

| Option | ggplot2 | Default | Description |
|--------|---------|---------|-------------|
| `color` | `colour` | `#333333` | Segment colour (or via `aes.color`) |
| `size` | `linewidth` | `2` | Line width in px |
| `linetype` | `linetype` | `'solid'` | All 6 ggplot2 linetypes |
| `alpha` | `alpha` | `1` | Opacity |
| `arrowShow` … | `arrow` | `false` | Same arrow options as `line` |

**Power BI:** set a layer to **Segment** and drag a second measure into the
well: X well → `x1` (start) and `x2` (end) for horizontal segments; two Y
measures → `y1`/`y2` for vertical ones.

### `pointrange` — Point with Range (geom_pointrange)

A midpoint dot plus a range line — the classic mean-with-error-bars mark
([gallery](gallery.md#point-range-mean--sd)). Vertical with `ymin`/`ymax`,
horizontal with `xmin`/`xmax`; the range bounds extend the axis domain:

```typescript
ggpbi()
  .data(stats) // { cyl, mean, lo, hi } — pre-computed (in Power BI: DAX)
  .aes({ x: 'cyl', y: 'mean', ymin: 'lo', ymax: 'hi' })
  .geom('pointrange', { size: 1.5 })
  .scale({ x: 'category' })
  .renderTo(el);
```

| Option | ggplot2 | Default | Description |
|--------|---------|---------|-------------|
| `size` | `linewidth` | `1` | Range-line width in px |
| `fatten` | `fatten` | `4` | Dot radius = `size * fatten` |
| `shape` | `shape` | `'circle'` | Midpoint shape |
| `color` | `colour` | `#333333` | Colour (or via `aes.color`) |
| `alpha` | `alpha` | `1` | Opacity |

Rows without range bounds draw only the dot. There is no `stat_summary`
yet — the centre and bounds must exist in the data (see the
[roadmap](roadmap.md), #213).

**Power BI:** layer type **Point range** with three measures — Y well
`y1` = centre, `y2` = min, `y3` = max (vertical), or the same in the X
well for the horizontal version.

**Model or visual?** These two geoms are the model-first counterpart to the
[per-layer filter](#per-layer-filter--dumbbell-charts). The rule of thumb
ggpbi follows: **computations that create new numbers belong in the model
(DAX), selecting and emphasising rows belongs in the visual, and statistics
tied to the drawn geometry (count, bin, boxplot, density, smooth) live in
the visual like ggplot2 stats.** For a DAX-first dumbbell compute per group

```dax
Best OCR  = MINX ( VALUES ( Mieter[Name] ), [OCR %] )
Worst OCR = MAXX ( VALUES ( Mieter[Name] ), [OCR %] )
```

and connect the two measures with a `segment` layer — the filter-based
dumbbell computes the same ends in the visual from row-level data. Both
respond to slicers; the DAX way scales better (the visual only receives
one row per group), the filter way needs no model work.

### Combining Multiple Layers

This is the core of the Grammar of Graphics — layers are independent:

```typescript
ggpbi()
  .data(data)
  .aes({ x: 'x', y: 'y' })
  .geom('area', { alpha: 0.2 })    // area in background
  .geom('line', { color: 'red' })  // line on top
  .geom('point', { size: 6 })      // points on top of that
  .renderTo(el);
```

### Per-Layer Filter — Dumbbell Charts

Every geom accepts a `filter` option — ggplot2's layer-local
`data = subset(...)`. It restricts **this layer's rows only**; scales, stats
and all other layers still see the full data, so the axes don't shrink.

| Value | Meaning |
|-------|---------|
| function | Keep the rows it returns `true` for (JS API only) |
| `'min'` | Per discrete-axis group, keep the row with the **lowest** value on the continuous axis |
| `'max'` | …the **highest** value |
| `'extremes'` | Both ends — a dumbbell's two dots in one layer |

The group axis is whichever axis is discrete (ordinal/category); with two
continuous axes, rows group by the `group`/`color` aesthetic instead. Rows
with NA on the value axis never win.

The classic use is a **dumbbell chart** — best and worst value per category
([gallery](gallery.md#dumbbell--min-and-max-per-category)):

```typescript
ggpbi()
  .data(ocr) // { branche, tenant, ocr } — many tenants per branche
  .aes({ x: 'ocr', y: 'branche', label: 'tenant' })
  .geom('line', { color: '#C8D0D9', size: 2 })                    // segment min → max
  .geom('point', { filter: 'min', color: '#4E79A7', size: 5 })    // best
  .geom('point', { filter: 'max', color: '#F28E2B', size: 5 })    // worst
  .geom('text', { filter: 'min', repel: true, color: '#4E79A7', labelTemplate: '{label} {x:.1%}' })
  .geom('text', { filter: 'max', repel: true, color: '#F28E2B', labelTemplate: '{label} {x:.1%}' })
  .scale({ x: { labels: 'percent' } })
  .renderTo(el);
```

The line layer needs no filter: with a categorical y, lines connect all rows
of a category sorted by x — visually the min→max segment.

**Power BI:** each layer card has a **Filter rows** dropdown (All rows / Min /
Max / Extremes) in Position & Layout. With the three available layers use:
Layer 1 `line`, Layer 2 `point` + Filter rows `Extremes`, Layer 3 `text` +
Filter rows `Extremes` + Repel labels + a Label template like
`{label} {x:.1%}`. Try it: field with the category → Y, measure → X, name
field → Label.

---

## Scales

Scales are automatically detected:

| Data Type | Detected Scale |
|-----------|---------------|
| `number` | `linear` |
| `string` | `ordinal` |
| `Date` | `time` |

### Expand (ggplot2 behavior)

- **Continuous axes** (linear, log, sqrt, time): 5% padding on each side (like ggplot2 `expansion(mult = 0.05)`)
- **Discrete axes** (ordinal, category): outer padding via `d3.scaleBand()` (like ggplot2 `expansion(add = 0.6)`)

This ensures data points and bars never sit directly on the axis line. It happens automatically — no code needed.

### Panel Clipping (ggplot2 behavior)

Geom elements are clipped to the panel area (the grey background rectangle), matching ggplot2's default `panel.clip = TRUE`. Points, bars, and other marks that would extend beyond the panel boundary are cut off at the edge. This prevents overflow into axis labels or margins.

### Size Scale (ggplot2 `scale_size()`)

When using `aes({ size: 'fieldName' })`, data values are mapped to pixel
radii the way ggplot2's `scale_size()` does: **by area, not by radius**.
The value is normalised to `[0, 1]`, the square root taken, and the result
mapped into a radius range of **2–12 px**.

- **Area proportional to the value** — twice the value draws twice the
  ink, which is how the eye reads a bubble. A linear radius map instead
  makes big values shout (area grows with r²) and crushes the small ones
  together: on `mtcars` `hp` it left 17 of 32 cars below r = 2.5, which
  reads as "all bubbles the same size".
- **Wider range than ggplot2's `c(1, 6)`** — those are millimetres on a
  7-inch device, these are pixels. With a default point radius of 4, a
  bubble maximum of 6 was barely larger than an ordinary point.
- Sizes stay within a readable range regardless of the data magnitude.

**In Power BI:** drop a numeric field into the **Size** well — as a
measure or as a raw column, both bind. The mapped field always wins over
the layer's *Size* slider, which stays the size for marks with no size
mapping.

There is **no size legend yet**, so a bubble chart shows relative
magnitudes but no scale to read them against; put the value in the
tooltip meanwhile.

**Configuring discrete axes:**

```typescript
// More outer padding (bars further from edge)
.scale({ x: { paddingOuter: 1.0 } })

// More space between bars
.scale({ x: { paddingInner: 0.3 } })

// Both together
.scale({ x: { paddingInner: 0.2, paddingOuter: 0.8 } })
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `paddingInner` | 0.1 | Space between bars (fraction of step, like ggplot2 `width=0.9`) |
| `paddingOuter` | 0.5 | Outer padding (fraction of step, like ggplot2 `expansion(add=0.6)`) |

**Adjusting bar width:**

```typescript
// Narrower bars (60% of bandwidth)
.geom('bar', { width: 0.6 })

// Very narrow bars
.geom('bar', { width: 0.3 })
```

### Manual Overrides

```typescript
.scale({ x: 'time', y: 'log' })
```

### Axis Limits

Set axis limits manually — like `scale_x_continuous(limits = ...)` in ggplot2:

```typescript
// Start X axis at 0
.scale({ x: { min: 0 } })

// Limit Y axis to 0–100
.scale({ y: { min: 0, max: 100 } })

// Combine with scale type
.scale({ x: { type: 'log', min: 1 } })

// Mix: X with limits, Y only type
.scale({ x: { min: 0 }, y: 'log' })
```

Unset limits are still computed automatically from the data (with 5% expand).

### Tick Label Format

Format continuous axis tick labels — like `scale_x_continuous(labels = scales::percent)` in ggplot2:

```typescript
// 1200000 → "1.2M" — the usual fix for a revenue axis
.scale({ y: { labels: 'compact' } })

// Group separators: 1200000 → "1,200,000" (or "1.200.000")
.scale({ y: { labels: 'thousands' } })

// Fractions as percent: 0.05 → "5%", 0.125 → "12.5%"
.scale({ x: { labels: 'percent' } })

// Currency, symbol and placement from the locale
.scale({ y: { labels: 'currency' } }).format({ currency: 'CHF' })

// Custom formatter function
.scale({ x: { labels: (v) => `${v} pcs` } })
```

| Value | Behavior |
|-------|----------|
| `'auto'` (default) | Plain numbers, minimal decimals, no group separators — ggplot2's look |
| `'thousands'` | Group separators |
| `'compact'` | Short scale: `1.2M`, `450K` |
| `'currency'` | Currency symbol; the code comes from `.format({ currency })` |
| `'percent'` | Value × 100 with `%` suffix; decimals computed on the percent values |
| function | Called with each break value, returns the label string |

Only applies to continuous scales — category axes always show their category
values. The dynamic left margin (see Themes) accounts for the formatted labels.

#### Locale

Every format goes through `Intl`, so the **report language decides** the
decimal mark, the group separator, the compact suffix and the currency
placement:

| Format | `en-US` | `de-AT` |
|--------|---------|---------|
| `auto` | `1234.5` | `1234,5` |
| `thousands` | `1,200,000` | `1.200.000` |
| `compact` | `1.2M` | `1,2 Mio.` |
| `currency` (EUR) | `€1,000` | `1.000 €` |

In Power BI the locale comes from the host automatically — nothing to
set. In the browser it defaults to the runtime locale, and
`.format({ locale: 'de-AT' })` overrides it.

#### Date axes

Time axes are formatted the same way, so month names follow the report
language rather than d3's English defaults:

```typescript
.scale({ x: { dateLabels: 'monthYear' } })   // "Mär 2015"
```

| Value | Example (`de-AT`) |
|-------|-------------------|
| `'auto'` (default) | granularity follows the tick spacing |
| `'year'` | `2015` |
| `'monthYear'` | `Mär 2015` |
| `'monthDay'` | `15. Mär` |
| `'date'` | `15.03.2015` |
| `'dateTime'` | `15.03.2015, 14:30` |

**In Power BI:** Format Pane → *X Axis* / *Y Axis* → **Label format** and
**Date format**; the currency code sits under *Theme → Currency code*.
Try it: bind a revenue measure to Y and set Label format to *Compact* —
`1200000` becomes `1.2M`, in the report's own language.

### Available Types

| Scale | When to use |
|-------|-------------|
| `linear` | Numeric data (default) |
| `log` | Exponential growth, large ranges |
| `sqrt` | Right-skewed distributions |
| `time` | Time series (Date objects) — axis labels use calendar formats (years, months), never raw epoch values |
| `ordinal` | Categories (strings) |
| `category` | Force a discrete axis, also for numeric fields (like `factor(x)` in R) |

### Error Messages

When data doesn't fit the scale:

```
ggpbi: No positive values in field "revenue" for log scale
```

---

## Themes

The theme system works like ggplot2: **one parameter (`baseSize`) determines everything**.

### Built-in Themes

```typescript
import { themeGrey, themeMinimal, themeDark } from 'ggpbi';

// Default (like ggplot2 theme_grey)
.theme(themeGrey())       // baseSize = 11
.theme(themeGrey(16))     // larger for presentations
.theme(themeGrey(7))      // smaller for dashboard tiles

// Minimal (fewer axis elements)
.theme(themeMinimal())

// Dark mode
.theme(themeDark())
```

### Custom Theme

```typescript
.theme({
  baseSize: 11,
  axisTextOverlap: 'rotate',  // 'hide' | 'rotate' | 'none'
  nBreaks: 5,
  colorPalette: ['#e41a1c', '#377eb8', '#4daf4a'],
})
```

### Derived Values

Everything derives proportionally from `baseSize`:

| Element | Formula | Default (baseSize=11) |
|---------|--------|----------------------|
| Axis text | `0.8 × baseSize` | 8.8px |
| Axis title | `1.0 × baseSize` | 11px |
| Tick length | `0.25 × baseSize` | 2.75px |
| Margins | `0.5 × baseSize` | 5.5px |

### Color Palette

Default: **Power BI standard colors** (`#118DFF`, `#12239E`, `#E66C37`, ...).
In Power BI, the visual automatically uses the report theme palette.

```typescript
// Custom colors
.theme({ colorPalette: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3'] })
```

### Label Overlap

| Mode | Behavior |
|------|----------|
| `'hide'` (default) | Hide overlapping labels (like ggplot2 `check.overlap`) |
| `'rotate'` | Rotate labels by -45° |
| `'none'` | Show everything (allow overlap) |

### Dynamic Left Margin

The left margin grows automatically to fit the widest y-axis tick label,
so long category names (e.g. `Home Furnishing` on a horizontal strip plot)
are never clipped at the left edge. Like ggplot2, the panel shrinks and the
labels stay fully visible; the y-axis title moves with the margin.

- Applies to categorical, numeric, and time y-axes (label width is estimated
  from the actual category values or the computed axis breaks).
- The margin never shrinks below the theme default and is capped at 40% of
  the chart width, so extreme labels can't squeeze out the plot panel.
- Passing an explicit `margin` to `render()`/`renderWithState()` disables
  the automatic sizing — your margin is used verbatim.

Try it: bind a text field with long category names to Y and a numeric field
to X (a horizontal point/strip plot). The category names now render fully
inside the visual instead of being cut off.

---

## Faceting

Small multiples — a separate panel per category:

```typescript
ggpbi()
  .data(data)
  .aes({ x: 'month', y: 'revenue' })
  .geom('bar')
  .facet({ col: 'region' })           // columns by region
  .renderTo(el);

// Rows + columns
.facet({ row: 'year', col: 'region' })

// Free scales (each panel its own axis)
.facet({ col: 'region', freeY: true })

// Wrap one variable into a grid (ggplot2 facet_wrap)
.facet({ wrap: 'region' })              // ~square grid: ceil(sqrt(n)) columns
.facet({ wrap: 'region', ncol: 2 })     // fixed column count
.facet({ wrap: 'region', nrow: 2 })     // fixed row count (ncol derived)
```

**Power BI:** the visual has a single **Facet** well, so a field dropped
there becomes `facet_wrap` — a roughly square grid, exactly like
ggplot2's `wrap_dims`: 4 levels → 2 × 2, 6 → 3 × 2, 9 → 3 × 3. (Using
`facet_grid` here would line every level up in one row and squeeze each
panel to a sliver.) The **Facets (Small Multiples)** card overrides it:

| Setting | Effect |
|---------|--------|
| **Columns** | `0` = automatic (the grid above); any other value fixes the column count |
| **Free X scale** | Each panel scales X to its own data (ggplot2 `scales = "free_x"`) |
| **Free Y scale** | Same for Y |

Free scales matter whenever the panels cover **different ranges** — one
decade per panel, one region per panel with very different magnitudes.
With shared scales each panel would only occupy the slice of the axis its
own data falls into.

| Option | Default | Description |
|--------|---------|-------------|
| `row` | — | Field for row facets (grid layout) |
| `col` | — | Field for column facets (grid layout) |
| `wrap` | — | Wrap a single field into a grid (like `facet_wrap`); takes precedence over `row`/`col` |
| `ncol` | `ceil(sqrt(n))` | Grid columns for `wrap` |
| `nrow` | — | Grid rows for `wrap` (used when `ncol` is not set) |
| `freeX` | `false` | Each panel gets its own X scale |
| `freeY` | `false` | Each panel gets its own Y scale |

Panels are ordered like ggplot2 factor levels: numerically when all level
values are numbers (`4, 6, 8` — not first-appearance order), alphabetically
otherwise.

---

## Highlighting (gghighlight)

Data-driven highlighting, like R's [gghighlight](https://yutannihilation.github.io/gghighlight/)
package: rows (or whole colour groups) matching a predicate keep their
colours — everything else turns grey, drops out of the legend, and is
drawn underneath the highlighted marks.

```typescript
// Group mode (colour aesthetic mapped): a group is highlighted when any
// of its rows passes the predicate
ggpbi()
  .data(data)
  .aes({ x: 'date', y: 'value', color: 'series' })
  .geom('line')
  .highlight({ filter: (d) => d.value > 20 })
  .renderTo(el);

// Row mode (no colour aesthetic): each row judged individually
.highlight({ filter: (d) => d.profit < 0, color: '#DDDDDD' })
```

| Option | gghighlight | Default | Description |
|--------|-------------|---------|-------------|
| `filter` | predicate expression | — | Row predicate; with a colour aesthetic the group verdict is "any row passes" |
| `color` | `unhighlighted_colour` | `#BEBEBE` | Colour for unhighlighted marks |

Highlighted groups keep **exactly** the colours they would have without
highlighting (scales and legend train on the full data first).

**Text layers get direct labeling** (like gghighlight): with a highlight
active, a text layer labels only the highlighted rows — grey labels on
grey points are noise, and the repel search gets room. Combine
`.geom('text', { repel: true })` with a highlight for the classic
"one named hero, grey crowd" chart.

**Per-layer control:** any layer can opt out with `highlight: false` in
its geom config — an exempted layer keeps its full colours (text layers:
all labels). In Power BI this is the **Apply highlight** toggle in each
layer's Position & Layout group.

```typescript
.geom('point')                          // greys out normally
.geom('text', { repel: true })          // labels highlighted rows only
.geom('smooth', { highlight: false })   // trend stays over ALL data
.highlight({ filter: (d) => d.name === 'Valiant' })
```

**Same field in two wells is fine:** using one column (e.g. `name`) for
both Color and Label works — the converter binds the label to the shared
field instead of stealing it from the colour role. The same goes for a
column that serves Y (raw, "Don't summarize") or Detail **and** Color,
Facet or Label at the same time (e.g. `Branche` in Y and Color): the
converter restores the shared column under both names so every role
binds to real data.

**Power BI:** the **Highlight** card in the Format Pane — enable it and
list the Color-field values to highlight (comma-separated, e.g.
`North, South`); everything else turns grey. Requires a field in the
Color well.

## Interactivity

### Tooltips

Active by default. Hovering over points/bars shows data values.

```typescript
// Show specific fields
.tooltip({ fields: ['revenue', 'region'] })

// Custom format
.tooltip({
  format: (d) => `${d.region}: ${d.revenue} EUR`
})

// Disable
.tooltip({ enabled: false })
```

### Selection

Click on elements to select them. Shift+click for multi-select.
Click on the background to deselect all.

```typescript
.selection({
  mode: 'multi',
  onSelectionChange: (selected) => {
    console.log('Selected:', selected);
  }
})
```

### Drill-Down

Double-click on an element triggers a callback:

```typescript
.drilldown({
  onDrill: (datum) => {
    console.log('Drill-down on:', datum);
  }
})
```

---

## Power BI Integration

For the full PBI guide see [examples/powerbi-integration.md](../examples/powerbi-integration.md).

### Quick Summary

1. `npx pbiviz package` → `.pbiviz` file
2. Import into Power BI Desktop
3. Assign fields (see data roles below)

**Want a ready-made report?** Every
[release](https://github.com/efelcie/ggpbi/releases) carries a
`GgpbiDemo-<version>.zip` under **Assets** — a text-based Power BI project
with the classic gallery datasets inlined and the ggpbi visual
**embedded**. Extract it and open the `.pbip` in Desktop, done (click
**Refresh** once on first open to build the local model cache). It has one
dashboard page per dataset (ggpbi visuals mixed with native slicers), two
showcase pages and the whole sample gallery grouped by topic, all on
1800×750 canvases.
4. Format Pane: configure geometry, style, scales, legend

### Data Roles (Aesthetics)

The field wells follow ggplot2's aesthetic vocabulary:

| Well | Role Name | Type | Description |
|------|-----------|------|-------------|
| **X** | `x` | GroupingOrMeasure | X axis — categories or measures. Use "Don't summarize" for raw numeric values. |
| **Y** | `y` | GroupingOrMeasure | Y axis values. **Drag two fields → second goes to Layer 2.** |
| **Color** | `color` | Grouping | Color grouping (legend) |
| **Size** | `size` | GroupingOrMeasure | Point size for bubble charts |
| **Tooltips** | `tooltip` | GroupingOrMeasure | Additional tooltip fields |
| **Facet** | `facet` | Grouping | Small multiples (one panel per category) |

**Multi-layer via Y:** When you drag two measures to the Y well, the first maps to
Layer 1 and the second to Layer 2. This is how you create combo charts (e.g. bars + line).

**Auto-detection:** ggpbi detects the chart type from the data:
- Categorical X + numeric Y → bar chart
- Numeric X + numeric Y → scatter plot (use "Don't summarize" on X)
- Time X + numeric Y → line chart
- Only X (no Y) → bar chart with count
- Only Y (no X) → boxplot

**Don't summarize:**
Measure fields (Y, Size, Tooltips) support the "Don't summarize" option.
Right-click the field in the well → select "Don't summarize".
This shows raw data without aggregation (no SUM/AVG) — each data point
keeps its original value. Especially important for scatter plots where each point
should represent an individual observation.

**Date/DateTime:** Date fields can be dragged to X with "Don't summarize"
as raw values. The time scale is automatically detected.

The visual has:
- **Landing page** when no data is assigned
- **Error page** with error message on problems
- **Rendering events** for PDF/PPT export
- **Host palette** — colors match the report theme
- **Format Pane** via FormattingModel API (`getFormattingModel`)
- **Cross-filtering** — click on a data point filters other visuals
- **ThemeDataColor** — PBIR template colors are automatically resolved
- **Accessibility** — ARIA, keyboard navigation, focus ring, high contrast
- **Style presets** — Grey/Minimal/Dark via PBI native style selection

### Format Pane (FormattingModel API)

The Format Pane uses the new `getFormattingModel()` API (instead of `enumerateObjectInstances`).
The settings use Grammar of Graphics vocabulary with a native Power BI look & feel.

#### Layer Cards (CompositeCard with Groups)

Each layer (1–3) is a **CompositeCard** with collapsible groups.
The top-level toggle switch activates/deactivates the layer.

**Auto is never a black box:** once the data resolves a layer, its card
title shows what is actually drawn — `Layer 1 · Auto (Bar)` for the auto
choice, `Layer 2 · Line` for an explicit type. The specialized cards
(Boxplot, Histogram, Smooth) appear only while their geom is really
active after auto resolution, keeping the pane short.

| Group | Slices | Visibility |
|-------|--------|------------|
| **General** | Type, Y field | Always |
| **Appearance** | Transparency, Size, Color, Line type, Orientation | Always (some slices conditional) |
| **Point** | Shape, Fill color, Stroke width | Only when Type = Point or Auto |
| **Position & Layout** | Position, Bar alignment, Jitter width/height | Always (sub-slices conditional) |
| **Line & Arrow** | Line cap, Line join, Show arrow, Arrow position/type/length/angle | Only when Type = Line, Area, Smooth or Auto |

**Conditional visibility:** Slices and groups appear only when relevant:
- Point group: visible for `point` and `auto` geom types
- Line & Arrow group: visible for `line`, `area`, `smooth` and `auto`
- Bar alignment & Orientation: visible for `bar`, `col`, `histogram` and `auto`
- Jitter width/height: visible only when Position = `jitter`
- Arrow detail slices: visible only when "Show arrow" is toggled on
- Line type: visible for line-like geoms and point (borders)

#### Other Cards

| Card | Slices | Type |
|------|--------|------|
| **X Axis** (`scaleX`) | Scale Type, Axis Title | AutoDropdown + TextInput |
| **Y Axis** (`scaleY`) | Scale Type, Axis Title | AutoDropdown + TextInput |
| **Legend** (`legend`) | Show Legend, Position | ToggleSwitch + AutoDropdown |
| **Theme** (`theme`) | Background, Grid, Text, Paper, Font Size | ColorPicker + NumUpDown |
| **Boxplot** (`boxplot`) | Whisker length, Notch, Notch width*, Variable width, Staple width, Fatten, Box width, Fill color, Outlier show/size*/shape* | Conditional: * only when toggle on |
| **Histogram** (`histogram`) | Bins*, Bin width, Boundary, Closed side, Pad, Fill color | Conditional: * hidden when binwidth > 0 |
| **Smooth** (`smooth`) | Method, Show CI, Level*, Span*, Output points, Full range, Ribbon color*/opacity*, Line width | Conditional: * based on method/SE toggle |

**Context-dependent cards:** Boxplot, Histogram and Smooth cards only appear
when at least one active layer uses that geom type (or when a layer is set to Auto).

The settings classes are defined in `src/formatting-settings.ts`.

### Multi-Layer (3 Layers)

ggpbi supports **3 independent geometry layers** in the Format Pane.
Each layer has its own type (bar, point, line, area, text, boxplot, histogram, smooth)
and its own style options organized in collapsible groups.

**How it works:**

1. **Layer 1** is active by default (auto) — data from first **Y** field
2. **Layer 2** is disabled by default — data from second **Y** field (drag two measures to Y)
3. **Layer 3** is disabled by default — data from third **Y** field
4. Activate a layer = **toggle on** in the respective layer card
5. Each layer has its own settings organized in collapsible groups: General, Appearance, Point, Position & Layout, Line & Arrow
6. **Render order**: Layer 1 is drawn first (bottom), Layer 2 in the middle, Layer 3 on top

**Example: Combo chart (bar + line)**

1. Layer 1: Type = bar, Transparency = 0.85
2. Layer 2: Toggle on, Type = line, Size = 2, Linetype = dashed

**Example: Scatter + trend (points + smooth)**

1. Layer 1: Type = point, Size = 5, Shape = diamond
2. Layer 2: Toggle on, Type = smooth, Transparency = 0.5

**Example: Grouped bar chart**

1. Layer 1: Type = bar, Position = dodge
2. Assign color field (series) → bars side by side per category

**Auto-Geom:** Layer 1 defaults to "Auto" — the chart type
is detected based on the assigned data fields (see [Auto-Geom](#auto-geom)).

### Tooltips (PBI native)

In the Power BI context, native PBI tooltips are used (`host.tooltipService`).
In browser mode (demo), DOM-based tooltips appear as usual.

PBI tooltips automatically show all mapped fields (x, y, color, etc.) and
support cross-filtering via SelectionId.

### Cross-Filtering (SelectionManager)

Click on a bar/point → the ggpbi visual tells Power BI which data points
are selected. Other visuals in the same report react accordingly.

- **Single selection**: Click on a data point — clicking it again always
  deselects (the visual adopts the SelectionManager's resolved state after
  every call, so highlight and report cross-filter cannot drift apart)
- **Multi-selection**: Shift+click
- **Group selection**: Click a **legend entry** or a **categorical axis
  label** to select every data point of that group; clicking the same
  group again clears it, Shift+click adds further groups. Continuous and
  time axis labels are not clickable (a numeric tick is a scale position,
  not a data group).
- **Clear selection**: Click on the background
- **Right-click**: opens Power BI's own data-point menu — *Drill through*,
  *Include* / *Exclude*, *Show as a table* — for the mark under the
  cursor, or for the visual as a whole on empty plot area. The host
  renders and positions the menu; ggpbi only reports where the click
  landed and which point it hit. Right-clicking never changes the
  selection.

### Guidance Pages (landing, empty data, errors)

The visual never shows raw exceptions to report users:

- **Landing page** (no fields assigned): explains that any field on X or Y
  produces a chart automatically, with quick examples.
- **No data page** (fields assigned, but filters return zero rows): says
  so explicitly instead of pretending fields are missing.
- **Error hints**: known rendering errors are translated into
  action-oriented messages — e.g. a non-numeric field on a numeric axis
  suggests swapping the field or setting the axis scale to Category. The
  raw technical message stays visible as a small muted detail line for
  debugging (`src/friendly-errors.ts`).

Two of those hints exist because the obvious message would send you after
the wrong problem:

- **"… is empty right now"** — the field is bound and of the right type,
  but every value is blank under the current filters: a measure returning
  BLANK, or a slicer selection with no matching rows. This is separated
  from the type errors on purpose; *"use a number field instead"* is bad
  advice for a measure that is simply empty at the moment. Widen the
  filter and the chart returns on its own.
- **"Not enough data for a … curve"** — density, violin and the other
  shape-computing geoms need at least two values per group. With a single
  observation there is no distribution to estimate, so the message names
  the stat instead of blaming the field.

Both are covered by `tests/empty-data.test.ts`, which also pins the
harmless cases: a single row, a constant value, mixed NaN, extreme
magnitudes and an empty data set all render rather than throw.

### Debug view: the code behind the chart

The Format Pane builds charts by clicking, which leaves nothing to read or
copy. **Theme → Show ggpbi code (debug)** overlays the fluent chain that
would produce the same chart:

```typescript
ggpbi()
  .data(data)                       // 32 rows
  .aes({ x: 'wt', y: 'mpg', color: 'cyl', label: 'name' })
  .geom('point', { size: 5, alpha: 0.8 })
  .geom('smooth', { method: 'lm' })
  .scale({ y: { labels: 'compact' } })
  .size(760, 460)
  .renderTo(element);
```

Three properties make it trustworthy:

- **Field names are the ones in your wells.** Power BI binds internal keys
  (`yRaw1`, `x`); the code names what you dragged in, so it runs as shown.
- **It is the mapping you made, not the one after computing.** A count bar
  rewrites `y` to `__count` internally — the code shows the `x` mapping
  that produces that count.
- **Only non-defaults appear.** A dump of every resolved option would bury
  the two lines that matter. Long arrays are summarised for the same
  reason — every Power BI chart carries the report theme's palette, and
  32 hex strings tell you nothing you chose: `colorPalette: [/* 32 values */]`.

It is an *overlay*: switching it on never resizes the chart underneath, and
switching it off leaves the plot exactly as it was. **Copy** puts the text
on the clipboard where the host allows it; the block is selectable either
way, so `Ctrl+C` always works. In the fluent API: `.showCode()`.

Use it to learn the API from a chart you built by clicking, to lift a
report chart into the library, or to attach a reproducible example to a
bug report.

### Moving the Visual (platform limitation)

Custom visuals can only be moved by grabbing their header/title area —
a Power BI platform limitation for sandboxed visuals, not a ggpbi
choice. An earlier experiment that made the visual body transparent to
the mouse (`pointer-events: none` on the container) backfired in
Desktop: the host then could not select the visual by clicking it at
all. The container therefore keeps normal pointer events; only the SVG
root stays pass-through so clicks reach the marks and the background.

### ThemeDataColor (PBIR Templates)

PBIR templates store colors as `{ ThemeDataColor: { ColorId: 0, Percent: 0 } }` instead of hex values.
ggpbi resolves these expressions automatically:

- **Hex string** → used directly
- **`{ solid: { color } }`** → Power BI standard format
- **`{ ThemeDataColor: { ColorId, Percent } }`** → color from host palette + brightness adjustment

The function `resolveColor()` in `src/powerbi.ts` handles the resolution.
`adjustBrightness()` adjusts brightness by percent (positive = lighter, negative = darker).

In the Format Pane, the user can choose a **color** via the ColorPicker (Style → Color).
This overrides the default geom color.

### Accessibility (WCAG 2.1 AA)

ggpbi supports accessibility for EAA compliance and AppSource certification:

**ARIA attributes:**
- SVG: `role="img"`, `aria-label` (derived from axis titles)
- Geom layer: `role="list"`, `aria-label="Data points"`
- Individual marks (bars, points, text): `role="listitem"`, `aria-label` with data values, `tabindex="0"`

**Keyboard navigation:**
- `Tab` → focus on SVG, then on individual data points
- `Arrow right/left` → next/previous data point
- `Enter`/`Space` → select data point (toggle)
- `Escape` → clear selection

**Focus ring:**
- Focused elements show a blue outline (`2px solid #118DFF`)

**High contrast:**
- Power BI high contrast mode is automatically detected
- Bars and points receive visible strokes (2px)
- Activation: `theme({ isHighContrast: true })` or automatically via `host.colorPalette.isHighContrast`

```typescript
// Try in the browser:
ggpbi()
  .data(data)
  .aes({ x: 'x', y: 'y' })
  .geom('bar')
  .theme({ isHighContrast: true })
  .renderTo(el);
// → Press Tab, then arrow keys for navigation
```

### Style Presets (PBI native style selection)

ggpbi supports the PBI native style selection (like tables/matrix). The theme properties
(background, grid, text, paper, font size) are exposed as `objects` in `capabilities.json`
and can be configured via PBI style presets.

**Included presets** (`ggpbi-theme.json`):

| Preset | Background | Grid | Text Color |
|--------|-----------|------|------------|
| **Grey (Default)** | `#EBEBEB` | `#ffffff` | `#333333` |
| **Minimal** | `#ffffff` | `#e0e0e0` | `#333333` |
| **Dark** | `#2d2d2d` | `#444444` | `#e0e0e0` |

**Setup:**

1. In Power BI Desktop: View → Themes → Browse → load `ggpbi-theme.json`
2. Select visual → Format Pane → Style Presets → choose preset

Alternatively, the theme properties can be adjusted directly in the Format Pane under "Theme".

**Color palette:** The color palette ALWAYS comes from the PBI report theme (host palette).
Style presets and manual theme settings never override the palette.

---

## Tests

```bash
npm test            # run all tests (currently ~349)
npm run test:watch  # vitest in watch mode
npm run build       # compile TypeScript

---

## Development

```bash
npm install          # dependencies
npm run build        # compile TypeScript
npm run dev          # watch mode
npm run demo:build   # build demo bundle
npm test             # tests
```

### Architecture

```
src/
├── types.ts        Types (DataPoint, AesMapping, GeomConfig, PlotSpec)
├── auto-geom.ts    Auto-geom selection (inferScaleLevel, inferGeom)
├── bind-data.ts    Bind data → aesthetics + validateAes()
├── scales.ts       Scales (linear, log, sqrt, time, band/ordinal)
├── geoms/          Geometries (point, line, bar, col, area, text, boxplot)
├── render.ts       Render pipeline (axes, layers, faceting)
├── index.ts        Fluent API + exports
├── theme.ts        Theme system (ggplot2-style)
├── tooltip.ts      Tooltips
├── selection.ts    Selection/filtering
├── legend.ts       Legend
├── powerbi.ts      DataView conversion
├── pbi-visual.ts   Power BI IVisual class
└── formatting-settings.ts  FormattingModel settings (GoG vocabulary)
```
