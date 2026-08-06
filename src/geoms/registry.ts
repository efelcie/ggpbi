import type { BoundPoint } from '../bind-data';
import type { GeomConfig, GeomType } from '../types';
import type { SceneNode, PanelSharedState } from '../scene-types';
import { pointsToScene } from './point';
import { linesToScene } from './line';
import { barsToScene } from './bar';
import { areaToScene } from './area';
import { textToScene } from './text';
import { boxplotToScene } from './boxplot';
import { histogramToScene } from './histogram';
import { smoothToScene } from './smooth';
import { densityToScene } from './density';
import { violinToScene } from './violin';
import { hlineToScene } from './hline';
import { vlineToScene } from './vline';
import { ablineToScene } from './abline';
import { segmentsToScene } from './segment';
import { pointrangeToScene } from './pointrange';

// ---------------------------------------------------------------------------
// SceneBuilder — pure geometry computation, no DOM
// ---------------------------------------------------------------------------

/**
 * Common signature for all scene builders.
 *
 * Pure function: BoundPoint[] + scales + config → SceneNode[].
 * No DOM, no D3 selections. Testable without JSDOM.
 *
 * The scene builder registry enables uniform dispatch:
 *   const nodes = sceneBuilders[geom.type](points, xScale, yScale, geom, colorScale, innerWidth, innerHeight);
 */
export type SceneBuilder = (
  points: BoundPoint[],
  xScale: any,
  yScale: any,
  config: GeomConfig,
  colorScale?: any,
  innerWidth?: number,
  innerHeight?: number,
  shared?: PanelSharedState,
) => SceneNode[];

/** Scene builder lookup — the primary rendering path. DOM-free. */
export const sceneBuilders: Record<GeomType, SceneBuilder> = {
  point: (pts, xs, ys, cfg, cs) => pointsToScene(pts, xs, ys, cfg as any, cs),
  line: (pts, xs, ys, cfg, cs) => linesToScene(pts, xs, ys, cfg as any, cs),
  bar: (pts, xs, ys, cfg, cs, iw) => barsToScene(pts, xs, ys, cfg as any, cs, iw),
  col: (pts, xs, ys, cfg, cs, iw) => barsToScene(pts, xs, ys, { ...(cfg as any), type: 'bar', stat: 'identity' }, cs, iw),
  area: (pts, xs, ys, cfg, cs) => areaToScene(pts, xs, ys, cfg as any, cs),
  text: (pts, xs, ys, cfg, cs, iw, ih, shared) => textToScene(pts, xs, ys, cfg as any, cs, iw, ih, shared),
  boxplot: (pts, xs, ys, cfg, cs, iw) => boxplotToScene(pts, xs, ys, cfg as any, cs, iw),
  histogram: (pts, xs, ys, cfg, cs, iw) => histogramToScene(pts, xs, ys, cfg as any, cs, iw),
  smooth: (pts, xs, ys, cfg, cs) => smoothToScene(pts, xs, ys, cfg as any, cs),
  density: (pts, xs, ys, cfg, cs) => densityToScene(pts, xs, ys, cfg as any, cs),
  violin: (pts, xs, ys, cfg, cs, iw) => violinToScene(pts, xs, ys, cfg as any, cs, iw),
  hline: (pts, xs, ys, cfg, cs, iw) => hlineToScene(pts, xs, ys, cfg as any, cs, iw),
  vline: (pts, xs, ys, cfg, cs, iw, ih) => vlineToScene(pts, xs, ys, cfg as any, cs, iw, ih),
  abline: (pts, xs, ys, cfg) => ablineToScene(pts, xs, ys, cfg as any),
  segment: (pts, xs, ys, cfg, cs) => segmentsToScene(pts, xs, ys, cfg as any, cs),
  pointrange: (pts, xs, ys, cfg, cs) => pointrangeToScene(pts, xs, ys, cfg as any, cs),
};
