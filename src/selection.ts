/**
 * Selection system for interactive data filtering
 * Handles click/multi-select interactions and visual feedback
 */

import * as d3 from 'd3';


import type { DataPoint, SelectionConfig } from './types';

export class Selection {
  private selectedKeys: Set<any> = new Set();
  private keyToDatum: Map<any, DataPoint> = new Map();
  private config: Required<Omit<SelectionConfig, 'key' | 'selectionManager'>> & {
    key: (datum: DataPoint) => any;
  };
  private selectionManager: any;
  private onSelectionChange: (selected: DataPoint[]) => void;
  private attachedSelection?: d3.Selection<d3.BaseType, any, any, any>;

  constructor(config: SelectionConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      mode: config.mode ?? 'multi',
      key: config.key ?? ((d) => d),
      onSelectionChange: config.onSelectionChange ?? (() => {}),
      selectedStyle: {
        strokeWidth: 2,
        stroke: '#ff6b00',
        opacity: 1,
        ...config.selectedStyle,
      },
      unselectedStyle: {
        opacity: 0.3,
        ...config.unselectedStyle,
      },
    };
    this.selectionManager = config.selectionManager;
    this.onSelectionChange = this.config.onSelectionChange;
  }

  /**
   * Attach selection handlers to a D3 selection
   */
  attach(
    selection: d3.Selection<d3.BaseType, any, any, any>
  ): void {
    if (!this.config.enabled) return;

    this.attachedSelection = selection;

    // Inject focus-ring style once per document
    this.injectFocusStyle(selection);

    selection
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d: any) => {
        event.stopPropagation();

        const key = this.config.key(d.datum);
        this.keyToDatum.set(key, d.datum);

        // Multi-select with shift key
        const isMulti = this.config.mode === 'multi' && event.shiftKey;

        if (isMulti) {
          if (this.selectedKeys.has(key)) {
            this.selectedKeys.delete(key);
          } else {
            this.selectedKeys.add(key);
          }
        } else {
          // Single select: clear others
          if (this.selectedKeys.has(key) && this.selectedKeys.size === 1) {
            // Toggle off if clicking already-selected single item
            this.selectedKeys.clear();
          } else {
            this.selectedKeys.clear();
            this.selectedKeys.add(key);
          }
        }

        // Power BI cross-filtering: forward selection to SelectionManager.
        // With multiSelect=true the manager TOGGLES the passed ids against
        // its current selection, so pass only the clicked id.
        //
        // The manager's PROMISE RESULT is authoritative: PBI applies its own
        // toggle semantics and may resolve to a different set than our local
        // optimistic update (e.g. select() on an already-selected id toggles
        // it off). Adopting the resolved ids keeps the visual highlight and
        // the report cross-filter in lockstep — without it, one stale
        // divergence makes a point impossible to deselect and leaves the
        // whole geom stuck in the dimmed state.
        if (this.selectionManager) {
          const clickedId = (d.datum as any)?.__selectionId;
          if (isMulti) {
            if (clickedId) this.adoptAfter(this.selectionManager.select(clickedId, true));
            else if (this.selectedKeys.size === 0) this.adoptAfter(this.selectionManager.clear(), []);
          } else if (this.selectedKeys.size === 0) {
            // Local toggle-off of the last selected point → explicit clear.
            this.adoptAfter(this.selectionManager.clear(), []);
          } else if (clickedId) {
            this.adoptAfter(this.selectionManager.select(clickedId, false));
          }
        }

        this.updateStyles(selection);
        this.notifyChange();
      })
      .on('contextmenu', (event: MouseEvent, d: any) => {
        this.openContextMenu(event, (d?.datum as any)?.__selectionId);
      });
  }

  /**
   * Right-click → Power BI's own data-point menu (Drill through, Include /
   * Exclude, Show as a table). Every native visual offers it, so its
   * absence reads as a broken visual rather than a missing feature.
   *
   * The host renders and positions the menu; the visual only reports where
   * the click landed and which point it hit. Passing no selection id opens
   * the menu for the visual as a whole, which is what a click on empty
   * plot area means.
   */
  openContextMenu(event: MouseEvent, selectionId?: unknown): void {
    if (!this.selectionManager?.showContextMenu) return;
    // Without this the browser's own menu appears on top of Power BI's.
    event.preventDefault();
    event.stopPropagation();
    this.selectionManager.showContextMenu(selectionId ?? {}, {
      x: event.clientX,
      y: event.clientY,
    });
  }

  /**
   * Attach the context menu to the plot background, so right-clicking
   * empty space still reaches the host menu.
   */
  attachBackgroundContextMenu(
    target: d3.Selection<any, unknown, null, undefined>,
  ): void {
    if (!this.selectionManager?.showContextMenu) return;
    target.on('contextmenu', (event: MouseEvent) => this.openContextMenu(event));
  }

  /**
   * Adopt the SelectionManager's resolved state once a select()/clear()
   * promise settles. `fallback` is used when the manager resolves without
   * an id array (clear() resolves void).
   */
  private adoptAfter(managerResult: unknown, fallback?: any[]): void {
    Promise.resolve(managerResult)
      .then((ids) => {
        const resolved = Array.isArray(ids) ? ids : fallback;
        if (resolved) this.adoptManagerState(resolved);
      })
      .catch(() => { /* manager rejected — keep the optimistic local state */ });
  }

  /** Stable comparison key for Power BI ISelectionIds. */
  private managerIdKey(id: any): unknown {
    if (typeof id?.getKey === 'function') return id.getKey();
    try { return JSON.stringify(id); } catch { return id; }
  }

  /**
   * Sync local highlight state to a set of Power BI selection ids —
   * the manager's answer after select()/clear(), or a restored selection.
   * Matches ids against the data bound to the attached marks.
   */
  adoptManagerState(ids: any[]): void {
    const keys = new Set(ids.map((id) => this.managerIdKey(id)));
    const selected: DataPoint[] = [];
    this.attachedSelection?.each((d: any) => {
      const sid = d?.datum?.__selectionId;
      if (sid != null && keys.has(this.managerIdKey(sid))) selected.push(d.datum);
    });
    this.syncFromExternal(selected);
  }

  /**
   * Toggle selection of a whole group of rows — a legend entry or a
   * categorical axis label was clicked.
   *
   * Plain click: the group becomes the selection; clicking the same group
   * again clears it (re-click is always a stable off-switch). Shift-click
   * adds/removes the group from the current selection. Manager results
   * are adopted as authoritative, like single-mark clicks.
   */
  toggleValueGroup(rows: DataPoint[], additive = false): void {
    if (!this.config.enabled || rows.length === 0) return;

    const keys = rows.map((d) => this.config.key(d));
    rows.forEach((d, i) => this.keyToDatum.set(keys[i], d));
    const allSelected = keys.every((k) => this.selectedKeys.has(k));
    const isExactlyCurrent = allSelected && this.selectedKeys.size === keys.length;

    if (additive) {
      if (allSelected) keys.forEach((k) => this.selectedKeys.delete(k));
      else keys.forEach((k) => this.selectedKeys.add(k));
    } else if (isExactlyCurrent) {
      this.selectedKeys.clear();
    } else {
      this.selectedKeys = new Set(keys);
    }

    if (this.selectionManager) {
      const ids = rows.map((d) => (d as any).__selectionId).filter((id) => id != null);
      if (this.selectedKeys.size === 0) {
        this.adoptAfter(this.selectionManager.clear(), []);
      } else if (ids.length > 0) {
        this.adoptAfter(this.selectionManager.select(ids, additive));
      }
    }

    if (this.attachedSelection) this.updateStyles(this.attachedSelection);
    this.notifyChange();
  }

  /**
   * Update visual styles based on selection state
   */
  private updateStyles(
    selection: d3.Selection<d3.BaseType, any, any, any>
  ): void {
    const hasSelection = this.selectedKeys.size > 0;

    selection.each((d, i, nodes) => {
      const elem = d3.select(nodes[i]);
      const key = this.config.key(d.datum);
      this.keyToDatum.set(key, d.datum);

      const isSelected = this.selectedKeys.has(key);

      if (hasSelection) {
        if (isSelected) {
          // Apply selected styles
          elem
            .style('opacity', this.config.selectedStyle.opacity ?? 1)
            .attr('stroke', this.config.selectedStyle.stroke ?? 'none')
            .attr('stroke-width', this.config.selectedStyle.strokeWidth ?? 0);
        } else {
          // Apply unselected styles
          elem
            .style('opacity', this.config.unselectedStyle.opacity ?? 1)
            .attr('stroke', 'none')
            .attr('stroke-width', 0);
        }
      } else {
        // No selection: reset to defaults
        elem
          .style('opacity', 1)
          .attr('stroke', 'none')
          .attr('stroke-width', 0);
      }
    });
  }

  /**
   * Programmatically select items
   */
  select(data: DataPoint[]): void {
    this.selectedKeys = new Set(data.map((d) => this.config.key(d)));
    for (const d of data) {
      this.keyToDatum.set(this.config.key(d), d);
    }

    if (this.attachedSelection) {
      this.updateStyles(this.attachedSelection);
    }
    this.notifyChange();
  }

  /**
   * Clear the selection when the chart background is clicked.
   *
   * Listens at the document level: the container and SVG root are
   * pointer-events: none (so Power BI can drag-move the visual by its
   * body), which means background clicks never target the container —
   * they land on the document body. Mark clicks call stopPropagation,
   * so any click that reaches the document is a background click.
   * No-op while nothing is selected.
   */
  attachBackgroundClear(container: Element): void {
    if (!this.config.enabled) return;
    const doc = container.ownerDocument ?? document;
    d3.select(doc).on('click.ggpbi-clear', () => {
      if (this.selectedKeys.size > 0) this.clear();
    });
  }

  /**
   * Sync local state from an external source (Power BI SelectionManager
   * after a re-render, bookmarks via registerOnSelectCallback).
   *
   * Sets keys and styles WITHOUT writing back to the SelectionManager —
   * the manager is the source of this state, echoing it back would loop.
   */
  syncFromExternal(selected: DataPoint[]): void {
    this.selectedKeys = new Set(selected.map((d) => this.config.key(d)));
    for (const d of selected) {
      this.keyToDatum.set(this.config.key(d), d);
    }
    if (this.attachedSelection) {
      this.updateStyles(this.attachedSelection);
    }
    this.notifyChange();
  }

  /**
   * Clear all selections
   */
  clear(): void {
    this.selectedKeys.clear();
    if (this.selectionManager) {
      this.selectionManager.clear();
    }
    if (this.attachedSelection) {
      this.updateStyles(this.attachedSelection);
    }
    this.notifyChange();
  }

  /**
   * Get currently selected data
   */
  getSelected(): DataPoint[] {
    const out: DataPoint[] = [];
    for (const k of this.selectedKeys) {
      const d = this.keyToDatum.get(k);
      if (d) out.push(d);
    }
    return out;
  }

  /**
   * Check if a datum is selected
   */
  isSelected(datum: DataPoint): boolean {
    return this.selectedKeys.has(this.config.key(datum));
  }

  /**
   * Collect Power BI SelectionIds for currently selected data points.
   */
  private getSelectedSelectionIds(): any[] {
    const ids: any[] = [];
    for (const k of this.selectedKeys) {
      const d = this.keyToDatum.get(k);
      if (d?.__selectionId) ids.push(d.__selectionId);
    }
    return ids;
  }

  /**
   * Attach keyboard navigation to the SVG container.
   * ArrowRight/ArrowLeft move focus, Enter/Space select, Escape clears.
   */
  attachKeyboard(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>
  ): void {
    if (!this.config.enabled || !this.attachedSelection) return;

    // A focusable element inside a Power BI custom visual iframe captures
    // Delete, preventing the report canvas from deleting the selected visual.
    // Power BI owns keyboard interaction at the visual-container level.
    if (this.selectionManager) return;

    // Make SVG focusable so it can receive keyboard events
    svg.attr('tabindex', '0')
      .style('outline', 'none');

    svg.on('keydown', (event: KeyboardEvent) => {
      const nodes = this.attachedSelection?.nodes() ?? [];
      if (nodes.length === 0) return;

      const active = document.activeElement;
      const idx = nodes.indexOf(active as any);

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown': {
          event.preventDefault();
          const next = idx < nodes.length - 1 ? idx + 1 : 0;
          (nodes[next] as HTMLElement)?.focus();
          break;
        }
        case 'ArrowLeft':
        case 'ArrowUp': {
          event.preventDefault();
          const prev = idx > 0 ? idx - 1 : nodes.length - 1;
          (nodes[prev] as HTMLElement)?.focus();
          break;
        }
        case 'Enter':
        case ' ': {
          event.preventDefault();
          if (idx >= 0) {
            const d = d3.select(nodes[idx]).datum() as any;
            if (d?.datum) {
              const key = this.config.key(d.datum);
              this.keyToDatum.set(key, d.datum);
              if (this.selectedKeys.has(key)) {
                this.selectedKeys.delete(key);
              } else {
                this.selectedKeys.add(key);
              }
              if (this.selectionManager) {
                // Toggle semantics: pass only the affected id (see attach());
                // adopt the manager's resolved state as authoritative.
                const toggledId = (d.datum as any)?.__selectionId;
                if (toggledId) this.adoptAfter(this.selectionManager.select(toggledId, true));
                if (this.selectedKeys.size === 0) this.adoptAfter(this.selectionManager.clear(), []);
              }
              this.updateStyles(this.attachedSelection!);
              this.notifyChange();
            }
          }
          break;
        }
        case 'Escape': {
          event.preventDefault();
          this.clear();
          (svg.node() as unknown as HTMLElement)?.focus();
          break;
        }
      }
    });
  }

  /** Inject CSS for keyboard focus ring (once per document). */
  private injectFocusStyle(
    selection: d3.Selection<d3.BaseType, any, any, any>
  ): void {
    const node = selection.node();
    if (!node) return;
    const doc = (node as Element).ownerDocument;
    if (!doc || doc.getElementById('ggpbi-focus-style')) return;
    const style = doc.createElement('style');
    style.id = 'ggpbi-focus-style';
    style.textContent = `
      .ggpbi-point:focus, .ggpbi-bar:focus, .ggpbi-text:focus {
        outline: 2px solid #118DFF;
        outline-offset: 2px;
      }
    `;
    doc.head.appendChild(style);
  }

  private notifyChange(): void {
    this.onSelectionChange(this.getSelected());
  }
}
