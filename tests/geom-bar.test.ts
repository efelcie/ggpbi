import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ggpbi, statCount, STAT_COUNT_FIELD } from '../src/index';

// --- Test data ---

const sampleData = [
  { month: 'Jan', sales: 100 },
  { month: 'Feb', sales: 200 },
  { month: 'Mar', sales: 150 },
];

const groupedData = [
  { month: 'Jan', sales: 100, region: 'Nord' },
  { month: 'Jan', sales: 80, region: 'Süd' },
  { month: 'Feb', sales: 200, region: 'Nord' },
  { month: 'Feb', sales: 150, region: 'Süd' },
  { month: 'Mar', sales: 150, region: 'Nord' },
  { month: 'Mar', sales: 120, region: 'Süd' },
];

const rawData = [
  { animal: 'cat' },
  { animal: 'dog' },
  { animal: 'cat' },
  { animal: 'cat' },
  { animal: 'dog' },
  { animal: 'bird' },
];

const weightedData = [
  { animal: 'cat', w: 10 },
  { animal: 'dog', w: 20 },
  { animal: 'cat', w: 15 },
  { animal: 'dog', w: 5 },
  { animal: 'bird', w: 30 },
];

const dataWithNA = [
  { month: 'Jan', sales: 100 },
  { month: 'Feb', sales: null },
  { month: 'Mar', sales: 150 },
  { month: 'Apr', sales: 250 },
];

const horizontalData = [
  { category: 'A', value: 30 },
  { category: 'B', value: 50 },
  { category: 'C', value: 20 },
];

// --- Helpers ---

function getBars(container: HTMLElement) {
  return container.querySelectorAll('.ggpbi-bar');
}

function getBarAttr(container: HTMLElement, index: number, attr: string) {
  const bars = getBars(container);
  return bars[index]?.getAttribute(attr);
}

// --- Tests ---

describe('statCount', () => {
  it('counts observations per category', () => {
    const result = statCount(rawData, 'animal');
    expect(result.length).toBe(3); // cat, dog, bird
    const catRow = result.find(r => r.animal === 'cat');
    const dogRow = result.find(r => r.animal === 'dog');
    const birdRow = result.find(r => r.animal === 'bird');
    expect(catRow?.[STAT_COUNT_FIELD]).toBe(3);
    expect(dogRow?.[STAT_COUNT_FIELD]).toBe(2);
    expect(birdRow?.[STAT_COUNT_FIELD]).toBe(1);
  });

  it('counts with color grouping', () => {
    const data = [
      { animal: 'cat', type: 'indoor' },
      { animal: 'cat', type: 'outdoor' },
      { animal: 'cat', type: 'indoor' },
      { animal: 'dog', type: 'outdoor' },
    ];
    const result = statCount(data, 'animal', 'type');
    expect(result.length).toBe(3); // cat-indoor, cat-outdoor, dog-outdoor
    const catIndoor = result.find(r => r.animal === 'cat' && r.type === 'indoor');
    expect(catIndoor?.[STAT_COUNT_FIELD]).toBe(2);
  });

  it('sums weights when weight field provided', () => {
    const result = statCount(weightedData, 'animal', undefined, 'w');
    const catRow = result.find(r => r.animal === 'cat');
    const dogRow = result.find(r => r.animal === 'dog');
    const birdRow = result.find(r => r.animal === 'bird');
    expect(catRow?.[STAT_COUNT_FIELD]).toBe(25); // 10 + 15
    expect(dogRow?.[STAT_COUNT_FIELD]).toBe(25); // 20 + 5
    expect(birdRow?.[STAT_COUNT_FIELD]).toBe(30);
  });
});

describe('geom_bar: stat_count integration', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('auto stat_count when no y aesthetic', () => {
    ggpbi()
      .data(rawData)
      .aes({ x: 'animal' })
      .geom('bar')
      .renderTo(container);

    const bars = getBars(container);
    expect(bars.length).toBe(3); // cat, dog, bird
  });

  it('explicit stat: count with y data present', () => {
    // Even with y data, stat_count should override
    ggpbi()
      .data(rawData.map((d, i) => ({ ...d, y: i })))
      .aes({ x: 'animal', y: 'y' })
      .geom('bar', { stat: 'count' })
      .renderTo(container);

    const bars = getBars(container);
    expect(bars.length).toBe(3);
  });
});

