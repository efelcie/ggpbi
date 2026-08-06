# ggpbi Development Log

## 2026-08-07 - v0.3.1

- Corrected the release metadata so the npm package, Power BI visual, GitHub tag, and `.pbiviz` download all report version `0.3.1`.
- Rebuilt and republished the release after an earlier tag-only attempt produced a `v0.3.1` GitHub Release containing the `0.3.0` visual metadata.

## 2026-08-06 - v0.3.0

- Prepared the public/private repository split and publishing workflow.
- Added MIT license text, publishing documentation, public allowlist checks, and third-party notices generation.
- Updated public-facing README/research documentation for the split.
- Bumped the package and Power BI visual metadata to `0.3.0`.

## 2026-08-05 - v0.2.57

- Fixed the Power BI Size well so raw columns can be bound again.
- Updated generated ggpbi code/debug output and documentation for raw Size mappings.
- Expanded capabilities and codegen coverage for Size well column bindings.
- Regenerated demo bundle and embedded PBIP visual artifacts for the current build.
- Bumped the package and Power BI visual metadata to `0.2.57`.

## 2026-08-05 - v0.2.56

- Added a Power BI debug overlay that shows the generated ggpbi fluent code for the current visual.
- Changed size aesthetics to scale bubble area instead of radius, matching ggplot2-style perception.
- Cleaned up the roadmap after shipped backlog items moved out of the candidate list.
- Regenerated gallery SVGs, demo bundle, and embedded PBIP visual artifacts for the current build.
- Bumped the package and Power BI visual metadata to `0.2.56`.

## 2026-08-05 - v0.2.55

- Added release-blocker fixes for data honesty, row identity, context menu support, axis formatting, and locale-aware labels.
- Added explicit empty/truncated-data handling and clearer user-facing guidance for undersized or non-finite data.
- Expanded tests for context menus, row identity, data truncation, empty data, locale formatting, and friendly errors.
- Regenerated demo bundle and embedded PBIP visual artifacts for the current build.
- Bumped the package and Power BI visual metadata to `0.2.55`.

## 2026-08-05 - v0.2.54

- Added Format Pane coverage for violin trim and the moving-average smoothing method.
- Updated the roadmap from the latest backlog review.
- Expanded capabilities and formatting tests for the newly exposed options.
- Regenerated and embedded the current Power BI visual package.
- Bumped the package and Power BI visual metadata to `0.2.54`.

## 2026-08-05 - v0.2.53

- Updated PBIP demo histogram pages so row counts use a Detail binding instead of distinct axis values.
- Documented the demo histogram row-count setup.
- Regenerated and embedded the current Power BI visual package.
- Bumped the package and Power BI visual metadata to `0.2.53`.

## 2026-08-05 - v0.2.52

- Fixed Power BI facets to use wrapped facet layout instead of forcing a single row.
- Reworked the PBIP demo report for a 1800x750 canvas with grouped gallery pages, dataset dashboard pages, and slicers.
- Updated PBIP demo generation, tests, guide/reference docs, and demo report notes for the grouped report structure.
- Regenerated and embedded the current Power BI visual package.
- Bumped the package and Power BI visual metadata to `0.2.52`.

## 2026-08-05 - v0.2.51

- Fixed stat output with layer-local aesthetic mappings so computed summaries bind to the correct layer fields.
- Added chart descriptions that explain computed stats, inferred geoms, and visual mappings.
- Exposed computed chart descriptions through the Power BI visual and formatting model.
- Updated documentation and tests for the new describe workflow.
- Regenerated demo bundle and embedded PBIP visual artifacts for the current build.
- Bumped the package and Power BI visual metadata to `0.2.51`.

## 2026-08-05 - v0.2.50

- Fixed stacked and dodged bars over row-level data by using group-ordered stacking and `stat_sum` aggregation.
- Updated the guide and reference docs for row-level bar chart workflows.
- Regenerated demo bundle and PBIP demo artifacts for the current visual build.
- Bumped the package and Power BI visual metadata to `0.2.50`.

