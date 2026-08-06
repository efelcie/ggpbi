# Power BI Themes for ggpbi

These theme JSON files let you install **ggplot-like discrete color palettes** at the **Power BI report level**.

Why this matters:
- ggpbi uses `host.colorPalette` inside Power BI.
- That means **the report theme controls the palette** (PBI-native behavior).
- Installing one of these themes makes ggpbi visuals match a ggplot-like look **without any code changes**.

## Included palettes

- **ggpbi — ggplot2 hue** (`ggpbi-ggplot2-hue.json`)
  - A close approximation of ggplot2's default discrete hue palette.

- **ggpbi — Okabe-Ito** (`ggpbi-okabe-ito.json`)
  - Colorblind-friendly palette (Okabe-Ito).

## How to import a theme in Power BI Desktop

1. Open your report in **Power BI Desktop**
2. Go to **View** → **Themes** → **Browse for themes**
3. Select one of the JSON files in this folder

Power BI will apply the palette to the report (and ggpbi will automatically pick it up).

## What it affects

- Affects the **categorical color palette** used by visuals that rely on the report theme.
- ggpbi: affects the `aes(color=...)` palette and discrete series colors.

If you want to override colors per-layer, you can still do that via the ggpbi format pane.