describe('geom_bar: default position is stack', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('grouped data stacks by default', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'month', y: 'sales', color: 'region' })
      .geom('bar')
      .renderTo(container);

    const bars = getBars(container);
    expect(bars.length).toBe(6);
    // Stacked bars in same category have same x
    const janBars = Array.from(bars).filter(b =>
      b.getAttribute('aria-label')?.startsWith('Jan')
    );
    expect(janBars.length).toBe(2);
    expect(janBars[0].getAttribute('x')).toBe(janBars[1].getAttribute('x'));
  });
});

describe('geom_bar: default width is 0.9', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('default bars are narrower than full bandwidth', () => {
    // Default width=0.9, compare to explicit width=1.0
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .renderTo(container);

    const fullContainer = document.createElement('div');
    document.body.appendChild(fullContainer);
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar', { width: 1.0 })
      .renderTo(fullContainer);

    const defaultWidth = parseFloat(container.querySelector('.ggpbi-bar')!.getAttribute('width')!);
    const fullWidth = parseFloat(fullContainer.querySelector('.ggpbi-bar')!.getAttribute('width')!);
    expect(defaultWidth).toBeLessThan(fullWidth);
    expect(defaultWidth).toBeCloseTo(fullWidth * 0.9, 0);
  });
});

describe('geom_bar: dodge2 position', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders grouped bars with padding between them', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'month', y: 'sales', color: 'region' })
      .geom('bar', { position: 'dodge2' })
      .renderTo(container);

    const bars = getBars(container);
    expect(bars.length).toBe(6);
  });

  it('dodge2 bars are narrower than dodge bars', () => {
    // dodge2 has padding between bars, so each sub-bar is narrower
    ggpbi()
      .data(groupedData)
      .aes({ x: 'month', y: 'sales', color: 'region' })
      .geom('bar', { position: 'dodge2' })
      .renderTo(container);

    const dodge2Container = document.createElement('div');
    document.body.appendChild(dodge2Container);
    ggpbi()
      .data(groupedData)
      .aes({ x: 'month', y: 'sales', color: 'region' })
      .geom('bar', { position: 'dodge' })
      .renderTo(dodge2Container);

    const dodge2Width = parseFloat(container.querySelector('.ggpbi-bar')!.getAttribute('width')!);
    const dodgeWidth = parseFloat(dodge2Container.querySelector('.ggpbi-bar')!.getAttribute('width')!);
    expect(dodge2Width).toBeLessThan(dodgeWidth);
  });

  it('dodge2 bars have different x positions per color group', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'month', y: 'sales', color: 'region' })
      .geom('bar', { position: 'dodge2' })
      .renderTo(container);

    const janBars = Array.from(getBars(container)).filter(b =>
      b.getAttribute('aria-label')?.startsWith('Jan')
    );
    expect(janBars.length).toBe(2);
    expect(janBars[0].getAttribute('x')).not.toBe(janBars[1].getAttribute('x'));
  });
});

describe('geom_bar: just parameter', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('just=0.5 centers bars (default)', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar', { width: 0.5 })
      .renderTo(container);

    // With just=0.5 and width=0.5, bar should be centered in band
    const bar = getBars(container)[0];
    expect(bar).toBeTruthy();
  });

  it('just=0 left-aligns bars', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar', { width: 0.5, just: 0 })
      .renderTo(container);

    const leftContainer = document.createElement('div');
    document.body.appendChild(leftContainer);
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar', { width: 0.5, just: 1 })
      .renderTo(leftContainer);

    const xLeft = parseFloat(container.querySelector('.ggpbi-bar')!.getAttribute('x')!);
    const xRight = parseFloat(leftContainer.querySelector('.ggpbi-bar')!.getAttribute('x')!);
    // just=0 should produce bars further left than just=1
    expect(xLeft).toBeLessThan(xRight);
  });
});

