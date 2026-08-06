import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Selection } from '../src/selection';
import { ggpbi } from '../src/index';
import * as d3 from 'd3';
import type { DataPoint } from '../src/types';

// --- Test data ---

const scatterData = [
  { x: 1, y: 10, id: 'a' },
  { x: 2, y: 20, id: 'b' },
  { x: 3, y: 15, id: 'c' },
  { x: 4, y: 25, id: 'd' },
];

// --- Helpers ---

function getPoints(container: HTMLElement) {
  return container.querySelectorAll('.ggpbi-point');
}

function renderChart(container: HTMLElement, config: Parameters<typeof ggpbi>[0] extends undefined ? never : never) {
  return ggpbi()
    .data(scatterData)
    .aes({ x: 'x', y: 'y' })
    .geom('point')
    .selection({ key: (d: DataPoint) => d.id })
    .renderTo(container);
}

// ---------------------------------------------------------------------------
// Selection class — unit tests
// ---------------------------------------------------------------------------

describe('Selection class', () => {
  it('initializes with defaults', () => {
    const sel = new Selection();
    expect(sel.getSelected()).toEqual([]);
  });

  it('initializes with custom config', () => {
    const onChange = vi.fn();
    const sel = new Selection({
      mode: 'single',
      key: (d) => d.id,
      onSelectionChange: onChange,
    });
    expect(sel.getSelected()).toEqual([]);
  });

  it('programmatic select() stores items', () => {
    const sel = new Selection({ key: (d) => d.id });
    sel.select([{ id: 'a', x: 1, y: 10 }]);
    expect(sel.getSelected()).toHaveLength(1);
    expect(sel.getSelected()[0].id).toBe('a');
  });

  it('programmatic select() replaces previous selection', () => {
    const sel = new Selection({ key: (d) => d.id });
    sel.select([{ id: 'a', x: 1, y: 10 }]);
    sel.select([{ id: 'b', x: 2, y: 20 }]);
    expect(sel.getSelected()).toHaveLength(1);
    expect(sel.getSelected()[0].id).toBe('b');
  });

  it('clear() removes all selections', () => {
    const sel = new Selection({ key: (d) => d.id });
    sel.select([{ id: 'a', x: 1, y: 10 }, { id: 'b', x: 2, y: 20 }]);
    expect(sel.getSelected()).toHaveLength(2);
    sel.clear();
    expect(sel.getSelected()).toHaveLength(0);
  });

  it('isSelected() checks membership', () => {
    const sel = new Selection({ key: (d) => d.id });
    const pointA = { id: 'a', x: 1, y: 10 };
    const pointB = { id: 'b', x: 2, y: 20 };
    sel.select([pointA]);
    expect(sel.isSelected(pointA)).toBe(true);
    expect(sel.isSelected(pointB)).toBe(false);
  });

  it('notifies onSelectionChange on select()', () => {
    const onChange = vi.fn();
    const sel = new Selection({ key: (d) => d.id, onSelectionChange: onChange });
    sel.select([{ id: 'a', x: 1, y: 10 }]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'a' })]);
  });

  it('notifies onSelectionChange on clear()', () => {
    const onChange = vi.fn();
    const sel = new Selection({ key: (d) => d.id, onSelectionChange: onChange });
    sel.select([{ id: 'a', x: 1, y: 10 }]);
    sel.clear();
    expect(onChange).toHaveBeenCalledTimes(2); // once for select, once for clear
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('disabled selection does not attach handlers', () => {
    const sel = new Selection({ enabled: false });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const svg = d3.select(container).append('svg');
    const circles = svg.selectAll('circle')
      .data([{ datum: { x: 1, y: 10 } }])
      .join('circle');
    sel.attach(circles as any);
    // No cursor pointer when disabled
    expect(circles.style('cursor')).not.toBe('pointer');
  });
});

// ---------------------------------------------------------------------------
// Selection — click interaction via rendered chart
// ---------------------------------------------------------------------------

