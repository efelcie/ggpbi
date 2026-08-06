/**
 * SceneGraph types — intermediate representation between data pipeline and SVG.
 *
 * Geom scene builders produce SceneNode[] (pure data, no DOM).
 * scene-renderer.ts converts them to SVG via D3.
 *
 * Benefits:
 * - Testable without JSDOM (assert on node arrays)
 * - Separation of "what to draw" from "how to draw"
 * - Future: render to Canvas, SSR, etc.
 */

import type { BoundPoint } from './bind-data';

// ---------------------------------------------------------------------------
// Style — shared visual properties for all nodes
// ---------------------------------------------------------------------------

export interface NodeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  strokeLinecap?: string;
  strokeLinejoin?: string;
  strokeMiterlimit?: number;
  opacity?: number;
}

// ---------------------------------------------------------------------------
// Accessibility metadata
// ---------------------------------------------------------------------------

export interface AriaAttrs {
  role?: string;
  tabindex?: string;
  label?: string;
}

// ---------------------------------------------------------------------------
// Node types
// ---------------------------------------------------------------------------

interface BaseNode {
  /** CSS class name(s). */
  class: string;
  /** Visual style properties. */
  style: NodeStyle;
  /** Original data point (for tooltips, selection, cross-filtering). */
  data?: BoundPoint;
  /** Accessibility attributes. */
  aria?: AriaAttrs;
}

export interface RectNode extends BaseNode {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
}

/** SVG marker definition (arrowheads, etc.). */
export interface MarkerSpec {
  /** Unique marker ID. */
  id: string;
  /** Arrowhead angle in degrees. */
  angle: number;
  /** Arrowhead length in px. */
  length: number;
  /** Stroke/outline color. */
  color: string;
  /** Fill color ('none' for open arrows). */
  fill: string;
  /** Arrow type: 'open' or 'closed'. */
  type: 'open' | 'closed';
}

export interface PathNode extends BaseNode {
  type: 'path';
  /** SVG path data string (d attribute). */
  d: string;
  /** SVG transform (e.g. translate). */
  transform?: string;
  /** Marker at the end of the path (ggplot2: arrow). */
  markerEnd?: MarkerSpec;
  /** Marker at the start of the path. */
  markerStart?: MarkerSpec;
}

export interface LineNode extends BaseNode {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Marker at the end of the line (ggplot2: arrow on geom_segment). */
  markerEnd?: MarkerSpec;
  /** Marker at the start of the line. */
  markerStart?: MarkerSpec;
}

export interface TextNode extends BaseNode {
  type: 'text';
  x: number;
  y: number;
  text: string;
  textAnchor?: string;
  dy?: string;
  fontSize?: number;
  fontFamily?: string;
  transform?: string;
}

export interface GroupNode extends BaseNode {
  type: 'group';
  children: SceneNode[];
  transform?: string;
}

export type SceneNode = RectNode | PathNode | LineNode | TextNode | GroupNode;

/**
 * Cross-layer coordination state for one panel render. Repel-mode text
 * layers avoid label boxes placed by earlier text layers and the data
 * points of earlier point layers — without this, two text layers would
 * repel independently and could overlap each other.
 */
export interface PanelSharedState {
  /** Centres of label boxes already placed by earlier repel text layers. */
  repelPlaced: Array<{ x: number; y: number; w: number; h: number }>;
  /** Data-point positions labels must not cover. */
  repelAnchors: Array<{ x: number; y: number }>;
}