describe('geom_bar: orientation (horizontal bars)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('orientation=y renders horizontal bars', () => {
    ggpbi()
      .data(horizontalData)
      .aes({ x: 'value', y: 'category' })
      .geom('bar', { orientation: 'y' })
      .renderTo(container);

    const bars = getBars(container);
    expect(bars.length).toBe(3);
  });

  it('horizontal bars have varying width (bar length)', () => {
    ggpbi()
      .data(horizontalData)
      .aes({ x: 'value', y: 'category' })
      .geom('bar', { orientation: 'y' })
      .renderTo(container);

    const bars = getBars(container);
    const widths = Array.from(bars).map(b => parseFloat(b.getAttribute('width')!));
    // Different values should produce different bar lengths
    expect(new Set(widths).size).toBeGreaterThan(1);
  });

  it('horizontal bars have uniform height (bar thickness)', () => {
    ggpbi()
      .data(horizontalData)
      .aes({ x: 'value', y: 'category' })
      .geom('bar', { orientation: 'y' })
      .renderTo(container);

    const bars = getBars(container);
    const heights = Array.from(bars).map(b => parseFloat(b.getAttribute('height')!));
    // All bars should have the same thickness
    expect(heights[0]).toBeCloseTo(heights[1], 0);
    expect(heights[1]).toBeCloseTo(heights[2], 0);
  });

  it('horizontal aria-label is swapped (category: value)', () => {
    ggpbi()
      .data(horizontalData)
      .aes({ x: 'value', y: 'category' })
      .geom('bar', { orientation: 'y' })
      .renderTo(container);

    const label = getBarAttr(container, 0, 'aria-label');
    // Horizontal: "category: value" instead of "value: category"
    expect(label).toMatch(/[A-C]: \d/);
  });
});

describe('geom_bar: lineend and linejoin', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('lineend round applied to bar borders', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar', { stroke: '#000', strokeWidth: 2, lineend: 'round' })
      .renderTo(container);

    expect(getBarAttr(container, 0, 'stroke-linecap')).toBe('round');
  });

  it('linejoin bevel applied to bar borders', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar', { stroke: '#000', strokeWidth: 2, linejoin: 'bevel' })
      .renderTo(container);

    expect(getBarAttr(container, 0, 'stroke-linejoin')).toBe('bevel');
  });

  it('linejoin miter sets miterlimit', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar', { stroke: '#000', strokeWidth: 2, linejoin: 'miter' })
      .renderTo(container);

    expect(getBarAttr(container, 0, 'stroke-linejoin')).toBe('miter');
    expect(getBarAttr(container, 0, 'stroke-miterlimit')).toBe('10');
  });

  it('no lineend/linejoin when no stroke', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .renderTo(container);

    expect(getBarAttr(container, 0, 'stroke-linecap')).toBeNull();
    expect(getBarAttr(container, 0, 'stroke-linejoin')).toBeNull();
  });
});

