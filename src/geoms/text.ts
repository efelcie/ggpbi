import * as d3 from 'd3';
import { TextGeomConfig } from '../types';
import { BoundPoint } from '../bind-data';
import type { TextNode, LineNode, NodeStyle, PanelSharedState } from '../scene-types';
import { bandOffset, filterNA } from './util';

/**
 * Render a labelTemplate: '{label} {x:.1%}' → "SPAR 8.5%". Placeholders
 * {label}, {x}, {y} take the row's bound values; an optional d3-format
 * spec after the colon formats numeric values.
 */
export function renderLabelTemplate(template: string, d: BoundPoint): string {
  return template.replace(/\{(label|x|y)(?::([^}]+))?\}/g, (_m, key, spec) => {
    const v = (d as any)[key];
    if (v == null) return '';
    if (spec && typeof v === 'number') {
      try {
        return d3.format(spec)(v);
      } catch {
        return String(v);
      }
    }
    return String(v);
  });
}

// ---------------------------------------------------------------------------
// Repel layout — ggrepel-style force placement (deterministic, no DOM)
// ---------------------------------------------------------------------------

interface RepelBox {
  x: number;       // box centre
  y: number;
  w: number;
  h: number;
  ax: number;      // anchor (the data point)
  ay: number;
  prefY: number;   // preferred resting y (above the point)
  d: BoundPoint;
  label: string;
  fontSize: number;
  /** No collision-free spot existed — label is dropped (ggrepel max.overlaps). */
  hidden?: boolean;
}

/** Above this many labels the O(n²) simulation gets expensive — bail out. */
const REPEL_MAX_LABELS = 250;

/**
 * Deterministic label placement, ggrepel-style results via greedy slot
 * search: each label tries candidate positions in growing rings around its
 * point (preferring above, then below, then the sides) and takes the first
 * spot that collides with no placed label, no data point, and stays inside
 * the panel. Guaranteed overlap-free while there is room; when the panel is
 * truly full, the least-overlapping candidate wins.
 */
function repelLayout(
  boxes: RepelBox[],
  anchors: Array<{ x: number; y: number }>,
  innerWidth: number,
  innerHeight: number,
  placed: Array<{ x: number; y: number; w: number; h: number }> = [],
): void {
  const PAD = 3;
  const POINT_R = 6;

  // Preferred directions: above, below, right, left, then diagonals.
  const DIRS: Array<[number, number]> = [
    [0, -1], [0, 1], [1, 0], [-1, 0],
    [0.7071, -0.7071], [-0.7071, -0.7071], [0.7071, 0.7071], [-0.7071, 0.7071],
  ];

  const overlapArea = (b: RepelBox, x: number, y: number): number => {
    let area = 0;
    for (const o of placed) {
      const ox = Math.max(0, (b.w + o.w) / 2 + PAD - Math.abs(x - o.x));
      const oy = Math.max(0, (b.h + o.h) / 2 + PAD - Math.abs(y - o.y));
      area += ox * oy;
    }
    for (const p of anchors) {
      const ox = Math.max(0, b.w / 2 + POINT_R - Math.abs(x - p.x));
      const oy = Math.max(0, b.h / 2 + POINT_R - Math.abs(y - p.y));
      area += ox * oy;
    }
    return area;
  };

  for (const b of boxes) {
    let best: { x: number; y: number; area: number } | null = null;

    outer:
    for (const ring of [1.4, 2.2, 3.2, 4.5, 6.5, 9, 12]) {
      for (const [dx, dy] of DIRS) {
        const r = ring * b.fontSize;
        // Offset sideways placements so the box sits beside the point,
        // not centred on it.
        let x = b.ax + dx * (r + (dx !== 0 ? b.w / 2 - b.fontSize : 0));
        let y = b.ay + dy * r;
        x = Math.min(Math.max(x, b.w / 2), innerWidth - b.w / 2);
        y = Math.min(Math.max(y, b.h / 2), innerHeight - b.h / 2);

        const area = overlapArea(b, x, y);
        if (area === 0) {
          best = { x, y, area };
          break outer;
        }
        if (!best || area < best.area) best = { x, y, area };
      }
    }

    if (best && best.area === 0) {
      b.x = best.x;
      b.y = best.y;
      placed.push(b);
    } else {
      // No free spot anywhere — hide the label instead of overlapping,
      // like ggrepel's max.overlaps ("unlabeled data points").
      b.hidden = true;
    }
  }
}

