/**
 * Right-click → Power BI's data-point context menu.
 *
 * Every native visual offers Drill through / Include / Exclude / Show as
 * a table there; a custom visual that swallows the right click reads as
 * broken rather than incomplete.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as d3 from 'd3';
import { Selection } from '../src/selection';
import { ggpbi } from '../src/index';

function fakeManager() {
  return {
    showContextMenu: vi.fn(),
    select: vi.fn().mockResolvedValue([]),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

function rightClick(el: Element, x = 120, y = 80): MouseEvent {
  const event = new MouseEvent('contextmenu', {
    bubbles: true, cancelable: true, clientX: x, clientY: y,
  });
  el.dispatchEvent(event);
  return event;
}

describe('context menu', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('opens the host menu for the clicked point, with its selection id', () => {
    const manager = fakeManager();
    const sel = new Selection({ selectionManager: manager, key: (d: any) => String(d.id) } as any);
    const svg = d3.select(document.body).append('svg');
    const id = { fake: 'selection-id' };
    const circle = svg.append('circle').datum({ datum: { id: 1, __selectionId: id } });
    sel.attach(circle as any);

    rightClick(circle.node()!, 300, 200);

    expect(manager.showContextMenu).toHaveBeenCalledTimes(1);
    expect(manager.showContextMenu.mock.calls[0][0]).toBe(id);
    expect(manager.showContextMenu.mock.calls[0][1]).toEqual({ x: 300, y: 200 });
  });

  it('suppresses the browser menu so only the host one shows', () => {
    const manager = fakeManager();
    const sel = new Selection({ selectionManager: manager, key: (d: any) => String(d.id) } as any);
    const svg = d3.select(document.body).append('svg');
    const circle = svg.append('circle').datum({ datum: { id: 1, __selectionId: {} } });
    sel.attach(circle as any);

    const event = rightClick(circle.node()!);
    expect(event.defaultPrevented).toBe(true);
  });

  it('right-clicking empty plot area opens the menu for the visual', () => {
    const manager = fakeManager();
    const sel = new Selection({ selectionManager: manager, key: (d: any) => String(d.id) } as any);
    const svg = d3.select(document.body).append('svg');
    sel.attachBackgroundContextMenu(svg as any);

    rightClick(svg.node()!, 40, 40);

    expect(manager.showContextMenu).toHaveBeenCalledTimes(1);
    // No data point under the cursor → an empty identity, not undefined.
    expect(manager.showContextMenu.mock.calls[0][0]).toEqual({});
  });

  it('does not select the point that was right-clicked', () => {
    const manager = fakeManager();
    const sel = new Selection({ selectionManager: manager, key: (d: any) => String(d.id) } as any);
    const svg = d3.select(document.body).append('svg');
    const circle = svg.append('circle').datum({ datum: { id: 1, __selectionId: {} } });
    sel.attach(circle as any);

    rightClick(circle.node()!);

    expect(manager.select).not.toHaveBeenCalled();
    expect(sel.getSelected()).toEqual([]);
  });

  it('stays inert in the browser, where there is no host to ask', () => {
    const sel = new Selection({ key: (d: any) => String(d.id) } as any);
    const svg = d3.select(document.body).append('svg');
    const circle = svg.append('circle').datum({ datum: { id: 1 } });
    sel.attach(circle as any);

    // No manager: the browser's own menu must still work, so the event
    // may not be cancelled.
    const event = rightClick(circle.node()!);
    expect(event.defaultPrevented).toBe(false);
  });

  it('a rendered plot wires marks and background without throwing', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientWidth', { value: 600 });
    Object.defineProperty(el, 'clientHeight', { value: 400 });
    document.body.appendChild(el);
    const svg = ggpbi()
      .data([{ x: 1, y: 2 }, { x: 2, y: 4 }])
      .aes({ x: 'x', y: 'y' })
      .geom('point')
      .size(600, 400)
      .renderTo(el);
    expect(() => rightClick(svg.querySelector('.ggpbi-point')!)).not.toThrow();
    expect(() => rightClick(svg)).not.toThrow();
  });
});
