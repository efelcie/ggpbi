import type { DataPoint } from '../../src/types';
import { ggpbi, themeDark, themeMinimal } from '../../src/index';
import { mtcars, iris, toothGrowth, economics } from './data';

/**
 * ggplot2 sample gallery — single source of truth.
 *
 * Each sample pairs the classic ggplot2 (R) code with runnable ggpbi code.
 * The `code` string is EXECUTED verbatim by `runGallerySample()` and shown
 * verbatim in docs/gallery.md — what you read in the docs is exactly what
 * produced the committed SVG next to it ("docs = tested truth").
 *
 * Regenerate SVGs + gallery.md with:  npm run gallery
 * Verified by:                        tests/gallery.test.ts
 */
export interface GallerySample {
  /** Stable id — becomes the SVG filename (docs/gallery/<id>.svg). */
  id: string;
  title: string;
  /** The classic ggplot2 (R) code this sample reproduces. */
  r: string;
  /** Runnable ggpbi code. In scope: el, ggpbi, themeDark, themeMinimal and the datasets. */
  code: string;
  /** Optional remark rendered under the sample. */
  note?: string;
}

/** Datasets available inside sample code (and documented in gallery.md). */
export const galleryData: Record<string, DataPoint[]> = { mtcars, iris, toothGrowth, economics };

/** Execute a sample's code against a container element. */
export function runGallerySample(sample: GallerySample, el: HTMLElement): void {
  const fn = new Function(
    'el', 'ggpbi', 'themeDark', 'themeMinimal',
    'mtcars', 'iris', 'toothGrowth', 'economics',
    sample.code,
  );
  fn(el, ggpbi, themeDark, themeMinimal, mtcars, iris, toothGrowth, economics);
}