## 2026-08-04 - v0.2.49

- Exposed density, violin, and reference-line geoms in the Power BI Format Pane.
- Completed the PBIP demo model with DAX measures, long-format economics data, decade fields, and the dark theme preset.
- Added the remaining expressible gallery pages to the PBIP demo report.
- Expanded PBIP/demo tests and documentation for the completed demo model.
- Bumped the package and Power BI visual metadata to `0.2.49`.

## 2026-08-04 - v0.2.48

- Fixed demo-page rendering issues found in Power BI Desktop review.
- Made the default Size setting behave as an auto-default so lines, labels, and pointranges keep their geom defaults unless explicitly overridden.
- Fixed bubble sizing when numeric size fields arrive as categorical Power BI columns.
- Added stacked-bar axis headroom and generated sum aggregations for stacked/dodged PBIP gallery pages.
- Bumped the package and Power BI visual metadata to `0.2.48`.

## 2026-08-04 - v0.2.47

- Embedded the packaged ggpbi visual directly into the PBIP demo report.
- Aligned PBIP report and semantic model files with the current Power BI Desktop save format.
- Added showcase pages and generated report pages for all expressible gallery samples.
- Documented the PBIP first-open refresh workflow and added regeneration checks for gallery/report drift.
- Bumped the package and Power BI visual metadata to `0.2.47`.

## 2026-08-03 - v0.2.46

- Added `geom_segment` for drawing row-wise lines between start and end coordinates.
- Added `geom_pointrange` for midpoint-and-range visuals with horizontal or vertical ranges.
- Improved `geom_col` orientation inference so numeric X plus discrete Y renders horizontal value bars.
- Added Power BI bindings, gallery samples, guide/reference updates, and tests for segment and pointrange workflows.
- Bumped the package and Power BI visual metadata to `0.2.46`.

## 2026-08-03 - v0.2.45

- Fixed same-field bindings when a raw Y or Detail field is also used for Color, Facet, or Label.
- Fixed solo X-measure rendering so a lone measure on X renders against a synthesized `All` group.
- Updated the guide and tests for shared-field and solo-measure Power BI workflows.
- Bumped the package and Power BI visual metadata to `0.2.45`.

## 2026-08-03 - v0.2.44

- Added dumbbell chart support using per-layer filters.
- Added label templates and cross-layer repel behavior for coordinated label placement.
- Added Power BI formatting, gallery, guide, and tests for dumbbell workflows.
- Bumped the package and Power BI visual metadata to `0.2.44`.

## 2026-08-03 - v0.2.43

- Improved highlight and label workflows with direct labeling and per-layer control.
- Added shared-field safety for highlight and label combinations.
- Added Power BI formatting, PBIR, gallery, guide, and test coverage for highlight labels.
- Bumped the package and Power BI visual metadata to `0.2.43`.

## 2026-08-03 - v0.2.42

- Added a roadmap document for candidate features and implementation context.
- Linked the roadmap from the README documentation row.
- Bumped the package and Power BI visual metadata to `0.2.42`.

## 2026-08-03 - v0.2.41

- Added `gghighlight`-style data-driven highlighting.
- Updated Power BI formatting and PBIR support for highlight settings.
- Made repel overflow hide labels that cannot find room, matching ggrepel behavior.
- Added gallery, documentation, and tests for highlighting and repel overflow.
- Bumped the package and Power BI visual metadata to `0.2.41`.

## 2026-08-03 - v0.2.40

- Added `repel` mode for `geom_text`, with deterministic ggrepel-style label placement.
- Added connector segments for displaced labels and a Power BI Format Pane toggle for repel labels.
- Added gallery and documentation coverage for text label repel behavior.
- Bumped the package and Power BI visual metadata to `0.2.40`.

## 2026-08-03 - v0.2.39

