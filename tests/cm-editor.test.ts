/**
 * The CodeMirror-based editor module — construction, vim layer, events.
 *
 * CodeMirror runs in jsdom on the measurement stubs from
 * tests/setup/cm-jsdom.ts; these tests assert text and state, never
 * pixels. Keyboard interaction goes through real KeyboardEvents on the
 * content DOM, the way vim receives them in the browser.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCmEditor, type CmEditor } from '../src/cm-editor';
import type { TokenKind } from '../src/codegen';

const COLORS: Record<TokenKind, string> = {
  plain: '#6a737d', call: '#6f42c1', string: '#032f62', number: '#005cc5',
  keyword: '#d73a49', property: '#22863a', punct: '#586069',
};

const CODE = "ggpbi()\n  .aes({ x: 'wt', y: 'mpg' })\n  .geom('point')\n  .size(890, 660)\n  .renderTo(element);";

let host: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
});

const make = (over: Partial<Parameters<typeof createCmEditor>[1]> = {}): CmEditor =>
  createCmEditor(host, {
    code: CODE,
    tokenColors: COLORS,
    ink: '#1f2328',
    vimEnabled: false,
    ...over,
  });

const key = (editor: CmEditor, k: string, opts: KeyboardEventInit = {}): void => {
  editor.view.contentDOM.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }),
  );
};

describe('construction', () => {
  it('mounts an editable CodeMirror carrying the code', () => {
    const editor = make();
    expect(editor.getText()).toBe(CODE);
    expect(host.querySelector('.cm-content')?.textContent).toContain(".geom('point')");
    editor.destroy();
  });

  it('colours the tokens through our own tokenizer', () => {
    const editor = make();
    const spans = [...host.querySelectorAll('.cm-line span[style*="color"]')];
    expect(spans.length).toBeGreaterThan(0);
    editor.destroy();
  });

  it('dims the inert lines', () => {
    const editor = make();
    const inert = [...host.querySelectorAll('.ggpbi-code-inert')].map(l => l.textContent);
    expect(inert.some(t => t?.includes('.size('))).toBe(true);
    expect(inert.some(t => t?.includes('.renderTo('))).toBe(true);
    expect(inert.some(t => t?.includes('.geom('))).toBe(false);
    editor.destroy();
  });

  it('reports document changes', () => {
    const onDocChange = vi.fn();
    const editor = make({ onDocChange });
    editor.setText('ggpbi()');
    expect(onDocChange).toHaveBeenCalled();
    expect(editor.getText()).toBe('ggpbi()');
    editor.destroy();
  });

  it('moves and reports the cursor', () => {
    const editor = make();
    editor.setCursor(5);
    expect(editor.getCursor()).toBe(5);
    editor.destroy();
  });
});

describe('type zoom', () => {
  it('Ctrl+wheel changes the font size within 8..28 and reports it', () => {
    const sizes: number[] = [];
    const editor = make({ onFontSizeChange: (px) => sizes.push(px) });
    const wheel = (deltaY: number, ctrlKey = true): void => {
      editor.view.dom.dispatchEvent(
        new WheelEvent('wheel', { deltaY, ctrlKey, bubbles: true, cancelable: true }),
      );
    };
    wheel(-100); // zoom in
    wheel(-100);
    expect(sizes).toEqual([13, 14]);
    wheel(100); // zoom out
    expect(sizes).toEqual([13, 14, 13]);
    wheel(-100, false); // plain scroll — no zoom
    expect(sizes).toEqual([13, 14, 13]);
    editor.destroy();
  });

  it('zooms on raw Ctrl and + / - / 0, whatever the keyboard layout', () => {
    // On a German layout = hides behind Shift+0, so the raw event.key is
    // what must decide — a CodeMirror key descriptor would miss it.
    const sizes: number[] = [];
    const editor = make({ onFontSizeChange: (px) => sizes.push(px) });
    const press = (key: string): void => {
      editor.view.dom.dispatchEvent(
        new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true }),
      );
    };
    press('+');
    press('=');
    press('-');
    press('0');
    expect(sizes).toEqual([13, 14, 13, 12]);
    editor.destroy();
  });

  it('the A± handle zooms programmatically', () => {
    const sizes: number[] = [];
    const editor = make({ onFontSizeChange: (px) => sizes.push(px) });
    editor.zoom(1);
    editor.zoom(1);
    editor.zoom(0);
    expect(sizes).toEqual([13, 14, 12]);
    editor.destroy();
  });

  it('the size lands as an INLINE style — no theme class can override it', () => {
    // In the sandbox two generated theme classes fought over font-size and
    // the stylesheet order decided against the zoom; inline always wins.
    const editor = make();
    expect(editor.view.dom.style.fontSize).toBe('12px');
    editor.zoom(1);
    expect(editor.view.dom.style.fontSize).toBe('13px');
    editor.zoom(0);
    expect(editor.view.dom.style.fontSize).toBe('12px');
    editor.destroy();
  });

  it('starts at the size the host remembered', () => {
    const sizes: number[] = [];
    const editor = make({ fontSize: 18, onFontSizeChange: (px) => sizes.push(px) });
    editor.view.dom.dispatchEvent(
      new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true }),
    );
    expect(sizes).toEqual([19]);
    editor.destroy();
  });
});

describe('the vim layer', () => {
  it('is off by default: printable keys are not vim commands', () => {
    const onAutoApply = vi.fn();
    const editor = make({ onAutoApply });
    editor.setCursor(0);
    key(editor, 'x');
    expect(editor.getText()).toBe(CODE); // no vim: keydown alone types nothing
    expect(onAutoApply).not.toHaveBeenCalled();
    editor.destroy();
  });

  it('x deletes under the cursor and auto-applies, u undoes', () => {
    const onAutoApply = vi.fn();
    const editor = make({ vimEnabled: true, onAutoApply });
    editor.setCursor(0);
    key(editor, 'x');
    expect(editor.getText()).toBe(CODE.slice(1));
    expect(onAutoApply).toHaveBeenCalledTimes(1);
    key(editor, 'u');
    expect(editor.getText()).toBe(CODE);
    editor.destroy();
  });

  it('dd deletes a line, de an operator-motion word', () => {
    const editor = make({ vimEnabled: true });
    editor.setCursor(0);
    key(editor, 'd');
    key(editor, 'd');
    expect(editor.getText().startsWith('  .aes')).toBe(true);
    // On the 'a' of aes: de takes the word, vim-exactly.
    editor.setCursor(3);
    key(editor, 'd');
    key(editor, 'e');
    expect(editor.getText().startsWith('  .({')).toBe(true);
    editor.destroy();
  });

  it('i enters insert mode, Escape returns and auto-applies typed text', () => {
    const modes: string[] = [];
    const onAutoApply = vi.fn();
    const editor = make({
      vimEnabled: true,
      onVimModeChange: (m) => modes.push(m),
      onAutoApply,
    });
    editor.setCursor(0);
    key(editor, 'i');
    expect(modes).toContain('insert');
    // Typing happens through the document in jsdom; the semantics under
    // test are: no apply while inserting, apply on Escape.
    editor.setText(`${CODE} `);
    expect(onAutoApply).not.toHaveBeenCalled();
    key(editor, 'Escape');
    expect(modes[modes.length - 1]).toBe('normal');
    expect(onAutoApply).toHaveBeenCalledTimes(1);
    editor.destroy();
  });

  it('visual mode exists now — v reports the mode', () => {
    const modes: string[] = [];
    const editor = make({ vimEnabled: true, onVimModeChange: (m) => modes.push(m) });
    editor.setCursor(0);
    key(editor, 'v');
    expect(modes).toContain('visual');
    key(editor, 'Escape');
    editor.destroy();
  });

  it('Ctrl+M asks the host to toggle, with vim on or off', () => {
    const onToggleVim = vi.fn();
    const editor = make({ onToggleVim });
    key(editor, 'm', { ctrlKey: true });
    expect(onToggleVim).toHaveBeenCalledTimes(1);
    editor.setVim(true);
    key(editor, 'm', { ctrlKey: true });
    expect(onToggleVim).toHaveBeenCalledTimes(2);
    editor.destroy();
  });

  it('setVim switches the layer without losing the document', () => {
    const editor = make();
    editor.setText('ggpbi()\n  .geom(\'bar\')');
    editor.setVim(true);
    editor.setCursor(0);
    key(editor, 'x');
    expect(editor.getText().startsWith('gpbi')).toBe(true);
    editor.setVim(false);
    key(editor, 'x');
    expect(editor.getText().startsWith('gpbi')).toBe(true); // back to a normal editor
    editor.destroy();
  });
});
