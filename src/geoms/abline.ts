import { AblineGeomConfig } from '../types';
import { BoundPoint } from '../bind-data';
import type { LineNode } from '../scene-types';
import { linetypeToDasharray, REFLINE_DEFAULT_COLOR } from './util';

// ---------------------------------------------------------------------------
// Abline Scene Builder — pure geometry computation, no DOM
// ---------------------------------------------------------------------------

/**
 * Compute the diagonal reference line y = intercept + slope · x as a
 * SceneNode (ggplot2 geom_abline).
 *
 * Ignores the bound data: the line is evaluated at the x-domain edges and
 * clipped by the panel. Requires continuous x and y scales — on band
 * scales the equation has no meaning, so the builder returns no nodes.
 */
export function ablineToScene(
  _points: BoundPoint[],
  xScale: any,
  yScale: any,
  config: AblineGeomConfig,
): LineNode[] {
  if (typeof xScale.bandwidth === 'function' || typeof yScale.bandwidth === 'function') return [];

  const slope = config.slope ?? 1;
  const intercept = config.intercept ?? 0;

  const [x0, x1] = xScale.domain();
  const y0 = intercept + slope * Number(x0);
  const y1 = intercept + slope * Number(x1);

  const sx0 = Number(xScale(x0));
  const sx1 = Number(xScale(x1));
  const sy0 = Number(yScale(y0));
  const sy1 = Number(yScale(y1));
  if (![sx0, sx1, sy0, sy1].every(Number.isFinite)) return [];

  return [{
    type: 'line',
    class: 'ggpbi-abline',
    x1: sx0,
    y1: sy0,
    x2: sx1,
    y2: sy1,
    style: {
      stroke: config.color ?? REFLINE_DEFAULT_COLOR,
      strokeWidth: config.size ?? 1,
      strokeDasharray: linetypeToDasharray(config.linetype) ?? undefined,
      opacity: config.alpha ?? 1,
    },
  }];
}