- Reverted the Power BI visual drag pass-through behavior after Desktop feedback.
- Fixed continuous-axis clipping by reserving padding around first and last ticks.
- Polished PBIP demo report visuals and setup notes.
- Bumped the package and Power BI visual metadata to `0.2.39`.

## 2026-08-03 - v0.2.38

- Added `check_overlap` support and inward justification for `geom_text`.
- Fixed the PBIP demo report schema metadata required by Power BI Desktop.
- Bumped the package and Power BI visual metadata to `0.2.38`.

## 2026-08-03 - v0.2.37

- Added a PBIP demo report with inlined gallery datasets.
- Added PBIP demo data generation and validation coverage.
- Bumped the package and Power BI visual metadata to `0.2.37`.

## 2026-08-02 - v0.2.36

- Improved auto chart fallback so every field-well combination renders a sensible chart.
- Made the Power BI visual draggable by its body instead of only by the edge.
- Replaced raw errors with action-oriented guidance pages.
- Showed resolved auto geoms in the Format Pane and collapsed inactive cards.
- Fixed Power BI selection toggle desync and made legend entries plus categorical axis labels clickable for group selection.
- Bumped the package and Power BI visual metadata to `0.2.36`.

## 2026-08-02 - v0.2.35

- Added `geom_density` with Gaussian kernel density estimation.
- Added `geom_violin` with y-density width scaling.
- Added `facet_wrap` for wrapping one facet variable into a grid.
- Updated the gallery and guide for density, violin, and facet-wrap examples.
- Bumped the package and Power BI visual metadata to `0.2.35`.

## 2026-08-02 - v0.2.34

- Added a ggplot2 sample gallery and gallery build script, including generated SVG examples and documentation.
- Fixed category-scale overrides that could produce `NaN`, improved time-axis labels, and preserved facet ordering.
- Added reference-line geoms: `geom_hline`, `geom_vline`, and `geom_abline`.
- Bumped the package and Power BI visual metadata to `0.2.34`.

## 2026-08-02 - v0.2.33

- Fixed inverted notch clamping in boxplot geometry.
- Hardened `NA`/missing-value handling across stacks and geoms.
- Fixed Power BI selection sync for shift-click multi-select, re-rendered highlights, bookmark/external selection updates, and background-click selection clearing.
- Bumped the package and Power BI visual metadata to `0.2.33`.

## 2026-08-01 - v0.2.32

- Fixed long y-axis category labels being clipped at the left edge: the left margin now grows dynamically to fit the widest tick label (capped at 40% of chart width), and the y-axis title moves with it.
- Added a tick label format for continuous axes (`labels: 'percent'` in the API, **Label format** dropdown on the X/Y Axis Format Pane cards) — fractions render as `5%`, `12.5%`, like ggplot2's `scales::percent`.
- Custom formatter functions are supported via the TypeScript API (`labels: (v) => ...`).
- Bumped the package and Power BI visual metadata to `0.2.32`.

## 2026-08-01 - v0.2.31

- Added a Power BI **Label** field well for text layers; blank labels are skipped for selective annotation.
- Centered line and text layers on categorical Y bands so overlays align with horizontal strip plots.
- Grouped horizontal strip-plot line layers by Y category to avoid cross-branch zigzags.
- Documented the Layer 1 point / Layer 2 line / Layer 3 text workflow.
- Bumped the package and Power BI visual metadata to `0.2.31`.

## 2026-08-01 - v0.2.30

- Added a Power BI **Detail** field well to define row/item identity for strip plots.
- Mapped X-axis measures correctly so visuals can use `X = measure`, `Y = category`.
- Centered and jittered points correctly on categorical Y bands for horizontal strip plots.
- Documented the Power BI strip plot setup (`X = OCR`, `Y = Branche`, `Detail = item ID`).
- Bumped the package and Power BI visual metadata to `0.2.30`.

## 2026-08-01 - v0.2.29

