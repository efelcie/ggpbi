import { VlineGeomConfig } from '../types';
import { BoundPoint } from '../bind-data';
import type { LineNode } from '../scene-types';
import { linetypeToDasharray, REFLINE_DEFAULT_COLOR } from './util';

// ---------------------------------------------------------------------------
// Vline Scene Builder — pure geometry computation, no DOM
// ---------------------------------------------------------------------------

/**
 * Compute vertical reference lines as SceneNodes (ggplot2 geom_vline).
 *
 * Ignores the bound data: positions come from config.xintercept alone
 * (numbers, or Date values on time axes). One LineNode per intercept,
 * spanning the full panel height. Intercepts outside the x domain
 * extrapolate and get cut by the panel clip, like ggplot2. Band x scales
 * cannot place a continuous intercept — those lines are skipped.
 */
export function vlineToScene(
  _points: BoundPoint[],
  xScale: any,
  _yScale: any,
  config: VlineGeomConfig,
  _colorScale?: any,
  _innerWidth = 0,
  innerHeight = 0,
): LineNode[] {
  const intercepts = Array.isArray(config.xintercept) ? config.xintercept : [config.xintercept];
  const nodes: LineNode[] = [];

  for (const intercept of intercepts) {
    const x = Number(xScale(intercept));
    if (!Number.isFinite(x)) continue;

    nodes.push({
      type: 'line',
      class: 'ggpbi-vline',
      x1: x,
      x2: x,
      y1: 0,
      y2: innerHeight,
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
