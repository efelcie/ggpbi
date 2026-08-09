/**
 * The debug view's editor — CodeMirror-backed, with a VS-Code-style
 * status bar.
 *
 * Bottom-left the vim mode, itself a control (click NORMAL → INSERT and
 * back); bottom-right the vim on/off item, the language select and, while
 * the text differs, flat Cancel/Apply. Header: title, a copy icon and a
 * small ✕ — no Reset: applied edits are durable. In vim, edits apply
 * themselves after two quiet seconds — never per keystroke — and the
 * rebuild that follows keeps caret, keyboard and insert mode.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderCodeView, resetVimSession } from '../src/code-view';
import { resolveTheme } from '../src/theme';

const CODE = "ggpbi()\n  .aes({ x: 'wt', y: 'mpg' })\n  .geom('point')\n  .size(890, 660)\n  .renderTo(element);";

beforeEach(() => {
  document.body.innerHTML = '';
  resetVimSession();
});

afterEach(() => {
  vi.useRealTimers();
});

const container = (): HTMLElement => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
};

const content = (el: HTMLElement): HTMLElement =>
  el.querySelector('.cm-content') as HTMLElement;

const key = (el: HTMLElement, k: string, opts: KeyboardEventInit = {}): void => {
  content(el).dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }),
  );
};

const badgeOf = (el: HTMLElement): HTMLElement =>
  el.querySelector('.ggpbi-vim-mode') as HTMLElement;

const vimToggleOf = (el: HTMLElement): HTMLElement =>
  el.querySelector('.ggpbi-vim-toggle') as HTMLElement;

const statusOf = (el: HTMLElement, label: string): HTMLElement =>
  [...el.querySelectorAll('.ggpbi-code-status span')]
    .find(s => s.textContent === label) as HTMLElement;

const idleTimers = (): void => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
};

describe('the editor panel', () => {
  it('is a plain <pre> read-only — CodeMirror never runs for it', () => {
    const el = container();
    renderCodeView(el, CODE, resolveTheme({}));
    expect(el.querySelector('.cm-content')).toBeNull();
    expect(el.querySelector('.ggpbi-code-status')).toBeNull();
    expect(el.querySelector('pre')!.textContent).toContain(".geom('point')");
    expect(el.querySelector('button[aria-label="Copy code"]')).toBeTruthy();
  });

  it('carries a CodeMirror editor with the code when editable', () => {
    const el = container();
    renderCodeView(el, CODE, resolveTheme({}), { onApply: () => null });
    expect(content(el).textContent).toContain(".geom('point')");
    const inert = [...el.querySelectorAll('.ggpbi-code-inert')].map(l => l.textContent);
    expect(inert.some(t => t?.includes('.size('))).toBe(true);
  });

  it('shows Apply and Cancel only once the text differs, and Cancel restores', () => {
    const el = container();
    renderCodeView(el, CODE, resolveTheme({}), { onApply: () => null });
    const apply = statusOf(el, 'Apply');
    expect(apply.style.display).toBe('none');

    key(el, 'm', { ctrlKey: true });
    key(el, 'x');
    expect(content(el).textContent).toContain('gpbi()');
    expect(apply.style.display).not.toBe('none');

    statusOf(el, 'Cancel').click();
    expect(content(el).textContent).toContain('ggpbi()');
    expect(apply.style.display).toBe('none');
  });

  it('overlay and dock share one background tone', () => {
    const overlay = container();
    renderCodeView(overlay, CODE, resolveTheme({}), { onApply: () => null });
    const overlayPanel = overlay.querySelector('.ggpbi-code-view') as HTMLElement;
    expect(overlayPanel.style.backgroundColor).toBe('rgba(246, 248, 250, 0.96)');

    const dock = container();
    renderCodeView(dock, CODE, resolveTheme({}), { onApply: () => null, docked: true });
    const dockPanel = dock.querySelector('.ggpbi-code-view') as HTMLElement;
    expect(dockPanel.style.backgroundColor).toBe('rgba(246, 248, 250, 0.96)'); // same tone as the overlay
  });

  it('docked, the panel fills its host flush and square — split-view style', () => {
    const el = container();
    renderCodeView(el, CODE, resolveTheme({}), { onApply: () => null, docked: true });
    const panel = el.querySelector('.ggpbi-code-view') as HTMLElement;
    expect(panel.style.position).toBe('relative'); // in the layout, not over it
    expect(panel.style.height).toBe('100%');
    expect(panel.style.borderRadius).toBe('');
    expect(panel.style.boxShadow).toBe('');
    expect(el.querySelector('.cm-content')).toBeTruthy(); // still the full editor
  });

  it('the header carries small flat icons: copy and close', () => {
    const el = container();
    const onClose = vi.fn();
    renderCodeView(el, CODE, resolveTheme({}), { onApply: () => null, onClose });
    const copy = el.querySelector('button[aria-label="Copy code"]') as HTMLButtonElement;
    const close = el.querySelector('button[aria-label="Hide code"]') as HTMLButtonElement;
    expect(copy.textContent).toBe('⧉');
    expect(close.textContent).toBe('✕');
    expect(close.style.width).toBe('18px'); // window-manager sized
    close.click();
    expect(onClose).toHaveBeenCalled();
  });

  it('Copy takes the text as edited and confirms with a check mark', async () => {
    const el = container();
    renderCodeView(el, CODE, resolveTheme({}), { onApply: () => null });
    key(el, 'm', { ctrlKey: true });
    key(el, 'x');
    const written: string[] = [];
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: (t: string) => { written.push(t); return Promise.resolve(); } },
      configurable: true,
    });
    const copy = el.querySelector('button[aria-label="Copy code"]') as HTMLButtonElement;
    copy.click();
    await new Promise(r => setTimeout(r, 0));
    expect(written).toEqual([CODE.slice(1)]);
    expect(copy.textContent).toBe('✓');
  });

  it('labels the panel while an edit is applied — and never offers Reset', () => {
    const el = container();
    renderCodeView(el, CODE, resolveTheme({}), { onApply: () => null, edited: true });
    expect(el.querySelector('.ggpbi-code-view')!.textContent).toContain('(edited)');
    // Applied edits are durable: the pane got the write, there is nothing
    // to go back to.
    expect([...el.querySelectorAll('button')].map(b => b.textContent)).not.toContain('Reset');
  });

  it('A− and A+ stand in the bar as click targets for the type zoom', () => {
    const el = container();
    renderCodeView(el, CODE, resolveTheme({}), { onApply: () => null });
    const zoomIn = statusOf(el, 'A+');
    const zoomOut = statusOf(el, 'A−');
    expect(zoomIn).toBeTruthy();
    expect(zoomOut).toBeTruthy();
    zoomIn.click(); // wired to the editor — must not throw
    zoomOut.click();
  });

  it('all three languages stand in the bar, the active one emphasised', () => {
    const el = container();
    const onSyntaxChange = vi.fn();
    renderCodeView(el, CODE, resolveTheme({}), { onApply: () => null, onSyntaxChange });

    const options = [...el.querySelectorAll('.ggpbi-syntax-option')] as HTMLElement[];
    expect(options.map(o => o.textContent)).toEqual(['ggpbi', 'ggplot2', 'ggpbir']);
    expect(options[0].getAttribute('aria-checked')).toBe('true'); // ggpbi is the default
    expect(options[0].style.fontWeight).toBe('700');
    expect(options[1].style.fontWeight).toBe('400');

    // A little apart from the vim toggle — two controls, one gap.
    const group = el.querySelector('.ggpbi-syntax-switch') as HTMLElement;
    expect(group.style.marginLeft).toBe('10px');

    options[2].click();
    expect(onSyntaxChange).toHaveBeenCalledWith('ggpbir');
    options[0].click();
    expect(onSyntaxChange).not.toHaveBeenCalledWith('ggpbi'); // the active one is not a button
  });
});

describe('the vim layer in the panel', () => {
  it('the bottom-right item toggles vim; the mode appears bottom-left', () => {
    const el = container();
    const onVimChange = vi.fn();
    renderCodeView(el, CODE, resolveTheme({}), { onApply: () => null, onVimChange });

    const toggle = vimToggleOf(el);
    const badge = badgeOf(el);
    expect(toggle.textContent).toBe('vim-mode: off');
    expect(badge.style.display).toBe('none');

    toggle.click();
    expect(toggle.textContent).toBe('vim-mode: on');
    expect(badge.style.display).not.toBe('none');
    expect(badge.textContent).toBe('-- NORMAL --');
    expect(onVimChange).toHaveBeenCalledWith(true);

    toggle.click();
    expect(toggle.textContent).toBe('vim-mode: off');
    expect(badge.style.display).toBe('none');
    expect(onVimChange).toHaveBeenCalledWith(false);
  });

  it('clicking the mode switches INSERT and NORMAL, not vim off', () => {
    const el = container();
    renderCodeView(el, CODE, resolveTheme({}), { onApply: () => null });
    vimToggleOf(el).click();
    const badge = badgeOf(el);
    expect(badge.textContent).toBe('-- NORMAL --');

    badge.click();
    expect(badge.textContent).toBe('-- INSERT --');
    expect(vimToggleOf(el).textContent).toBe('vim-mode: on'); // still on

    badge.click();
    expect(badge.textContent).toBe('-- NORMAL --');
    vimToggleOf(el).click();
  });

  it('Ctrl+M still toggles, and the pane default starts modal', () => {
    const el = container();
    renderCodeView(el, CODE, resolveTheme({}), { onApply: () => null, vimDefault: true });
    expect(vimToggleOf(el).textContent).toBe('vim-mode: on');
    key(el, 'm', { ctrlKey: true });
    expect(vimToggleOf(el).textContent).toBe('vim-mode: off');

    const next = container();
    renderCodeView(next, CODE, resolveTheme({}), { onApply: () => null, vimDefault: true });
    expect(vimToggleOf(next).textContent).toBe('vim-mode: off'); // override survived
  });

  it('vim edits apply after two quiet seconds, not per keystroke', () => {
    idleTimers();
    const el = container();
    const onApply = vi.fn(() => null);
    renderCodeView(el, CODE, resolveTheme({}), { onApply });
    vimToggleOf(el).click();
    key(el, 'x');
    expect(onApply).not.toHaveBeenCalled(); // typing continues undisturbed

    key(el, 'x'); // a second edit restarts the clock
    vi.advanceTimersByTime(1500);
    expect(onApply).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(CODE.slice(2));
  });

  it('the flat Apply applies immediately, without waiting', () => {
    const el = container();
    const onApply = vi.fn(() => null);
    renderCodeView(el, CODE, resolveTheme({}), { onApply });
    vimToggleOf(el).click();
    key(el, 'x');
    statusOf(el, 'Apply').click();
    expect(onApply).toHaveBeenCalledWith(CODE.slice(1));
  });

  it('the rebuild after an idle apply keeps keyboard, caret and insert mode', () => {
    idleTimers();
    const first = container();
    renderCodeView(first, CODE, resolveTheme({}), { onApply: () => null });
    vimToggleOf(first).click();
    key(first, 'l');
    key(first, 'x');
    key(first, 'i'); // writing when the idle apply fires
    vi.advanceTimersByTime(2100);

    const second = container();
    renderCodeView(second, 'g' + CODE.slice(2), resolveTheme({}), { onApply: () => null });
    expect(document.activeElement).toBe(content(second));
    expect(badgeOf(second).textContent).toBe('-- INSERT --'); // mode survived
  });
});