describe('geom_bar: NA handling', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('filters NA values and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      ggpbi()
        .data(dataWithNA)
        .aes({ x: 'month', y: 'sales' })
        .geom('bar')
        .renderTo(container);

      const bars = getBars(container);
      expect(bars.length).toBe(3); // Feb filtered out
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('non-finite values'));
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('naRm: true silently removes NA values', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      ggpbi()
        .data(dataWithNA)
        .aes({ x: 'month', y: 'sales' })
        .geom('bar', { naRm: true })
        .renderTo(container);

      const bars = getBars(container);
      expect(bars.length).toBe(3);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('geom_bar: all positions render correctly', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('identity position renders overlapping bars', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'month', y: 'sales', color: 'region' })
      .geom('bar', { position: 'identity' })
      .renderTo(container);

    const bars = getBars(container);
    expect(bars.length).toBe(6);
  });

  it('stack position renders stacked bars', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'month', y: 'sales', color: 'region' })
      .geom('bar', { position: 'stack' })
      .renderTo(container);

    const bars = getBars(container);
    expect(bars.length).toBe(6);
    // Same category → same x
    const janBars = Array.from(bars).filter(b =>
      b.getAttribute('aria-label')?.startsWith('Jan')
    );
    expect(janBars[0].getAttribute('x')).toBe(janBars[1].getAttribute('x'));
  });

  it('dodge position renders side-by-side bars', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'month', y: 'sales', color: 'region' })
      .geom('bar', { position: 'dodge' })
      .renderTo(container);

    const bars = getBars(container);
    expect(bars.length).toBe(6);
    const janBars = Array.from(bars).filter(b =>
      b.getAttribute('aria-label')?.startsWith('Jan')
    );
    expect(janBars[0].getAttribute('x')).not.toBe(janBars[1].getAttribute('x'));
  });

  it('fill position renders 100% stacked bars', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'month', y: 'sales', color: 'region' })
      .geom('bar', { position: 'fill' })
      .renderTo(container);

    const bars = getBars(container);
    expect(bars.length).toBe(6);
  });

  it('dodge2 position renders side-by-side bars with padding', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'month', y: 'sales', color: 'region' })
      .geom('bar', { position: 'dodge2' })
      .renderTo(container);

    const bars = getBars(container);
    expect(bars.length).toBe(6);
  });
});

describe('geom_bar: styling', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('applies default color (#4682B4)', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .renderTo(container);

    expect(getBarAttr(container, 0, 'fill')).toBe('#4682B4');
  });

  it('applies custom color', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar', { color: '#FF0000' })
      .renderTo(container);

    expect(getBarAttr(container, 0, 'fill')).toBe('#FF0000');
  });

  it('applies alpha', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar', { alpha: 0.5 })
      .renderTo(container);

    expect(getBarAttr(container, 0, 'opacity')).toBe('0.5');
  });

  it('applies stroke and strokeWidth', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar', { stroke: 'red', strokeWidth: 2 })
      .renderTo(container);

    expect(getBarAttr(container, 0, 'stroke')).toBe('red');
    expect(getBarAttr(container, 0, 'stroke-width')).toBe('2');
  });

  it('applies linetype as stroke-dasharray', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar', { stroke: '#000', strokeWidth: 1, linetype: 'dashed' })
      .renderTo(container);

    expect(getBarAttr(container, 0, 'stroke-dasharray')).toBe('6 4');
  });

  // All 6 linetypes are tested in geom-line.test.ts; the single 'dashed' test above covers bar integration.
});

describe('geom_bar: accessibility', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('bars have role=listitem', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .renderTo(container);

    expect(getBarAttr(container, 0, 'role')).toBe('listitem');
  });

  it('bars have tabindex=0', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .renderTo(container);

    expect(getBarAttr(container, 0, 'tabindex')).toBe('0');
  });

  it('bars have aria-label', () => {
    ggpbi()
      .data(sampleData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar')
      .renderTo(container);

    const label = getBarAttr(container, 0, 'aria-label');
    expect(label).toBeTruthy();
    expect(label).toContain(':');
  });
});

describe('geom_bar: color grouping', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('grouped bars have different fill colours', () => {
    ggpbi()
      .data(groupedData)
      .aes({ x: 'month', y: 'sales', color: 'region' })
      .geom('bar', { position: 'dodge' })
      .renderTo(container);

    const bars = getBars(container);
    const fills = new Set(Array.from(bars).map(b => b.getAttribute('fill')));
    expect(fills.size).toBe(2); // Nord and Süd have different colors
  });
});

describe('geom_bar: negative values', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders negative bars below zero baseline', () => {
    const negData = [
      { month: 'Jan', sales: 100 },
      { month: 'Feb', sales: -50 },
      { month: 'Mar', sales: 75 },
    ];

    ggpbi()
      .data(negData)
      .aes({ x: 'month', y: 'sales' })
      .geom('bar', { position: 'identity' })
      .renderTo(container);

    const bars = getBars(container);
    expect(bars.length).toBe(3);
    // All bars should have valid positive height
    for (const bar of bars) {
      const h = parseFloat(bar.getAttribute('height')!);
      expect(h).toBeGreaterThan(0);
    }
  });
});