- Refreshed the demo website to better match the ggpbi project: clearer product framing, workbench-style layout, and direct latest `.pbiviz` download.
- Bumped the package and Power BI visual metadata to `0.2.29`.

## 2026-06-07

- Fixed Power BI visuals rendering no marks when Y contains a single aggregated measure
- Kept Power BI-hosted visuals out of the tab order so Delete removes the selected visual
- Organized boxplot Format Pane controls into Style, Outliers, and advanced Statistics groups
- Added histogram empty-bin handling with `drop = none`, `all`, or `extremes`
- Exposed histogram bin-center alignment through the Power BI Format Pane and PBIR
- Added histogram Y-axis selection for count, density, normalized count, and normalized density
- Made histogram center and boundary controls mutually exclusive in the Format Pane
- Exposed histogram bin border color through the Power BI Format Pane and PBIR
- Exposed histogram bin border width through the Power BI Format Pane and PBIR
- Exposed histogram bin border line type through the Power BI Format Pane and PBIR
- Exposed histogram transparency through the Power BI Format Pane and PBIR

## 2026-03-04 - v0.2.2

- Axis styling tweaks (ggplot2-like) and follow-up fixes after role redesign


## 2026-03-04 - v0.2.1

- Improved ggplot2 axis break handling (new breaks utility + tests)


## 2026-03-04 - v0.2.0

- Added `geom_col` (stat_identity) and updated auto-geom selection for categorical x + numeric y
- Translated documentation to English
- BREAKING (early): redesigned Power BI data roles to match ggplot2 aesthetics (x, y, color, size, tooltip, facet)


## 2026-03-02 - Power BI theme palettes

- Added Power BI theme JSONs for ggplot-like discrete palettes (no code changes)
  - `powerbi-themes/ggpbi-ggplot2-hue.json`
  - `powerbi-themes/ggpbi-okabe-ito.json`
  - Docs: `powerbi-themes/README.md`

## 2026-03-02 02:00 - Night auto-run

- Implemented `geom_boxplot` rendering (Tukey boxplot: q1–q3 box, median line, whiskers, outliers)
  - New renderer: `src/geoms/boxplot.ts`
  - Wired into `src/render.ts` (no longer falls back to points)

## 2026-02-27 11:26 - Heartbeat

- Faceting: initial rendering support in `renderWithState()`
  - `facet.row` / `facet.col` grid layout (small multiples)
  - Optional `freeX` / `freeY` per-panel domains (default: shared)
  - Strip labels for row/col facets
  - Interactivity (tooltip/selection/drilldown) wired across facets

## 2026-02-27 10:56 - Heartbeat

- Faceting groundwork: added `FacetConfig` + `facet` field to `PlotSpec`
- Fluent API: `.facet({ row: '...', col: '...' })` (type-only for now; rendering TBD)

## 2026-02-26 19:26 - Heartbeat

- Drill-down: add `drilldown.onDrill(datum)` (double-click) wiring in render pipeline
- Fluent API: `.drilldown({ onDrill: ... })`

## 2026-02-26 21:56 - Heartbeat

- Render pipeline: use shared `attachTooltip(...)` helper (less duplicated event code)

## 2026-02-26 17:56 - Heartbeat

- Render pipeline: ensure container `position: relative` so tooltips work reliably
- Tooltip positioning now uses pointer relative to container (instead of document body)
- Points/Bars geoms now return their element selections (enables easier interactivity wiring)

## 2026-02-26 07:56 - Heartbeat

- Selection: `clear()` / `select()` now also update element styles (not just callbacks)
- Selection: click on background clears current selection

## 2026-02-26 03:06 - Heartbeat (Early Morning)

**Milestone:** Selection/filtering system implemented ✅

- Created selection module (`selection.ts`)
  - `Selection` class: manages click-to-select interactions
  - Single-select mode (click toggles selection)
  - Multi-select mode (shift+click for multiple items)
  - Visual feedback: selected items get stroke highlight, unselected fade
  - `attach()` method for D3 selections
  - `onSelectionChange` callback for integration (e.g., Power BI filtering)
  - Programmatic API: `select()`, `clear()`, `getSelected()`, `isSelected()`
