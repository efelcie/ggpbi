/**
 * Tooltip system for ggpbi
 * Handles tooltip rendering and mouse event coordination
 */

import * as d3 from 'd3';
import type { DataPoint, TooltipConfig, AesMapping } from './types';
import type { BoundPoint } from './bind-data';

/**
 * Create and manage a tooltip element
 */
export class Tooltip {
  private element: HTMLDivElement;
  private config: TooltipConfig;
  private aes: AesMapping;

  constructor(container: HTMLElement, config: TooltipConfig = {}, aes: AesMapping = {}) {
    this.config = { enabled: true, ...config };
    this.aes = aes;

    // Create tooltip element
    this.element = document.createElement('div');
    this.element.className = 'ggpbi-tooltip';
    this.element.style.cssText = `
      position: absolute;
      display: none;
      padding: 8px 12px;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      border-radius: 4px;
      font-size: 12px;
      font-family: system-ui, -apple-system, sans-serif;
      pointer-events: none;
      z-index: 1000;
      max-width: 300px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    `;
    
    container.appendChild(this.element);
  }

  /** The tooltip DOM element (for external positioning). */
  getElement(): HTMLDivElement {
    return this.element;
  }

  /** The tooltip's parent container. */
  getContainer(): HTMLElement {
    return this.element.parentElement ?? document.body;
  }

  /**
   * Show tooltip with data point info
   */
  show(point: DataPoint, x: number, y: number): void {
    if (!this.config.enabled) return;

    this.element.replaceChildren();
    this.renderContent(point);
    this.element.style.display = 'block';
    
    // Position tooltip (offset to avoid cursor)
    this.element.style.left = `${x + 12}px`;
    this.element.style.top = `${y - 12}px`;
  }

  /**
   * Hide tooltip
   */
  hide(): void {
    this.element.style.display = 'none';
  }

  /**
   * Render tooltip content safely (no innerHTML)
   */
  private renderContent(point: DataPoint): void {
    if (this.config.format) {
      // Treat custom formatter output as plain text to avoid HTML injection
      this.element.textContent = this.config.format(point);
      return;
    }

    // Default formatter: show mapped fields
    const fields = this.config.fields || Object.keys(this.aes).filter((k) => this.aes[k as keyof AesMapping]);
    const presentFields = fields.filter((field) => point[field] !== undefined);

    if (presentFields.length === 0) {
      const noData = document.createElement('div');
      noData.textContent = 'No data';
      this.element.appendChild(noData);
      return;
    }

    for (const field of presentFields) {
      const value = point[field];
      const formatted = typeof value === 'number' ? value.toLocaleString() : String(value);
      const row = document.createElement('div');
      const label = document.createElement('strong');
      label.textContent = `${field}: `;
      row.appendChild(label);
      row.appendChild(document.createTextNode(formatted));
      this.element.appendChild(row);
    }
  }

  /**
   * Remove tooltip from DOM
   */
  destroy(): void {
    this.element.remove();
  }
}

/**
 * Attach tooltip event handlers to a selection of elements (DOM overlay)
 */
export function attachTooltip(
  selection: d3.Selection<any, any, any, any>,
  _dataPoints: DataPoint[],
  tooltip: Tooltip
): void {
  selection
    .on('mouseover', function (event: MouseEvent, d: BoundPoint | DataPoint) {
      const point = 'datum' in d ? (d as BoundPoint).datum : d;
      const [x, y] = d3.pointer(event, tooltip.getContainer());
      tooltip.show(point, x, y);
    })
    .on('mousemove', function (event: MouseEvent) {
      const [x, y] = d3.pointer(event, tooltip.getContainer());
      const el = tooltip.getElement();
      el.style.left = `${x + 12}px`;
      el.style.top = `${y - 12}px`;
    })
    .on('mouseout', function () {
      tooltip.hide();
    });
}

/**
 * Attach Power BI native tooltip handlers to a selection of elements.
 * Uses host.tooltipService.show/move/hide instead of DOM overlay.
 */
export function attachPbiTooltip(
  selection: d3.Selection<any, any, any, any>,
  tooltipService: any,
  aes: AesMapping
): void {
  selection
    .on('mouseover', function (event: MouseEvent, d: BoundPoint | DataPoint) {
      const point = 'datum' in d ? (d as BoundPoint).datum : d;
      const [x, y] = d3.pointer(event, (event.currentTarget as Element).closest('svg')!);
      const dataItems = buildPbiTooltipItems(point, aes);
      tooltipService.show({
        dataItems,
        coordinates: [x, y],
        identities: point.__selectionId ? [point.__selectionId] : [],
        isTouchEvent: false,
      });
    })
    .on('mousemove', function (event: MouseEvent, d: BoundPoint | DataPoint) {
      const point = 'datum' in d ? (d as BoundPoint).datum : d;
      const [x, y] = d3.pointer(event, (event.currentTarget as Element).closest('svg')!);
      const dataItems = buildPbiTooltipItems(point, aes);
      tooltipService.move({
        dataItems,
        coordinates: [x, y],
        identities: point.__selectionId ? [point.__selectionId] : [],
        isTouchEvent: false,
      });
    })
    .on('mouseout', function () {
      tooltipService.hide({ isTouchEvent: false, immediately: false });
    });
}

/**
 * Convert a DataPoint to Power BI VisualTooltipDataItem[].
 */
function buildPbiTooltipItems(
  point: DataPoint,
  aes: AesMapping
): Array<{ displayName: string; value: string }> {
  const fields = Object.keys(aes).filter(
    (k) => aes[k as keyof AesMapping] && point[aes[k as keyof AesMapping]!] !== undefined
  );
  return fields.map((field) => {
    const dataField = aes[field as keyof AesMapping]!;
    const value = point[dataField];
    return {
      displayName: dataField,
      value: typeof value === 'number' ? value.toLocaleString() : String(value),
    };
  });
}
