/**
 * Legend rendering for ggpbi.
 *
 * Renders a ggplot2-style legend to the right of the chart area.
 * The legend key shape matches the geom type: circles for point,
 * lines for line, squares for bar/area/text.
 */

import * as d3 from 'd3';
import type { GeomConfig } from './types';
import type { ResolvedTheme } from './theme';

export interface LegendEntry {
  label: string;
  color: string;
}

/** Geom type → legend key shape */
type KeyShape = 'circle' | 'line' | 'square';

function geomToKeyShape(geoms: GeomConfig[]): KeyShape {
  // Use the first geom's type for the legend key
  const primary = geoms[0]?.type;
  if (primary === 'point') return 'circle';
  if (primary === 'line') return 'line';
  return 'square';
}

/**
 * Estimate the width needed for the legend (in px).
 * Uses character count × approximate char width.
 */
export function estimateLegendWidth(
  entries: LegendEntry[],
  title: string,
  theme: ResolvedTheme
): number {
  const charWidth = theme.legendTextSize * 0.55;
  const keyWidth = theme.legendTextSize * 1.2;
  const padding = theme.halfLine * 3;
  const maxLabelLen = Math.max(
    title.length,
    ...entries.map(e => e.label.length)
  );
  return Math.ceil(keyWidth + maxLabelLen * charWidth + padding);
}

/**
 * Render the legend into an SVG group.
 *
 * @param parent - The root <g> of the chart (margin-translated)
 * @param entries - Color → label pairs
 * @param title - Legend title (usually the aes field name)
 * @param geoms - Geom configs (determines key shape)
 * @param theme - Resolved theme
 * @param innerWidth - Width of the plot area (legend starts after this)
 */
export function renderLegend(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  entries: LegendEntry[],
  title: string,
  geoms: GeomConfig[],
  theme: ResolvedTheme,
  innerWidth: number
): void {
  const keyShape = geomToKeyShape(geoms);
  const keySize = theme.legendTextSize;
  const rowHeight = keySize * 1.8;
  const keyPad = keySize * 0.5;
  const legendX = innerWidth + theme.halfLine * 2;

  const legendG = parent.append('g')
    .attr('class', 'ggpbi-legend')
    .attr('transform', `translate(${legendX}, 0)`);

  // Title
  legendG.append('text')
    .attr('x', 0)
    .attr('y', keySize)
    .text(title)
    .style('font-size', `${theme.legendTextSize}px`)
    .style('font-weight', '600')
    .style('fill', theme.ink);

  // Entries
  const startY = keySize + rowHeight * 0.6;

  entries.forEach((entry, i) => {
    const y = startY + i * rowHeight;

    // One group per entry so interactivity (click-to-filter) can target it.
    const entryG = legendG.append('g')
      .attr('class', 'ggpbi-legend-entry')
      .attr('data-label', entry.label);

    // Key shape
    if (keyShape === 'circle') {
      entryG.append('circle')
        .attr('cx', keySize / 2)
        .attr('cy', y + keySize / 2)
        .attr('r', keySize * 0.35)
        .attr('fill', entry.color);
    } else if (keyShape === 'line') {
      entryG.append('line')
        .attr('x1', 0)
        .attr('y1', y + keySize / 2)
        .attr('x2', keySize)
        .attr('y2', y + keySize / 2)
        .attr('stroke', entry.color)
        .attr('stroke-width', 2);
    } else {
      entryG.append('rect')
        .attr('x', 0)
        .attr('y', y)
        .attr('width', keySize)
        .attr('height', keySize)
        .attr('fill', entry.color)
        .attr('rx', 2);
    }

    // Label
    entryG.append('text')
      .attr('x', keySize + keyPad)
      .attr('y', y + keySize * 0.8)
      .text(entry.label)
      .style('font-size', `${theme.legendTextSize}px`)
      .style('fill', theme.axisTextColor);
  });
}
