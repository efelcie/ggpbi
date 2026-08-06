/**
 * SceneGraph renderer — converts SceneNode[] to SVG via D3.
 *
 * This is the single point where SceneGraph → DOM conversion happens.
 * All geom-specific logic lives in the scene builders, not here.
 */

import * as d3 from 'd3';
import type { BoundPoint } from './bind-data';
import type { SceneNode, NodeStyle, AriaAttrs, MarkerSpec } from './scene-types';

// ---------------------------------------------------------------------------
// Style + accessibility helpers
// ---------------------------------------------------------------------------

/**
 * Apply shared style attributes to a D3 selection.
 */
export function applyNodeStyle(
  el: d3.Selection<SVGElement, unknown, null, undefined>,
  style: NodeStyle,
): void {
  if (style.fill != null) el.attr('fill', style.fill);
  if (style.stroke != null) el.attr('stroke', style.stroke);
  if (style.strokeWidth != null) el.attr('stroke-width', style.strokeWidth);
  if (style.strokeDasharray != null) el.attr('stroke-dasharray', style.strokeDasharray);
  if (style.strokeLinecap != null) el.attr('stroke-linecap', style.strokeLinecap);
  if (style.strokeLinejoin != null) el.attr('stroke-linejoin', style.strokeLinejoin);
  if (style.strokeMiterlimit != null) el.attr('stroke-miterlimit', style.strokeMiterlimit);
  if (style.opacity != null) el.attr('opacity', style.opacity);
}

/**
 * Apply accessibility attributes to a D3 selection.
 */
export function applyAria(
  el: d3.Selection<SVGElement, unknown, null, undefined>,
  aria?: AriaAttrs,
): void {
  if (!aria) return;
  if (aria.role) el.attr('role', aria.role);
  if (aria.tabindex) el.attr('tabindex', aria.tabindex);
  if (aria.label) el.attr('aria-label', aria.label);
}

/**
 * Bind the original data point as D3 datum on an element.
 * This enables tooltip and selection interactivity (they read `d3.select(el).datum()`).
 */
function bindDatum(
  el: d3.Selection<SVGElement, unknown, null, undefined>,
  data?: BoundPoint,
): void {
  if (data) el.datum(data);
}

// ---------------------------------------------------------------------------
// Marker definitions (arrowheads)
// ---------------------------------------------------------------------------

/**
 * Ensure an SVG marker definition exists for a MarkerSpec.
 * Creates `<defs>` → `<marker>` → `<path>` in the parent SVG.
 * Idempotent: skips if a marker with the same ID already exists.
 */
function ensureMarker(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  marker: MarkerSpec,
): void {
  const svg = d3.select(parent.node()!.ownerSVGElement!);
  let defs = svg.select<SVGDefsElement>('defs');
  if (defs.empty()) {
    defs = svg.append('defs');
  }
  if (!defs.select(`#${marker.id}`).empty()) return;

  const halfAngleRad = (marker.angle / 2) * (Math.PI / 180);
  const dx = marker.length * Math.cos(halfAngleRad);
  const dy = marker.length * Math.sin(halfAngleRad);

  const m = defs.append('marker')
    .attr('id', marker.id)
    .attr('viewBox', `0 0 ${marker.length} ${marker.length}`)
    .attr('refX', marker.length)
    .attr('refY', marker.length / 2)
    .attr('markerWidth', marker.length)
    .attr('markerHeight', marker.length)
    .attr('orient', 'auto-start-reverse');

  const tipX = marker.length;
  const tipY = marker.length / 2;
  const pathData = marker.type === 'closed'
    ? `M${tipX - dx},${tipY - dy} L${tipX},${tipY} L${tipX - dx},${tipY + dy} Z`
    : `M${tipX - dx},${tipY - dy} L${tipX},${tipY} L${tipX - dx},${tipY + dy}`;

  m.append('path')
    .attr('d', pathData)
    .attr('fill', marker.fill)
    .attr('stroke', marker.color)
    .attr('stroke-width', 1);
}

// ---------------------------------------------------------------------------
// renderSceneNodes — generic SVG renderer
// ---------------------------------------------------------------------------

/**
 * Render a single SceneNode to an SVG parent.
 * Returns the created SVG element.
 *
 * - Binds `node.data` as D3 datum (for tooltip/selection interactivity).
 * - Creates SVG marker definitions for PathNode arrow markers.
 */
function renderNode(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  node: SceneNode,
): SVGElement {
  switch (node.type) {
    case 'rect': {
      const el = parent.append('rect')
        .attr('class', node.class)
        .attr('x', node.x)
        .attr('y', node.y)
        .attr('width', node.width)
        .attr('height', node.height);
      applyNodeStyle(el as any, node.style);
      applyAria(el as any, node.aria);
      bindDatum(el as any, node.data);
      return el.node()!;
    }
    case 'path': {
      const el = parent.append('path')
        .attr('class', node.class)
        .attr('d', node.d);
      if (node.transform) el.attr('transform', node.transform);
      if (node.markerEnd) {
        ensureMarker(parent, node.markerEnd);
        el.attr('marker-end', `url(#${node.markerEnd.id})`);
      }
      if (node.markerStart) {
        ensureMarker(parent, node.markerStart);
        el.attr('marker-start', `url(#${node.markerStart.id})`);
      }
      applyNodeStyle(el as any, node.style);
      applyAria(el as any, node.aria);
      bindDatum(el as any, node.data);
      return el.node()!;
    }
    case 'line': {
      const el = parent.append('line')
        .attr('class', node.class)
        .attr('x1', node.x1)
        .attr('y1', node.y1)
        .attr('x2', node.x2)
        .attr('y2', node.y2);
      if (node.markerEnd) {
        ensureMarker(parent, node.markerEnd);
        el.attr('marker-end', `url(#${node.markerEnd.id})`);
      }
      if (node.markerStart) {
        ensureMarker(parent, node.markerStart);
        el.attr('marker-start', `url(#${node.markerStart.id})`);
      }
      applyNodeStyle(el as any, node.style);
      applyAria(el as any, node.aria);
      bindDatum(el as any, node.data);
      return el.node()!;
    }
    case 'text': {
      const el = parent.append('text')
        .attr('class', node.class)
        .attr('x', node.x)
        .attr('y', node.y)
        .text(node.text);
      if (node.textAnchor) el.attr('text-anchor', node.textAnchor);
      if (node.dy) el.attr('dy', node.dy);
      if (node.fontSize != null) el.attr('font-size', node.fontSize);
      if (node.fontFamily) el.attr('font-family', node.fontFamily);
      if (node.transform) el.attr('transform', node.transform);
      applyNodeStyle(el as any, node.style);
      applyAria(el as any, node.aria);
      bindDatum(el as any, node.data);
      return el.node()!;
    }
    case 'group': {
      const el = parent.append('g')
        .attr('class', node.class);
      if (node.transform) el.attr('transform', node.transform);
      applyNodeStyle(el as any, node.style);
      applyAria(el as any, node.aria);
      bindDatum(el as any, node.data);
      for (const child of node.children) {
        renderNode(el as any, child);
      }
      return el.node()!;
    }
  }
}

/**
 * Render an array of SceneNodes into an SVG group.
 *
 * This is the single point where SceneGraph → DOM conversion happens.
 * All geom-specific logic lives in the scene builders, not here.
 */
export function renderSceneNodes(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  nodes: SceneNode[],
): void {
  for (const node of nodes) {
    renderNode(g, node);
  }
}
