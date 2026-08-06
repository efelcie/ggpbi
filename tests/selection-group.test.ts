import { describe, it, expect, vi } from 'vitest';
import { ggpbi } from '../src/index';

/**
 * Mock of Power BI's SelectionManager with REAL toggle semantics:
 * select(id, false) on the already-current selection toggles it off and
 * resolves with the resulting id set — exactly the behaviour that used
 * to desync the visual highlight from the report cross-filter.
 */
function mockManager(initial: string[] = []) {
  let current = [...initial];
  const manager = {
    select: vi.fn((ids: string | string[], multi: boolean) => {
      const arr = Array.isArray(ids) ? ids : [ids];
      if (multi) {
        for (const id of arr) {
          const i = current.indexOf(id);
          if (i >= 0) current.splice(i, 1);
          else current.push(id);
        }
      } else if (arr.length === current.length && arr.every((id) => current.includes(id))) {
        current = [];
      } else {
        current = [...arr];
      }
      return Promise.resolve([...current]);
    }),
    clear: vi.fn(() => {
      current = [];
      return Promise.resolve();
    }),
    get state() {
      return current;
    },
  };
  return manager;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function renderChart(manager: ReturnType<typeof mockManager>, withColor = false) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const data = [
    { cat: 'A', val: 3, grp: 'g1', __selectionId: 'sid-0' },
    { cat: 'B', val: 5, grp: 'g1', __selectionId: 'sid-1' },
    { cat: 'C', val: 7, grp: 'g2', __selectionId: 'sid-2' },
    { cat: 'D', val: 9, grp: 'g2', __selectionId: 'sid-3' },
  ];
  const b = ggpbi()
    .data(data as any)
    .aes(withColor ? { x: 'cat', y: 'val', color: 'grp' } : { x: 'cat', y: 'val' })
    .geom('point', { size: 6 })
    .size(500, 350)
    .selection({ selectionManager: manager });
  const svg = b.renderTo(container);
  return { svg, data };
}

const click = (el: Element, shift = false) =>
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: shift }));

describe('selection toggle stability (manager-authoritative)', () => {
  it('click, re-click: point deselects and the manager is cleared', async () => {
    const manager = mockManager();
    const { svg } = renderChart(manager);
    const mark = svg.querySelector('.ggpbi-point')!;

    click(mark);
    await flush();
    expect(manager.state).toEqual(['sid-0']);
    expect((mark as SVGElement).style.opacity).toBe('1');

    click(mark);
    await flush();
    expect(manager.clear).toHaveBeenCalled();
    expect(manager.state).toEqual([]);
    // No stuck dimming: every mark back at full opacity.
    for (const m of svg.querySelectorAll('.ggpbi-point')) {
      expect((m as SVGElement).style.opacity).toBe('1');
    }
  });

  it('recovers when local state and manager diverge (the stuck-geom bug)', async () => {
    // Manager already holds sid-0 (e.g. restore failed) while the visual
    // shows nothing selected. Clicking the point calls select(sid-0, false),
    // which PBI toggles OFF → resolves []. Adoption must follow the manager
    // instead of leaving the point highlighted forever.
    const manager = mockManager(['sid-0']);
    const { svg } = renderChart(manager);
    const mark = svg.querySelector('.ggpbi-point')!;

    click(mark);
    await flush();
    expect(manager.state).toEqual([]);
    for (const m of svg.querySelectorAll('.ggpbi-point')) {
      expect((m as SVGElement).style.opacity).toBe('1');
    }
  });
});

describe('clickable legend entries', () => {
  it('legend click selects the whole colour group; re-click stably clears', async () => {
    const manager = mockManager();
    const { svg } = renderChart(manager, true);
    const entry = Array.from(svg.querySelectorAll('.ggpbi-legend-entry'))
      .find((e) => e.getAttribute('data-label') === 'g1')!;
    expect(entry).toBeTruthy();

    click(entry);
    await flush();
    expect(manager.state.sort()).toEqual(['sid-0', 'sid-1']);

    click(entry);
    await flush();
    expect(manager.state).toEqual([]);
    for (const m of svg.querySelectorAll('.ggpbi-point')) {
      expect((m as SVGElement).style.opacity).toBe('1');
    }
  });

  it('shift-click adds a second group to the selection', async () => {
    const manager = mockManager();
    const { svg } = renderChart(manager, true);
    const entries = Array.from(svg.querySelectorAll('.ggpbi-legend-entry'));

    click(entries[0]);
    await flush();
    click(entries[1], true);
    await flush();
    expect(manager.state.sort()).toEqual(['sid-0', 'sid-1', 'sid-2', 'sid-3']);
  });
});

describe('clickable categorical axis labels', () => {
  it('axis label click toggles the category rows', async () => {
    const manager = mockManager();
    const { svg } = renderChart(manager);
    const label = Array.from(svg.querySelectorAll('.ggpbi-axis-x .tick text'))
      .find((t) => (t.textContent ?? '').trim() === 'B')!;
    expect(label).toBeTruthy();

    click(label);
    await flush();
    expect(manager.state).toEqual(['sid-1']);

    click(label);
    await flush();
    expect(manager.state).toEqual([]);
  });

  it('numeric axis labels are not clickable', () => {
    const manager = mockManager();
    const { svg } = renderChart(manager);
    const yLabels = Array.from(svg.querySelectorAll('.ggpbi-axis-y .tick text'));
    expect(yLabels.length).toBeGreaterThan(0);
    for (const l of yLabels) {
      expect((l as SVGElement).style.cursor).not.toBe('pointer');
    }
    click(yLabels[0]);
    expect(manager.select).not.toHaveBeenCalled();
  });
});
