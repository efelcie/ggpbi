import { describe, it, expect, beforeEach } from 'vitest';
import { ggpbi } from '../src/index';
import { resolveTheme, themeDark, themeMinimal } from '../src/theme';

const sampleData = [
  { month: 'Jan', sales: 100 },
  { month: 'Feb', sales: 200 },
  { month: 'Mar', sales: 150 },
];

describe('ARIA attributes', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('SVG has role="img" and aria-label', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .labels('Monat', 'Umsatz')
      .renderTo(container);

    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('Monat vs Umsatz');
  });

  it('SVG aria-label defaults to "Chart" when no labels set', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .renderTo(container);

    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-label')).toBe('Chart');
  });

  it('geom layer group has role="list" and aria-label', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .renderTo(container);

    const layer = container.querySelector('.ggpbi-layer-bar');
    expect(layer?.getAttribute('role')).toBe('list');
    expect(layer?.getAttribute('aria-label')).toBe('Data points');
  });

  it('bar elements have role="listitem" and tabindex', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .renderTo(container);

    const bars = container.querySelectorAll('.ggpbi-bar');
    expect(bars.length).toBe(3);
    for (const bar of bars) {
      expect(bar.getAttribute('role')).toBe('listitem');
      expect(bar.getAttribute('tabindex')).toBe('0');
      expect(bar.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('point elements have role="listitem" and aria-label', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('point')
      .renderTo(container);

    const points = container.querySelectorAll('.ggpbi-point');
    expect(points.length).toBe(3);
    const first = points[0];
    expect(first.getAttribute('role')).toBe('listitem');
    expect(first.getAttribute('tabindex')).toBe('0');
    expect(first.getAttribute('aria-label')).toContain('Jan');
  });

  it('text elements have role="listitem" and aria-label', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales', label: 'month' })
      .geom('text')
      .renderTo(container);

    const texts = container.querySelectorAll('.ggpbi-text');
    expect(texts.length).toBe(3);
    for (const t of texts) {
      expect(t.getAttribute('role')).toBe('listitem');
      expect(t.getAttribute('tabindex')).toBe('0');
    }
  });
});

describe('High Contrast theme', () => {
  it('resolveTheme sets isHighContrast and stroke width', () => {
    const normal = resolveTheme({});
    expect(normal.isHighContrast).toBe(false);
    expect(normal.highContrastStrokeWidth).toBe(0);

    const hc = resolveTheme({ isHighContrast: true });
    expect(hc.isHighContrast).toBe(true);
    expect(hc.highContrastStrokeWidth).toBe(2);
  });

  it('high contrast adds strokes to bars', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .theme({ isHighContrast: true })
      .renderTo(container);

    const bars = container.querySelectorAll('.ggpbi-bar');
    expect(bars.length).toBe(3);
    for (const bar of bars) {
      expect(bar.getAttribute('stroke')).toBeTruthy();
      expect(Number(bar.getAttribute('stroke-width'))).toBeGreaterThan(0);
    }
  });

  it('high contrast adds strokes to points', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('point')
      .theme({ isHighContrast: true })
      .renderTo(container);

    const points = container.querySelectorAll('.ggpbi-point');
    expect(points.length).toBe(3);
    for (const point of points) {
      expect(point.getAttribute('stroke')).toBeTruthy();
      expect(Number(point.getAttribute('stroke-width'))).toBeGreaterThan(0);
    }
  });
});

describe('Theme presets render correctly', () => {
  it('dark theme uses dark panelFill', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .theme(themeDark())
      .renderTo(container);

    const panel = container.querySelector('.ggpbi-panel');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('fill')).toBe('#2d2d2d');
  });

  it('minimal theme uses white panelFill', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .theme(themeMinimal())
      .renderTo(container);

    const panel = container.querySelector('.ggpbi-panel');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('fill')).toBe('#ffffff');
  });

  it('host palette overrides theme colorPalette', () => {
    const hostPalette = ['#ff0000', '#00ff00', '#0000ff'];
    const resolved = resolveTheme({
      ...themeDark(),
      colorPalette: hostPalette,
    });
    // Host palette wins over theme's default PBI_DEFAULT_PALETTE
    expect(resolved.colorPalette).toEqual(hostPalette);
  });
});
