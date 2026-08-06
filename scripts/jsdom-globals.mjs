// Minimal browser environment for rendering charts in Node (used by build-gallery).
// Imported FIRST so the DOM globals exist before the library modules load.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });

for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  SVGElement: dom.window.SVGElement,
  Element: dom.window.Element,
  Node: dom.window.Node,
})) {
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}
