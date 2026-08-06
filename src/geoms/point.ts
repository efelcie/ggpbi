import * as d3 from 'd3';
import { PointGeomConfig } from '../types';
import { BoundPoint } from '../bind-data';
import type { PathNode, NodeStyle } from '../scene-types';
import { getShapeInfo, bandOffset, GEOM_DEFAULT_COLOR, filterNA } from './util';

/**
 * Simple seeded pseudo-random number generator (mulberry32).
 * Ensures jitter is deterministic per render for stable output.
 */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Style helpers — pure functions for shape-dependent fill/stroke
// ---------------------------------------------------------------------------

function resolveColour(d: BoundPoint, colorScale: any, defaultColor: string): string {
  if (d.color && colorScale) return colorScale(d.color);
  return defaultColor;
}

function svgFill(d: BoundPoint, colorScale: any, defaultColor: string, defaultFill: string, defaultShape: string): string {
  const cat = getShapeInfo(d.shape ?? defaultShape).category;
  switch (cat) {
    case 'filled':     return resolveColour(d, colorScale, defaultColor);
    case 'open':       return 'none';
    case 'fillBorder': return d.fill ?? defaultFill;
    case 'line':       return 'none';
  }
}

function svgStroke(d: BoundPoint, colorScale: any, defaultColor: string, defaultShape: string): string | null {
  const cat = getShapeInfo(d.shape ?? defaultShape).category;
  switch (cat) {
    case 'filled':     return null;
    case 'open':       return resolveColour(d, colorScale, defaultColor);
    case 'fillBorder': return resolveColour(d, colorScale, defaultColor);
    case 'line':       return resolveColour(d, colorScale, defaultColor);
  }
}

function svgStrokeWidth(d: BoundPoint, defaultStrokeWidth: number, defaultShape: string): number | null {
  const cat = getShapeInfo(d.shape ?? defaultShape).category;
  switch (cat) {
    case 'filled':     return null;
    case 'open':       return 1.5;
    case 'fillBorder': return defaultStrokeWidth;
    case 'line':       return 1.5;
  }
}

// ---------------------------------------------------------------------------
// Point Scene Builder — pure geometry computation, no DOM
// ---------------------------------------------------------------------------

/**
 * Compute point geometry as SceneNodes.
 *
 * Pure function: BoundPoint[] + scales + config → PathNode[].
 * Uses d3.symbol for path generation but no DOM/selections.
 * Testable without JSDOM.
 */
export function pointsToScene(
  points: BoundPoint[],
  xScale: any,
  yScale: any,
  config: PointGeomConfig,
  colorScale?: any,
): PathNode[] {
  if (points.length === 0) return [];

  // NA handling (centralized)
  const filtered = filterNA(points, config.naRm, 'geom_point');

  if (filtered.length === 0) return [];

  // Defaults
  const defaultSize = config.size ?? 4;
  const defaultAlpha = config.alpha ?? 0.8;
  const defaultColor = config.color ?? GEOM_DEFAULT_COLOR;
  const defaultShape = config.shape ?? 'circle';
  const defaultFill = config.fill ?? '#FFFFFF';
  const defaultStrokeWidth = config.strokeWidth ?? 0.5;

  // Jitter
  const isJitter = config.position === 'jitter';
  const jitterW = config.jitterWidth ?? 0.4;
  const jitterH = config.jitterHeight ?? 0;
  const xBandOffset = bandOffset(xScale);
  const yBandOffset = bandOffset(yScale);
  const isBandX = typeof xScale.bandwidth === 'function';
  const isBandY = typeof yScale.bandwidth === 'function';
  const rng = isJitter ? mulberry32(42) : undefined;

  const jitterXOffsets: number[] = [];
  const jitterYOffsets: number[] = [];
  if (isJitter) {
    const xJitterRange = isBandX ? xScale.bandwidth() * jitterW : jitterW * 20;
    const yJitterRange = isBandY ? yScale.bandwidth() * jitterH : jitterH * 20;
    for (let i = 0; i < filtered.length; i++) {
      jitterXOffsets.push((rng!() - 0.5) * xJitterRange);
      jitterYOffsets.push(yJitterRange > 0 ? (rng!() - 0.5) * yJitterRange : 0);
    }
  }

  // Symbol generator (no DOM dependency — just generates path strings)
  const symbolGen = d3.symbol<BoundPoint>()
    .type(d => getShapeInfo(d.shape ?? defaultShape).symbol)
    .size(d => {
      const r = d.size ?? defaultSize;
      return Math.PI * r * r;
    });

  const nodes: PathNode[] = [];

  for (let i = 0; i < filtered.length; i++) {
    const d = filtered[i];

    // Position
    const xPos = xScale(d.x) + xBandOffset + (isJitter ? jitterXOffsets[i] : 0);
    const yPos = yScale(d.y) + yBandOffset + (isJitter ? jitterYOffsets[i] : 0);

    // Path data from d3.symbol
    const pathD = symbolGen(d) ?? '';

    // Style
    const fill = svgFill(d, colorScale, defaultColor, defaultFill, defaultShape);
    const stroke = svgStroke(d, colorScale, defaultColor, defaultShape);
    const strokeWidth = svgStrokeWidth(d, defaultStrokeWidth, defaultShape);
    const opacity = d.alpha ?? defaultAlpha;

    const style: NodeStyle = { fill, opacity };
    if (stroke != null) style.stroke = stroke;
    if (strokeWidth != null) style.strokeWidth = strokeWidth;

    // Aria
    const xVal = typeof d.x === 'number' ? d.x.toLocaleString() : String(d.x);
    const yVal = typeof d.y === 'number' ? d.y.toLocaleString() : String(d.y);

    nodes.push({
      type: 'path',
      class: 'ggpbi-point',
      d: pathD,
      transform: `translate(${xPos},${yPos})`,
      style,
      aria: { role: 'listitem', tabindex: '0', label: `${xVal}: ${yVal}` },
      data: d,
    });
  }

  return nodes;
}