- Added `SelectionConfig` type to visual spec
  - `enabled`, `mode`, `onSelectionChange`, `selectedStyle`, `unselectedStyle`
  - Integrated into `PlotSpec`
- Updated render pipeline:
  - Creates Selection instance if enabled (default: true)
  - Attaches click handlers to interactive geoms (point, bar)
  - Manages visual state updates on selection change
- Fluent API: `.selection({ mode: 'multi', onSelectionChange: (d) => ... })`
- Exports: `Selection`, `SelectionConfig`
- Fixed powerbi.ts type errors (Data → DataPoint)

**Phase 3 (Interactivity) - Selection complete! ✅**

**Next:** Drill-down support (Phase 3 final), then Phase 4 (Faceting)

## 2026-02-26 02:58 - Heartbeat (Late Night Continued)

**Milestone:** Tooltip system implemented (Phase 3 started) 🎯

- Created tooltip module (`tooltip.ts`)
  - `Tooltip` class: creates/manages tooltip DOM element
  - `show()`, `hide()` methods for mouse interaction
  - Default formatter: shows all aesthetic-mapped fields
  - Custom formatter support via TooltipConfig
  - Positioned tooltips with cursor offset
- Added `TooltipConfig` type to visual spec
  - `enabled`, `fields`, `format` options
  - Integrated into `PlotSpec`
- Updated render pipeline:
  - Creates Tooltip instance if enabled (default: true)
  - Attaches mouseover/mousemove/mouseout handlers to interactive geoms
  - Uses `BoundPoint.datum` to access original data
- Fluent API: `.tooltip({ fields: ['x', 'y'], format: (d) => ... })`
- Exports: `Tooltip`, `TooltipConfig`

**Phase 3 (Interactivity) started!**

**Next:** Selection/filtering, drill-down

## 2026-02-26 02:37 - Heartbeat (Late Night)

**Milestone:** Power BI DataView integration ✅

- Created Power BI integration module (`powerbi.ts`)
  - `fromDataView()` - Converts Power BI DataView (categorical) to ggpbi Data format
  - `getFields()` - Extracts available field names for debugging/auto-mapping
  - Type definitions for Power BI DataView subset
  - Field mapping support (rename columns during conversion)
  - Display name vs. query name options
- Exported from main index: `fromDataView`, `getFields`, `DataView`, `ConversionOptions`
- Created integration example/guide (`examples/powerbi-integration.md`)
  - Setup instructions for Power BI custom visuals
  - Field mapping patterns
  - Multiple value columns handling
  - Troubleshooting tips
- README roadmap updated: **Phase 1 - Power BI DataView integration ✅**

**Phase 1 Complete!** Foundation is solid.

**Next:** Phase 3 (Interactivity) - tooltips, selection, drill-down

## 2026-02-26 02:05 - Heartbeat (Early Morning)

**Milestone:** Text geom complete — Phase 2 DONE! ✅

- Text geometry renderer (`geoms/text.ts`)
  - `renderText()` - Places text labels at (x, y) positions
  - Supports: label aesthetic, color/size mapping, rotation, text-anchor, font family
  - Defaults to y value if no label mapped
- Added `label` aesthetic to AesMapping + BoundPoint
- Wired into render pipeline
- Demo updated with text label example (5 labeled points with color grouping)
- README roadmap updated: **Phase 2 (Essential Geoms) ✅ COMPLETE**

**Phase 2 Complete:** Point, Line, Bar, Area, Text all implemented!

**Next:** Phase 3 (Interactivity) - tooltips, selection, drill-down

## 2026-02-25 - Day 1

**Milestone:** Project inception + Scale utilities