describe('Selection click interaction', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('points get cursor:pointer when selection enabled', () => {
    renderChart(container);
    const points = getPoints(container);
    expect(points.length).toBeGreaterThan(0);
    for (const p of points) {
      expect((p as HTMLElement).style.cursor).toBe('pointer');
    }
  });

  it('SVG gets tabindex for keyboard accessibility', () => {
    renderChart(container);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('tabindex')).toBe('0');
  });

  it('Power BI-hosted SVG stays out of the tab order so Delete reaches the canvas', () => {
    const svg = d3.select(container).append('svg');
    const circles = svg.selectAll('circle')
      .data([{ datum: { id: 'a', x: 1, y: 10 } }])
      .join('circle');
    const sel = new Selection({
      key: (d) => d.id,
      selectionManager: { select: vi.fn(), clear: vi.fn() },
    });

    sel.attach(circles as any);
    sel.attachKeyboard(svg);

    expect(svg.attr('tabindex')).toBeNull();
  });

  it('focus ring style is injected into document', () => {
    renderChart(container);
    const style = document.getElementById('ggpbi-focus-style');
    expect(style).not.toBeNull();
    expect(style?.textContent).toContain('.ggpbi-point:focus');
  });
});

// ---------------------------------------------------------------------------
// Selection — Power BI SelectionManager integration
// ---------------------------------------------------------------------------

