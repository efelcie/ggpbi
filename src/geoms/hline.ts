import { HlineGeomConfig } from '../types';
import { BoundPoint } from '../bind-data';
import type { LineNode } from '../scene-types';
import { linetypeToDasharray, REFLINE_DEFAULT_COLOR } from './util';

// ---------------------------------------------------------------------------
// Hline Scene Builder — pure geometry computation, no DOM
// ---------------------------------------------------------------------------

/**
 * Compute horizontal reference lines as SceneNodes (ggplot2 geom_hline).
 *
 * Ignores the bound data: positions come from config.yintercept alone.
 * One LineNode per intercept, spanning the full panel width. Intercepts
 * outside the y domain extrapolate and get cut by the panel clip, like
 * ggplot2. Band y scales cannot place a continuous intercept — those
 * lines are skipped.
 */
export function hlineToScene(
  _points: BoundPoint[],
  _xScale: any,
  yScale: any,
  config: HlineGeomConfig,
  _colorScale?: any,
  innerWidth = 0,
): LineNode[] {
  const intercepts = Array.isArray(config.yintercept) ? config.yintercept : [config.yintercept];
  const nodes: LineNode[] = [];

  for (const intercept of intercepts) {
    const y = Number(yScale(intercept));
    if (!Number.isFinite(y)) continue;

    nodes.push({
      type: 'line',
      class: 'ggpbi-hline',
      x1: 0,
      x2: innerWidth,
      y1: y,
      y2: y,
      style: {
        stroke: config.color ?? REFLINE_DEFAULT_COLOR,
        strokeWidth: config.size ?? 1,
        strokeDasharray: linetypeToDasharray(config.linetype) ?? undefined,
        opacity: config.alpha ?? 1,
      },
    });
  }
  return nodes;
}