/** Point where the segment anchor→box centre enters the box border. */
function boxEntryPoint(b: RepelBox): { x: number; y: number } {
  const dx = b.x - b.ax;
  const dy = b.y - b.ay;
  const tx = dx !== 0 ? 1 - (b.w / 2 + 1) / Math.abs(dx) : 0;
  const ty = dy !== 0 ? 1 - (b.h / 2 + 1) / Math.abs(dy) : 0;
  const t = Math.max(0, Math.min(1, Math.max(tx, ty)));
  return { x: b.ax + t * dx, y: b.ay + t * dy };
}

// ---------------------------------------------------------------------------
// Text Scene Builder — pure geometry computation, no DOM
// ---------------------------------------------------------------------------

/**
 * Compute text geometry as SceneNodes.
 *
 * Pure function: BoundPoint[] + scales + config → TextNode[].
 * One TextNode per data point. No DOM. Testable without JSDOM.
 */
export function textToScene(
  points: BoundPoint[],
  xScale: any,
  yScale: any,
  config: TextGeomConfig,
  colorScale?: any,
  innerWidth = 0,
  innerHeight = 0,
  shared?: PanelSharedState,
): Array<TextNode | LineNode> {
  // NaN positions would place labels at translate(NaN,…) — filter like
  // the other geoms do.
  const textPoints = filterNA(points, config.naRm, 'geom_text');
  if (textPoints.length === 0) return [];

  const defaultColor = config.color ?? '#333333';
  const defaultSize = config.size ?? 12;
  const configAnchor = config.textAnchor ?? 'middle';
  const angle = config.angle ?? 0;
  const fontFamily = config.fontFamily ?? 'sans-serif';
  const configDy = config.dy ?? '0.35em';

  const xBandOffset = bandOffset(xScale);
  const yBandOffset = bandOffset(yScale);
  const hasExplicitLabel = textPoints.some(p => Object.prototype.hasOwnProperty.call(p, 'label'));
  const labelOf = (d: BoundPoint): string => config.labelTemplate
    ? renderLabelTemplate(config.labelTemplate, d)
    : String(d.label ?? d.y ?? '');

  // check_overlap bookkeeping: estimated label boxes already drawn.
  // Text measurement is estimation-based (like the axis-label logic) —
  // ~0.6em average glyph width.
  const occupied: Array<{ x0: number; x1: number; y0: number; y1: number }> = [];
  const emOf = (dy: string): number => {
    const m = /^(-?[\d.]+)em$/.exec(dy.trim());
    return m ? Number(m[1]) : 0;
  };

  // --- Repel mode: ggrepel-style force placement -------------------------
  if (config.repel) {
    const anchors: Array<{ x: number; y: number }> = [];
    const boxes: RepelBox[] = [];

    for (const d of textPoints) {
      const ax = xScale(d.x) + xBandOffset;
      const ay = yScale(d.y) + yBandOffset;
      if (!Number.isFinite(ax) || !Number.isFinite(ay)) continue;
      anchors.push({ x: ax, y: ay });

      if (hasExplicitLabel && (d.label == null || d.label === '')) continue;
      const fontSize = d.size ?? defaultSize;
      const label = labelOf(d);
      boxes.push({
        x: ax,
        y: ay - fontSize * 1.2,
        w: label.length * fontSize * 0.62 + 6,
        h: fontSize * 1.3,
        ax, ay,
        prefY: ay - fontSize * 1.2,
        d, label, fontSize,
      });
    }

    if (boxes.length > REPEL_MAX_LABELS) {
      // Too many for the ring search — degrade to first-wins hiding so the
      // chart stays readable instead of stacking hundreds of labels.
      console.warn(`ggpbi: repel — ${boxes.length} labels exceed ${REPEL_MAX_LABELS}, showing only non-overlapping ones.`);
      const kept: RepelBox[] = [];
      for (const b of boxes) {
        const collides = kept.some(o =>
          Math.abs(b.x - o.x) < (b.w + o.w) / 2 + 2 &&
          Math.abs(b.y - o.y) < (b.h + o.h) / 2 + 2);
        if (collides) b.hidden = true;
        else kept.push(b);
      }
    } else {
      // Cross-layer coordination: avoid points and label boxes earlier
      // layers registered, and register our own for later text layers.
      const avoidAnchors = shared ? [...shared.repelAnchors, ...anchors] : anchors;
      repelLayout(boxes, avoidAnchors, innerWidth, innerHeight, shared?.repelPlaced ?? []);
      shared?.repelAnchors.push(...anchors);
      const dropped = boxes.filter(b => b.hidden).length;
      if (dropped > 0) {
        console.warn(`ggpbi: repel — ${dropped} unlabeled data points (no room). Enlarge the visual or filter the data.`);
      }
    }

    const out: Array<TextNode | LineNode> = [];
    for (const b of boxes) {
      if (b.hidden) continue;
      // Connector for labels that had to move away from their point.
      const dist = Math.hypot(b.x - b.ax, b.y - b.ay);
      if (dist > b.fontSize * 1.8) {
        const entry = boxEntryPoint(b);
        out.push({
          type: 'line',
          class: 'ggpbi-text-segment',
          x1: b.ax, y1: b.ay, x2: entry.x, y2: entry.y,
          style: { stroke: '#999999', strokeWidth: 0.5, opacity: 0.8 },
        });
      }
    }
    for (const b of boxes) {
      if (b.hidden) continue;
      const fill = (b.d.color !== undefined && colorScale)
        ? colorScale(String(b.d.color))
        : defaultColor;
      out.push({
        type: 'text',
        class: 'ggpbi-text',
        x: b.x,
        y: b.y,
        text: b.label,
        textAnchor: 'middle',
        dy: '0.35em',
        fontSize: b.fontSize,
        fontFamily,
        style: { fill },
        aria: { role: 'listitem', tabindex: '0', label: b.label },
        data: b.d,
      });
    }
    return out;
  }

  const nodes: TextNode[] = [];

  for (const d of textPoints) {
    if (hasExplicitLabel && (d.label == null || d.label === '')) continue;

    const xPos = xScale(d.x) + xBandOffset;
    const yPos = yScale(d.y) + yBandOffset;

    // Inward justification (ggplot2 hjust/vjust = "inward"): edge labels
    // extend toward the panel centre, so text never leaves the panel.
    const textAnchor = config.hjust === 'inward'
      ? (xPos < innerWidth / 2 ? 'start' : 'end')
      : configAnchor;
    const dy = config.vjust === 'inward'
      ? (yPos < innerHeight / 2 ? '1.1em' : '-0.5em')
      : configDy;

    if (config.checkOverlap) {
      const fontSize = d.size ?? defaultSize;
      const label = labelOf(d);
      const w = label.length * fontSize * 0.6;
      const x0 = textAnchor === 'start' ? xPos : textAnchor === 'end' ? xPos - w : xPos - w / 2;
      const cy = yPos + emOf(dy) * fontSize;
      const box = { x0, x1: x0 + w, y0: cy - fontSize * 0.8, y1: cy + fontSize * 0.2 };
      const pad = 1;
      const collides = occupied.some(o =>
        box.x0 - pad < o.x1 && box.x1 + pad > o.x0 &&
        box.y0 - pad < o.y1 && box.y1 + pad > o.y0);
      if (collides) continue; // like ggplot2: first label in data order wins
      occupied.push(box);
    }

    const fill = (d.color !== undefined && colorScale)
      ? colorScale(String(d.color))
      : defaultColor;

    const style: NodeStyle = { fill };

    const xVal = typeof d.x === 'number' ? d.x.toLocaleString() : String(d.x);
    const yVal = typeof d.y === 'number' ? d.y.toLocaleString() : String(d.y);

    const node: TextNode = {
      type: 'text',
      class: 'ggpbi-text',
      x: xPos,
      y: yPos,
      text: labelOf(d),
      textAnchor,
      dy,
      fontSize: d.size ?? defaultSize,
      fontFamily,
      style,
      aria: { role: 'listitem', tabindex: '0', label: `${xVal}: ${yVal}` },
      data: d,
    };

    if (angle !== 0) {
      node.transform = `rotate(${angle}, ${xPos}, ${yPos})`;
    }

    nodes.push(node);
  }

  return nodes;
}
