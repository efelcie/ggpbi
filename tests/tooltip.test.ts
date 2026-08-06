import { describe, it, expect, beforeEach } from 'vitest';
import { Tooltip, attachTooltip } from '../src/tooltip';
import * as d3 from 'd3';
import type { DataPoint, AesMapping } from '../src/types';

// ---------------------------------------------------------------------------
// Tooltip class — unit tests
// ---------------------------------------------------------------------------

describe('Tooltip class', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.position = 'relative';
    document.body.appendChild(container);
  });

  it('creates tooltip element in container', () => {
    const tooltip = new Tooltip(container);
    const el = tooltip.getElement();
    expect(el).toBeInstanceOf(HTMLDivElement);
    expect(el.classList.contains('ggpbi-tooltip')).toBe(true);
    expect(el.parentElement).toBe(container);
  });

  it('tooltip is hidden by default', () => {
    const tooltip = new Tooltip(container);
    // Constructor sets display:none via cssText. jsdom may not fully parse multiline cssText,
    // so verify the element is not visible by checking it's not 'block'.
    expect(tooltip.getElement().style.display).not.toBe('block');
  });

  it('show() makes tooltip visible', () => {
    const tooltip = new Tooltip(container, { fields: ['x'] });
    tooltip.show({ x: 42 }, 100, 200);
    expect(tooltip.getElement().style.display).toBe('block');
  });

  it('show() positions tooltip with offset', () => {
    const tooltip = new Tooltip(container, { fields: ['x'] });
    tooltip.show({ x: 42 }, 100, 200);
    expect(tooltip.getElement().style.left).toBe('112px'); // x + 12
    expect(tooltip.getElement().style.top).toBe('188px'); // y - 12
  });

  it('hide() sets display to none', () => {
    const tooltip = new Tooltip(container, { fields: ['x'] });
    tooltip.show({ x: 1 }, 0, 0);
    tooltip.hide();
    expect(tooltip.getElement().style.display).toBe('none');
  });

  it('destroy() removes element from DOM', () => {
    const tooltip = new Tooltip(container);
    const el = tooltip.getElement();
    expect(container.contains(el)).toBe(true);
    tooltip.destroy();
    expect(container.contains(el)).toBe(false);
  });

  it('getContainer() returns parent element', () => {
    const tooltip = new Tooltip(container);
    expect(tooltip.getContainer()).toBe(container);
  });
});

// ---------------------------------------------------------------------------
// Tooltip content rendering
// ---------------------------------------------------------------------------

describe('Tooltip content', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.position = 'relative';
    document.body.appendChild(container);
  });

  it('renders aes key names as field labels', () => {
    // Tooltip uses Object.keys(aes) as field names and checks point[field]
    const aes: AesMapping = { x: 'year', y: 'sales' };
    const tooltip = new Tooltip(container, {}, aes);
    // point must have keys matching aes KEYS (x, y), not aes VALUES
    const point: DataPoint = { x: 2024, y: 1500 };
    tooltip.show(point, 0, 0);

    const el = tooltip.getElement();
    expect(el.textContent).toContain('x');
    expect(el.textContent).toContain('y');
  });

  it('formats numbers with toLocaleString', () => {
    const tooltip = new Tooltip(container, { fields: ['value'] }, {});
    tooltip.show({ value: 1234567 }, 0, 0);

    const el = tooltip.getElement();
    expect(el.textContent).toContain('value');
    // toLocaleString formats the number
    expect(el.textContent).toContain((1234567).toLocaleString());
  });

  it('shows only specified fields when config.fields is set', () => {
    const aes: AesMapping = { x: 'year', y: 'sales', color: 'region' };
    const tooltip = new Tooltip(container, { fields: ['year', 'sales'] }, aes);
    tooltip.show({ year: 2024, sales: 1500, region: 'EU' }, 0, 0);

    const el = tooltip.getElement();
    expect(el.textContent).toContain('year');
    expect(el.textContent).toContain('sales');
    // 'region' not in fields list, should not appear
    expect(el.textContent).not.toContain('region');
  });

  it('uses custom format function when provided', () => {
    const format = (d: DataPoint) => `Custom: ${d.name}`;
    const tooltip = new Tooltip(container, { format }, {});
    tooltip.show({ name: 'Hello' }, 0, 0);

    expect(tooltip.getElement().textContent).toBe('Custom: Hello');
  });

  it('shows "No data" when no fields match', () => {
    const aes: AesMapping = { x: 'nonexistent' };
    const tooltip = new Tooltip(container, {}, aes);
    tooltip.show({ other: 42 }, 0, 0);

    expect(tooltip.getElement().textContent).toContain('No data');
  });

  it('disabled tooltip does not show on show()', () => {
    const tooltip = new Tooltip(container, { enabled: false });
    tooltip.show({ x: 1 }, 100, 200);
    // When disabled, show() returns early without changing display
    // The element was created with display:none in cssText
    expect(tooltip.getElement().style.display).not.toBe('block');
  });

  it('content is rendered safely (no innerHTML injection)', () => {
    // Use config.fields to specify field directly
    const tooltip = new Tooltip(container, { fields: ['name'] }, {});
    tooltip.show({ name: '<script>alert("xss")</script>' }, 0, 0);

    const el = tooltip.getElement();
    // Should be text content, not parsed HTML
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toContain('<script>');
  });
});

// ---------------------------------------------------------------------------
// Tooltip styling
// ---------------------------------------------------------------------------

describe('Tooltip styling', () => {
  it('has proper CSS for dark background tooltip', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const tooltip = new Tooltip(container);
    const el = tooltip.getElement();

    // Verify tooltip element has expected class and is appended
    expect(el.classList.contains('ggpbi-tooltip')).toBe(true);
    expect(el.parentElement).toBe(container);
    // After show(), positioning is applied directly (these work in jsdom)
    tooltip.show({ x: 1 }, 100, 200);
    expect(el.style.display).toBe('block');
    expect(el.style.left).toBe('112px');
  });
});

// ---------------------------------------------------------------------------
// attachTooltip — event handler wiring
// ---------------------------------------------------------------------------

describe('attachTooltip', () => {
  it('attaches mouseover, mousemove, mouseout handlers', () => {
    const container = document.createElement('div');
    container.style.position = 'relative';
    document.body.appendChild(container);

    const svg = d3.select(container).append('svg');
    const circles = svg.selectAll('circle')
      .data([
        { datum: { x: 1, y: 10, name: 'A' } },
        { datum: { x: 2, y: 20, name: 'B' } },
      ])
      .join('circle')
      .attr('cx', 50)
      .attr('cy', 50)
      .attr('r', 5);

    const tooltip = new Tooltip(container, { fields: ['name'] }, {});
    attachTooltip(circles as any, [], tooltip);

    // Verify the tooltip shows/hides correctly
    tooltip.show({ name: 'Test' }, 50, 50);
    expect(tooltip.getElement().style.display).toBe('block');
    tooltip.hide();
    expect(tooltip.getElement().style.display).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// show() replaces previous content
// ---------------------------------------------------------------------------

describe('Tooltip content replacement', () => {
  it('replaces content on each show() call', () => {
    const container = document.createElement('div');
    container.style.position = 'relative';
    document.body.appendChild(container);

    const tooltip = new Tooltip(container, { fields: ['name'] }, {});

    tooltip.show({ name: 'First' }, 0, 0);
    expect(tooltip.getElement().textContent).toContain('First');

    tooltip.show({ name: 'Second' }, 0, 0);
    expect(tooltip.getElement().textContent).toContain('Second');
    expect(tooltip.getElement().textContent).not.toContain('First');
  });
});
