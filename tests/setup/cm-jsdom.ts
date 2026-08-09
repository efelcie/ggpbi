/**
 * jsdom lacks the layout-measurement APIs CodeMirror calls while
 * rendering. These stubs return empty geometry — CodeMirror tolerates
 * zero-rects (it positions nothing, which is fine: tests assert text and
 * state, never pixels).
 */
const zeroRect = (): DOMRect => ({
  top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0,
  toJSON: () => ({}),
}) as DOMRect;

const emptyRectList = (): DOMRectList => {
  const list = {
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* () { /* empty */ },
  };
  return list as unknown as DOMRectList;
};

Range.prototype.getClientRects = emptyRectList;
Range.prototype.getBoundingClientRect = zeroRect;

if (!('getClientRects' in Element.prototype) || typeof Element.prototype.getClientRects !== 'function') {
  Element.prototype.getClientRects = emptyRectList;
}

// CodeMirror observes size changes when the API exists; jsdom has none.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class NoopResizeObserver {
    observe(): void { /* noop */ }
    unobserve(): void { /* noop */ }
    disconnect(): void { /* noop */ }
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = NoopResizeObserver;
}