- Created repo structure (TypeScript + D3)
- Defined core types (`DataPoint`, `AesMapping`, `ScaleConfig`, `GeomConfig`, `PlotSpec`)
- Set up build tooling (tsconfig, package.json)
- Wrote project vision in README
- ✅ Implemented scale utilities:
  - `createScale()` - Creates D3 scales (linear, log, sqrt, time, ordinal)
  - `inferScaleType()` - Auto-detect scale type from data
  - Support for all planned scale types

**Next:** Build first geometry renderer (point geom)

## 2026-02-25 17:05 - Heartbeat #1

**Milestone:** First renderable visual!

- Data binding layer (`bind-data.ts`) - maps data columns to aesthetics
- Point geometry renderer (`geoms/point.ts`) - draws scatter dots via D3
- Full render pipeline (`render.ts`) - scales + axes + geom layers
- Fluent API (`index.ts`) - `ggpbi().data(...).aes(...).geom('point').renderTo(el)`
- Entry point with all exports

**Next:** Line + Bar geoms, then Power BI SDK integration

## 2026-02-25 18:05 - Heartbeat #2

**Milestone:** All core geoms + Research done

- Line geom renderer (with color grouping + auto-sort by x)
- Bar geom renderer (with dynamic bar width)
- Area geom renderer (filled area with grouping)
- All geoms wired into render pipeline
- **Research complete:** Found key projects:
  - **Deneb** (deneb-viz/deneb) - Vega/Vega-Lite wrapper for PBI → study their PBI integration
  - **G2** (antvis/G2) - Similar fluent API grammar → API design inspiration
  - **Vega-Lite** - Academic grammar → spec concepts
  - **pbiviz tools** (microsoft) - Official PBI packaging
- Research saved in RESEARCH.md

**Phase 2 (Essential Geoms) COMPLETE ✅**

**Next:** Power BI SDK integration (study Deneb's approach)

## 2026-02-25 - Heartbeat #2 (16:05)

- ✅ Point Geometry Renderer (`geoms/point.ts`)
  - `renderPoints()` - Renders scatter plot circles via D3
  - Supports: x/y position, color mapping, size mapping, alpha
  - Static color override via GeomConfig
- ✅ Module index files (geoms/index.ts, src/index.ts)

**Next:** Line geom + Bar geom

## 2026-02-25 - Day 1 (afternoon)

- ✅ Point geometry: `resolvePoints()` maps data → drawable coordinates, `renderPoints()` renders SVG circles
- Added barrel exports (index.ts, geoms/index.ts)

**Next:** Build `ggpbi()` builder API (fluent chain: data → aes → geom → render)

## 2026-02-25 - Day 1 (afternoon)

- ✅ `bindData()` - Resolves aesthetic mappings to uniform BoundPoint structure
- ✅ `renderPoints()` - First geometry renderer (scatter plot circles via D3)
  - Supports: x/y position, color (static + mapped), size (static + mapped), alpha
- ✅ `index.ts` - Public API barrel export

**Next:** Axis rendering + full `render()` pipeline that ties it all together

## 2026-02-25 - Day 1 (Heartbeat #2)

- ✅ Point geometry renderer (`src/geoms/point.ts`)
  - SVG circle rendering with D3
  - Supports aesthetic mappings: x, y, color, size, alpha
  - Area-proportional sizing for size aesthetic
  - Static color override via config
  - Configurable radius, opacity, stroke
- Added barrel exports (`src/geoms/index.ts`, `src/index.ts`)

**Next:** Line geometry + basic axis rendering

## 2026-02-25 - Day 1 (Heartbeat 2)

- ✅ Point geometry renderer (`src/geoms/point.ts`)
  - `renderPoints()` with margin system, auto-scaling
  - `RenderTarget` interface for SVG/Canvas abstraction
  - Supports size, color, alpha aesthetics
- ✅ Public API barrel (`src/index.ts`)

**Next:** SVG RenderTarget implementation + first visual output

- 2026-02-26: Added SelectionConfig.key() to support stable selection identity across renders.