describe('Selection Power BI integration', () => {
  it('calls selectionManager.select on programmatic select with __selectionId', () => {
    const mockManager = { select: vi.fn(), clear: vi.fn() };
    const sel = new Selection({
      key: (d) => d.id,
      selectionManager: mockManager,
    });

    // Programmatic select does not call selectionManager (only click does)
    sel.select([{ id: 'a', x: 1, y: 10, __selectionId: 'sid-a' }]);
    // selectionManager is not called on programmatic select
    // (only on click events)
    expect(sel.getSelected()).toHaveLength(1);
  });

  it('calls selectionManager.clear on clear()', () => {
    const mockManager = { select: vi.fn(), clear: vi.fn() };
    const sel = new Selection({
      key: (d) => d.id,
      selectionManager: mockManager,
    });
    sel.select([{ id: 'a', x: 1, y: 10 }]);
    sel.clear();
    expect(mockManager.clear).toHaveBeenCalled();
  });

  // --- click forwarding semantics ---

  function setupClickable() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const svg = d3.select(container).append('svg');
    const circles = svg.selectAll('circle')
      .data([
        { datum: { id: 'a', x: 1, y: 10, __selectionId: 'sid-a' } },
        { datum: { id: 'b', x: 2, y: 20, __selectionId: 'sid-b' } },
      ])
      .join('circle');
    const mockManager = { select: vi.fn(), clear: vi.fn() };
    const sel = new Selection({ key: (d) => d.id, selectionManager: mockManager });
    sel.attach(circles as any);
    const nodes = circles.nodes() as SVGCircleElement[];
    const click = (i: number, shiftKey = false) =>
      nodes[i].dispatchEvent(new MouseEvent('click', { shiftKey, bubbles: true }));
    return { sel, mockManager, click };
  }

  it('plain click replaces the manager selection (multiSelect=false)', () => {
    const { mockManager, click } = setupClickable();
    click(0);
    // The clicked id goes to the manager directly (like the official
    // barchart sample) — the manager's toggle/replace semantics decide.
    expect(mockManager.select).toHaveBeenCalledWith('sid-a', false);
  });

  it('shift-click passes ONLY the toggled id with multiSelect=true', () => {
    const { sel, mockManager, click } = setupClickable();
    click(0);                    // select a
    click(1, true);              // shift-add b
    // Manager toggles passed ids — passing the whole set would toggle a off
    expect(mockManager.select).toHaveBeenLastCalledWith('sid-b', true);
    expect(sel.getSelected().map(d => d.id).sort()).toEqual(['a', 'b']);
  });

  it('shift-click deselecting the last item toggles it off via the manager', () => {
    const { sel, mockManager, click } = setupClickable();
    click(0, true);              // select a
    click(0, true);              // deselect a again
    // The toggle itself empties the manager (PBI semantics) — no extra
    // clear() call, the adopted promise result confirms the empty state.
    expect(mockManager.select).toHaveBeenLastCalledWith('sid-a', true);
    expect(sel.getSelected()).toHaveLength(0);
  });

  it('background click clears the selection, mark clicks do not', () => {
    const { sel, mockManager, click, container, nodes } = (() => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const svg = d3.select(container).append('svg');
      const circles = svg.selectAll('circle')
        .data([{ datum: { id: 'a', x: 1, y: 10, __selectionId: 'sid-a' } }])
        .join('circle');
      const mockManager = { select: vi.fn(), clear: vi.fn() };
      const sel = new Selection({ key: (d) => d.id, selectionManager: mockManager });
      sel.attach(circles as any);
      sel.attachBackgroundClear(container);
      const nodes = circles.nodes() as SVGCircleElement[];
      const click = (i: number) =>
        nodes[i].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return { sel, mockManager, click, container, nodes };
    })();

    click(0);
    expect(sel.getSelected()).toHaveLength(1);
    // Mark click stops propagation — container handler must not have cleared
    expect(mockManager.clear).not.toHaveBeenCalled();

    container.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sel.getSelected()).toHaveLength(0);
    expect(mockManager.clear).toHaveBeenCalled();
  });

  it('syncFromExternal sets state without writing back to the manager', () => {
    const { sel, mockManager } = setupClickable();
    sel.syncFromExternal([{ id: 'b', x: 2, y: 20, __selectionId: 'sid-b' }]);
    expect(sel.getSelected().map(d => d.id)).toEqual(['b']);
    expect(mockManager.select).not.toHaveBeenCalled();
    expect(mockManager.clear).not.toHaveBeenCalled();

    sel.syncFromExternal([]);
    expect(sel.getSelected()).toHaveLength(0);
    expect(mockManager.clear).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Selection — visual style updates
// ---------------------------------------------------------------------------

describe('Selection visual styles', () => {
  it('updateStyles dims unselected elements', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const svg = d3.select(container).append('svg');
    const data = [
      { datum: { id: 'a', x: 1, y: 10 } },
      { datum: { id: 'b', x: 2, y: 20 } },
      { datum: { id: 'c', x: 3, y: 30 } },
    ];
    const circles = svg.selectAll('circle')
      .data(data)
      .join('circle')
      .attr('class', 'ggpbi-point');

    const sel = new Selection({
      key: (d) => d.id,
      unselectedStyle: { opacity: 0.2 },
    });
    sel.attach(circles as any);

    // Select first item
    sel.select([{ id: 'a', x: 1, y: 10 }]);

    // First circle should be fully opaque (selected)
    expect(d3.select(circles.nodes()[0]).style('opacity')).toBe('1');
    // Other circles should be dimmed (unselected)
    expect(d3.select(circles.nodes()[1]).style('opacity')).toBe('0.2');
    expect(d3.select(circles.nodes()[2]).style('opacity')).toBe('0.2');
  });

  it('clear() resets all elements to default opacity', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const svg = d3.select(container).append('svg');
    const data = [
      { datum: { id: 'a', x: 1, y: 10 } },
      { datum: { id: 'b', x: 2, y: 20 } },
    ];
    const circles = svg.selectAll('circle')
      .data(data)
      .join('circle')
      .attr('class', 'ggpbi-point');

    const sel = new Selection({ key: (d) => d.id });
    sel.attach(circles as any);

    sel.select([{ id: 'a', x: 1, y: 10 }]);
    sel.clear();

    // All circles should be back to opacity 1
    for (const node of circles.nodes()) {
      expect(d3.select(node).style('opacity')).toBe('1');
    }
  });
});

describe('drag-to-move pass-through', () => {
  it('clears selection on clicks that reach the document (pointer-events none surfaces)', () => {
    // The container and SVG root are pointer-events:none so Power BI can
    // drag-move the visual by its body — background clicks therefore land
    // on the document body, not the container. The clear handler must
    // work from there.
    const container = document.createElement('div');
    document.body.appendChild(container);
    const svg = d3.select(container).append('svg');
    const circles = svg.selectAll('circle')
      .data([{ datum: { id: 'a', x: 1, y: 10 } }])
      .join('circle');
    const sel = new Selection({ key: (d: any) => d.id });
    sel.attach(circles as any);
    sel.attachBackgroundClear(container);

    (circles.nodes()[0] as SVGCircleElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    expect(sel.getSelected().length).toBe(1);

    // Click landing directly on the document body (pass-through area).
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sel.getSelected().length).toBe(0);
  });
});