export const gallerySamples: GallerySample[] = [
  {
    id: 'scatter',
    title: 'Scatter plot',
    r: `ggplot(mtcars, aes(wt, mpg)) +
  geom_point()`,
    code: `ggpbi()
  .data(mtcars)
  .aes({ x: 'wt', y: 'mpg' })
  .geom('point')
  .size(640, 400)
  .renderTo(el);`,
  },
  {
    id: 'scatter-color',
    title: 'Scatter plot with colour mapping',
    r: `ggplot(iris, aes(Sepal.Length, Sepal.Width, colour = Species)) +
  geom_point(size = 2)`,
    code: `ggpbi()
  .data(iris)
  .aes({ x: 'Sepal.Length', y: 'Sepal.Width', color: 'Species' })
  .geom('point', { size: 5 })
  .size(640, 400)
  .renderTo(el);`,
  },
  {
    id: 'scatter-size',
    title: 'Bubble chart (size aesthetic)',
    r: `ggplot(mtcars, aes(wt, mpg, size = hp)) +
  geom_point(alpha = 0.6)`,
    code: `ggpbi()
  .data(mtcars)
  .aes({ x: 'wt', y: 'mpg', size: 'hp' })
  .geom('point', { alpha: 0.6 })
  .size(640, 400)
  .renderTo(el);`,
  },
  {
    id: 'smooth-lm',
    title: 'Linear regression with confidence band',
    r: `ggplot(mtcars, aes(wt, mpg)) +
  geom_point() +
  geom_smooth(method = "lm")`,
    code: `ggpbi()
  .data(mtcars)
  .aes({ x: 'wt', y: 'mpg' })
  .geom('point')
  .geom('smooth', { method: 'lm' })
  .size(640, 400)
  .renderTo(el);`,
  },
  {
    id: 'smooth-loess',
    title: 'LOESS smoother',
    r: `ggplot(mtcars, aes(disp, mpg)) +
  geom_point() +
  geom_smooth(method = "loess")`,
    code: `ggpbi()
  .data(mtcars)
  .aes({ x: 'disp', y: 'mpg' })
  .geom('point')
  .geom('smooth', { method: 'loess' })
  .size(640, 400)
  .renderTo(el);`,
  },
  {
    id: 'reference-lines',
    title: 'Reference lines',
    r: `ggplot(mtcars, aes(wt, mpg)) +
  geom_point() +
  geom_hline(yintercept = mean(mtcars$mpg), colour = "red", linetype = "dashed") +
  geom_vline(xintercept = mean(mtcars$wt), linetype = "dashed")`,
    code: `const mean = (f) => mtcars.reduce((s, d) => s + d[f], 0) / mtcars.length;
ggpbi()
  .data(mtcars)
  .aes({ x: 'wt', y: 'mpg' })
  .geom('point')
  .geom('hline', { yintercept: mean('mpg'), color: 'red', linetype: 'dashed' })
  .geom('vline', { xintercept: mean('wt'), linetype: 'dashed' })
  .size(640, 400)
  .renderTo(el);`,
    note: 'Reference lines ignore the bound data — their position comes from the layer config alone, so they overlay any chart type.',
  },
  {
    id: 'line-time',
    title: 'Time series line',
    r: `ggplot(economics, aes(date, unemploy)) +
  geom_line()`,
    code: `ggpbi()
  .data(economics)
  .aes({ x: 'date', y: 'unemploy' })
  .geom('line')
  .labels('date', 'unemploy (thousands)')
  .size(640, 400)
  .renderTo(el);`,
  },
  {
    id: 'line-multi',
    title: 'Multiple series (colour grouping)',
    r: `economics_long <- economics |>
  pivot_longer(c(psavert, uempmed))
ggplot(economics_long, aes(date, value, colour = name)) +
  geom_line()`,
    code: `const long = economics.flatMap((d) => [
  { date: d.date, series: 'psavert', value: d.psavert },
  { date: d.date, series: 'uempmed', value: d.uempmed },
]);
ggpbi()
  .data(long)
  .aes({ x: 'date', y: 'value', color: 'series' })
  .geom('line')
  .size(640, 400)
  .renderTo(el);`,
  },
  {
    id: 'bar-count',
    title: 'Bar chart (stat_count)',
    r: `ggplot(mtcars, aes(factor(cyl))) +
  geom_bar()`,
    code: `ggpbi()
  .data(mtcars)
  .aes({ x: 'cyl' })
  .geom('bar')
  .scale({ x: 'category' })
  .labels('cyl', 'count')
  .size(640, 400)
  .renderTo(el);`,
    note: 'Like `factor(cyl)` in R, `scale({ x: \'category\' })` forces the numeric field onto a discrete axis.',
  },
  {
    id: 'bar-stack',
    title: 'Stacked bars (weighted count)',
    r: `ggplot(ToothGrowth, aes(factor(dose), fill = supp)) +
  geom_bar(aes(weight = len))`,
    code: `ggpbi()
  .data(toothGrowth)
  .aes({ x: 'dose', color: 'supp', weight: 'len' })
  .geom('bar', { position: 'stack' })
  .scale({ x: 'category' })
  .labels('dose', 'sum of len')
  .size(640, 400)
  .renderTo(el);`,
  },
  {
    id: 'bar-dodge',
    title: 'Grouped bars (position dodge)',
    r: `ggplot(ToothGrowth, aes(factor(dose), fill = supp)) +
  geom_bar(aes(weight = len), position = "dodge")`,
    code: `ggpbi()
  .data(toothGrowth)
  .aes({ x: 'dose', color: 'supp', weight: 'len' })
  .geom('bar', { position: 'dodge' })
  .scale({ x: 'category' })
  .labels('dose', 'sum of len')
  .size(640, 400)
  .renderTo(el);`,
  },
  {
    id: 'col-horizontal',
    title: 'Horizontal bar chart (coord_flip)',
    r: `mtcars |>
  slice_max(hp, n = 10) |>
  ggplot(aes(hp, reorder(rownames, hp))) +
  geom_col()`,
    code: `const top = [...mtcars].sort((a, b) => a.hp - b.hp).slice(-10);
ggpbi()
  .data(top)
  .aes({ x: 'hp', y: 'name' })
  .geom('col', { orientation: 'y' })
  .size(640, 400)
  .renderTo(el);`,
    note: 'ggpbi has no `coord_flip()` — horizontal bars use `orientation: \'y\'` instead, like modern ggplot2.',
  },
  {
    id: 'histogram',
    title: 'Histogram',
    r: `ggplot(economics, aes(psavert)) +
  geom_histogram(binwidth = 1)`,
    code: `ggpbi()
  .data(economics)
  .aes({ x: 'psavert' })
  .geom('histogram', { binwidth: 1 })
  .size(640, 400)
  .renderTo(el);`,
  },
  {
    id: 'density',
    title: 'Density curves',
    r: `ggplot(iris, aes(Sepal.Length, fill = Species)) +
  geom_density(alpha = 0.3)`,
    code: `ggpbi()
  .data(iris)
  .aes({ x: 'Sepal.Length', color: 'Species' })
  .geom('density', { fill: true })
  .size(640, 400)
  .renderTo(el);`,
    note: 'Bandwidth follows Silverman’s rule like R — tune it with `adjust` (2 = smoother, 0.5 = wigglier) or a fixed `bw`.',
  },
  {
    id: 'boxplot-notch',
    title: 'Notched boxplot',
    r: `ggplot(ToothGrowth, aes(factor(dose), len)) +
  geom_boxplot(notch = TRUE)`,
    code: `ggpbi()
  .data(toothGrowth)
  .aes({ x: 'dose', y: 'len' })
  .geom('boxplot', { boxNotch: true })
  .scale({ x: 'category' })
  .size(640, 400)
  .renderTo(el);`,
  },
  {
    id: 'violin',
    title: 'Violin plot with jittered points',
    r: `ggplot(ToothGrowth, aes(factor(dose), len)) +
  geom_violin() +
  geom_jitter(width = 0.1, alpha = 0.5)`,
    code: `ggpbi()
  .data(toothGrowth)
  .aes({ x: 'dose', y: 'len' })
  .geom('violin')
  .geom('point', { position: 'jitter', jitterWidth: 0.15, alpha: 0.5 })
  .scale({ x: 'category' })
  .size(640, 400)
  .renderTo(el);`,
    note: 'Same Gaussian KDE as `density` under the hood; `violinScale` switches between ggplot2’s area/count/width scaling.',
  },
  {
    id: 'jitter',
    title: 'Jittered points',
    r: `ggplot(ToothGrowth, aes(factor(dose), len)) +
  geom_jitter(width = 0.2, alpha = 0.7)`,
    code: `ggpbi()
  .data(toothGrowth)
  .aes({ x: 'dose', y: 'len' })
  .geom('point', { position: 'jitter', jitterWidth: 0.3, alpha: 0.7 })
  .scale({ x: 'category' })
  .size(640, 400)
  .renderTo(el);`,
    note: 'Jitter offsets are seeded, so re-rendering produces identical output.',
  },
  {
    id: 'area-stacked',
    title: 'Stacked area chart',
    r: `economics_long <- economics |>
  pivot_longer(c(psavert, uempmed))
ggplot(economics_long, aes(date, value, fill = name)) +
  geom_area()`,
    code: `const long = economics.flatMap((d) => [
  { date: d.date, series: 'psavert', value: d.psavert },
  { date: d.date, series: 'uempmed', value: d.uempmed },
]);
ggpbi()
  .data(long)
  .aes({ x: 'date', y: 'value', color: 'series' })
  .geom('area', { position: 'stack', alpha: 0.8 })
  .size(640, 400)
  .renderTo(el);`,
  },
  {
    id: 'facet-grid',
    title: 'Faceting (small multiples)',
    r: `ggplot(mtcars, aes(wt, mpg)) +
  geom_point() +
  facet_grid(. ~ cyl)`,
    code: `ggpbi()
  .data(mtcars)
  .aes({ x: 'wt', y: 'mpg' })
  .geom('point')
  .facet({ col: 'cyl' })
  .size(640, 400)
  .renderTo(el);`,
  },
  {
    id: 'facet-wrap',
    title: 'Wrapped facets (facet_wrap)',
    r: `economics |>
  mutate(decade = paste0(10 * (year(date) %/% 10), "s")) |>
  ggplot(aes(date, unemploy)) +
  geom_line() +
  facet_wrap(~ decade, scales = "free_x")`,
    code: `const byDecade = economics.map((d) => ({
  ...d, decade: 10 * Math.floor(d.date.getFullYear() / 10) + 's',
}));
ggpbi()
  .data(byDecade)
  .aes({ x: 'date', y: 'unemploy' })
  .geom('line')
  .facet({ wrap: 'decade', freeX: true })
  .size(640, 440)
  .renderTo(el);`,
    note: 'Six decades wrap into a 3×2 grid (`ceil(sqrt(n))` columns by default); `ncol`/`nrow` fix the shape.',
  },
  {
    id: 'text-labels',
    title: 'Text labels',
    r: `mtcars |>
  filter(hp > 200) |>
  ggplot(aes(wt, mpg, label = rownames)) +
  geom_point() +
  geom_text(hjust = "inward", vjust = "inward", check_overlap = TRUE)`,
    code: `const strong = mtcars.filter((d) => d.hp > 200);
ggpbi()
  .data(strong)
  .aes({ x: 'wt', y: 'mpg', label: 'name' })
  .geom('point')
  .geom('text', { hjust: 'inward', vjust: 'inward', checkOverlap: true })
  .size(640, 400)
  .renderTo(el);`,
    note: '`inward` keeps edge labels inside the panel; `checkOverlap` hides labels that would collide (first in data order wins) — both straight from ggplot2.',
  },
  {
    id: 'text-repel',
    title: 'Repelled labels (ggrepel)',
    r: `library(ggrepel)
ggplot(mtcars, aes(wt, mpg, label = rownames(mtcars))) +
  geom_point() +
  geom_text_repel(size = 3)`,
    code: `ggpbi()
  .data(mtcars)
  .aes({ x: 'wt', y: 'mpg', label: 'name' })
  .geom('point')
  .geom('text', { repel: true, size: 10 })
  .size(640, 480)
  .renderTo(el);`,
    note: 'A deterministic force layout: labels repel each other and every point, a spring pulls them home, and displaced labels get a connector line — like R’s ggrepel.',
  },
  {
    id: 'highlight',
    title: 'Highlighting (gghighlight)',
    r: `library(gghighlight)
ggplot(iris, aes(Sepal.Length, Sepal.Width, colour = Species)) +
  geom_point(size = 2) +
  gghighlight(Species == "virginica")`,
    code: `ggpbi()
  .data(iris)
  .aes({ x: 'Sepal.Length', y: 'Sepal.Width', color: 'Species' })
  .geom('point', { size: 5 })
  .highlight({ filter: (d) => d.Species === 'virginica' })
  .size(640, 400)
  .renderTo(el);`,
    note: 'Unhighlighted groups turn grey, drop out of the legend and are drawn underneath — highlighted groups keep exactly their normal colours. In Power BI: the Highlight card with a comma-separated value list.',
  },
  {
    id: 'highlight-labels',
    title: 'Highlight + direct labels (the Valiant)',
    r: `library(gghighlight)
ggplot(mtcars, aes(wt, mpg, label = rownames(mtcars))) +
  geom_point() +
  gghighlight(rownames(mtcars) == "Valiant", label_key = rownames)`,
    code: `ggpbi()
  .data(mtcars)
  .aes({ x: 'wt', y: 'mpg', label: 'name' })
  .geom('point', { size: 5 })
  .geom('text', { repel: true })
  .highlight({ filter: (d) => d.name === 'Valiant' })
  .size(640, 400)
  .renderTo(el);`,
    note: 'With a highlight active, text layers label ONLY the highlighted rows (gghighlight’s direct labeling) — exempt a layer with `highlight: false` to keep everything. In Power BI: Highlight card + the per-layer “Apply highlight” toggle.',
  },
  {
    id: 'dumbbell',
    title: 'Dumbbell — min and max per category',
    r: `worst <- mtcars %>% group_by(cyl) %>% slice_min(mpg)
best  <- mtcars %>% group_by(cyl) %>% slice_max(mpg)
ggplot(mtcars, aes(mpg, factor(cyl))) +
  geom_line(colour = "grey75", linewidth = 2) +
  geom_point(data = worst, colour = "#F28E2B", size = 3) +
  geom_point(data = best,  colour = "#4E79A7", size = 3) +
  ggrepel::geom_text_repel(
    data = rbind(worst, best),
    aes(label = paste(rownames(.data), mpg)))`,
    code: `ggpbi()
  .data(mtcars)
  .aes({ x: 'mpg', y: 'cyl', label: 'name' })
  .geom('line', { color: '#C8D0D9', size: 2 })
  .geom('point', { filter: 'min', color: '#F28E2B', size: 5 })
  .geom('point', { filter: 'max', color: '#4E79A7', size: 5 })
  .geom('text', { filter: 'min', repel: true, color: '#F28E2B', size: 10, labelTemplate: '{label} {x:.1f}' })
  .geom('text', { filter: 'max', repel: true, color: '#4E79A7', size: 10, labelTemplate: '{label} {x:.1f}' })
  .scale({ y: 'category' })
  .labels('Miles per gallon', 'Cylinders')
  .size(640, 400)
  .renderTo(el);`,
    note: 'Per-layer `filter` is ggplot2’s layer-local `data =`: `\'min\'`/`\'max\'`/`\'extremes\'` keep the extreme row(s) per category, a function keeps arbitrary subsets. `labelTemplate` composes “name value” labels; repel layers coordinate across layers, so min and max labels never collide. In Power BI: the per-layer “Filter rows” dropdown and “Label template” input.',
  },
  {
    id: 'segment-dumbbell',
    title: 'Dumbbell from pre-aggregated data (geom_segment)',
    r: `stats <- mtcars %>% group_by(cyl) %>%
  summarise(lo = min(mpg), hi = max(mpg))
ggplot(stats, aes(x = lo, xend = hi, y = factor(cyl))) +
  geom_segment(colour = "grey75", linewidth = 2) +
  geom_point(aes(x = lo), colour = "#F28E2B", size = 3) +
  geom_point(aes(x = hi), colour = "#4E79A7", size = 3)`,
    code: `const stats = Object.values(mtcars.reduce((acc, d) => {
  const g = acc[d.cyl] ?? (acc[d.cyl] = { cyl: d.cyl, lo: Infinity, hi: -Infinity });
  g.lo = Math.min(g.lo, d.mpg);
  g.hi = Math.max(g.hi, d.mpg);
  return acc;
}, {}));
ggpbi()
  .data(stats)
  .aes({ x: 'lo', y: 'cyl', xend: 'hi' })
  .geom('segment', { color: '#C8D0D9', size: 2 })
  .geom('point', { size: 5, color: '#F28E2B' })
  .geom('point', { aes: { x: 'hi' }, size: 5, color: '#4E79A7' })
  .scale({ y: 'category' })
  .labels('Miles per gallon', 'Cylinders')
  .size(640, 400)
  .renderTo(el);`,
    note: 'The model-first dumbbell: the min/max columns already exist in the data (in Power BI: DAX measures), `segment` just connects x → xend. Compare the [filter-based dumbbell](#dumbbell--min-and-max-per-category), which computes the extremes in the visual. In Power BI: drag two measures into X (x1 = start, x2 = end) and set a layer to **Segment**.',
  },
  {
    id: 'pointrange',
    title: 'Point range (mean ± sd)',
    r: `ggplot(mtcars, aes(factor(cyl), mpg)) +
  stat_summary(fun = mean,
               fun.min = \\(x) mean(x) - sd(x),
               fun.max = \\(x) mean(x) + sd(x),
               geom = "pointrange")`,
    code: `const stats = Object.values(mtcars.reduce((acc, d) => {
  const g = acc[d.cyl] ?? (acc[d.cyl] = { cyl: d.cyl, vals: [] });
  g.vals.push(d.mpg);
  return acc;
}, {})).map(g => {
  const mean = g.vals.reduce((a, b) => a + b, 0) / g.vals.length;
  const sd = Math.sqrt(g.vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (g.vals.length - 1));
  return { cyl: g.cyl, mean, lo: mean - sd, hi: mean + sd };
});
ggpbi()
  .data(stats)
  .aes({ x: 'cyl', y: 'mean', ymin: 'lo', ymax: 'hi' })
  .geom('pointrange', { size: 1.5 })
  .scale({ x: 'category' })
  .labels('Cylinders', 'Miles per gallon (mean ± sd)')
  .size(640, 400)
  .renderTo(el);`,
    note: 'Vertical when `ymin`/`ymax` are mapped, horizontal with `xmin`/`xmax`. `size` sets the line width; the dot is `size * fatten` (default 4), like ggplot2. In Power BI: three measures in Y (y1 = centre, y2 = min, y3 = max) — or in X for the horizontal version — and layer type **Point range**.',
  },
  {
    id: 'theme-dark',
    title: 'Dark theme',
    r: `ggplot(iris, aes(Sepal.Length, Sepal.Width, colour = Species)) +
  geom_point(size = 2) +
  theme_dark()`,
    code: `ggpbi()
  .data(iris)
  .aes({ x: 'Sepal.Length', y: 'Sepal.Width', color: 'Species' })
  .geom('point', { size: 5 })
  .theme(themeDark())
  .size(640, 400)
  .renderTo(el);`,
  },
];
