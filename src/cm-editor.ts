/**
 * The code editor, on CodeMirror 6 — with real vim, optionally.
 *
 * The hand-rolled editor (a transparent textarea over a highlighted
 * <pre>, plus a 500-line vim subset) kept teaching the same lesson: two
 * renderings of one position always find a way to disagree, and every
 * vim key beyond the basics is a subsystem. CodeMirror owns rendering,
 * cursor and keys in ONE system, and @replit/codemirror-vim is the full
 * emulation — visual mode, registers, search, repeat — maintained by
 * people who do nothing else.
 *
 * What stays ours: the tokenizer (`highlight` from codegen — it knows
 * exactly the grammar specToCode emits), the inert-line dimming, the
 * palette, and everything around the editor (parse, apply, host wiring).
 * This module is deliberately the only place that imports CodeMirror.
 */
import { EditorState, Compartment, RangeSetBuilder, Prec } from '@codemirror/state';
import {
  EditorView, ViewPlugin, Decoration, keymap, drawSelection,
  lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  type DecorationSet, type ViewUpdate,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { autocompletion, completionKeymap, type CompletionSource } from '@codemirror/autocomplete';
import { vim, getCM, Vim } from '@replit/codemirror-vim';
import { highlight, type CodeToken, type TokenKind } from './codegen';

export interface CmEditorOptions {
  /** Initial document. */
  code: string;
  /** Colours per token kind — the code-view palette. */
  tokenColors: Record<TokenKind, string>;
  /** Ink colour for cursor and selection accents. */
  ink: string;
  /** Dark surface? Styles the gutter and active line the DAX-editor way. */
  dark?: boolean;
  /**
   * Fill the host's height and own the scrolling — the docked split
   * view. The scroll bars then sit at the pane's edges, however little
   * code there is. Off, the editor grows with its content (the overlay).
   */
  fillHost?: boolean;
  /** Autocomplete source for the dialect on display; none disables it. */
  completions?: CompletionSource;
  /** Initial font size in px (Ctrl+wheel zooms; default 12). */
  fontSize?: number;
  /** Reports every Ctrl+wheel zoom — the host remembers it per session. */
  onFontSizeChange?: (px: number) => void;
  /** Tokenizer for the dialect on display. Default: the ggpbi chain. */
  tokenize?: (code: string) => CodeToken[];
  /**
   * Lines the apply step ignores get dimmed. A RegExp tests each line on
   * its own; a function sees the whole document and returns one flag per
   * line (ggpbir's block-structured mask needs that). null dims nothing.
   */
  inertLine?: RegExp | ((docText: string) => boolean[]) | null;
  /** Start with vim on? */
  vimEnabled: boolean;
  /** Vim sub-mode changes (normal/insert/visual) — drives the badge. */
  onVimModeChange?: (mode: string) => void;
  /** Document changed (any editing). */
  onDocChange?: () => void;
  /**
   * Called when the editor wants the chart updated: Esc back to normal
   * mode, or a normal-mode edit — the auto-apply moments.
   */
  onAutoApply?: () => void;
  /** Ctrl+M — the host flips vim on/off and calls setVim(). */
  onToggleVim?: () => void;
}

export interface CmEditor {
  view: EditorView;
  getText(): string;
  setText(text: string): void;
  setVim(on: boolean): void;
  /** Enter/leave vim's insert mode programmatically — the badge click. */
  enterInsert(): void;
  exitInsert(): void;
  /** Zoom the type: +1 / -1 steps, 0 resets — the A− / A+ items. */
  zoom(delta: number): void;
  focus(): void;
  getCursor(): number;
  setCursor(pos: number): void;
  destroy(): void;
}

/** Our tokenizer as a CodeMirror decoration source, line by line. */
function tokenDecorations(
  view: EditorView,
  colors: Record<TokenKind, string>,
  tokenize: (code: string) => CodeToken[],
  inertLine: RegExp | ((docText: string) => boolean[]) | null,
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const docFlags = typeof inertLine === 'function'
    ? inertLine(view.state.doc.toString())
    : null;
  for (const { from, to } of view.visibleRanges) {
    const firstLine = view.state.doc.lineAt(from).number;
    const lastLine = view.state.doc.lineAt(to).number;
    for (let n = firstLine; n <= lastLine; n++) {
      const line = view.state.doc.line(n);
      const inert = docFlags
        ? docFlags[n - 1] === true
        : inertLine instanceof RegExp && inertLine.test(line.text);
      if (inert) {
        builder.add(line.from, line.from, Decoration.line({ class: 'ggpbi-code-inert' }));
      }
      let pos = line.from;
      for (const token of tokenize(line.text)) {
        const color = colors[token.kind];
        if (token.kind !== 'plain') {
          builder.add(pos, pos + token.text.length, Decoration.mark({
            attributes: { style: `color:${color}` },
          }));
        }
        pos += token.text.length;
      }
    }
  }
  return builder.finish();
}

/**
 * Create the editor inside `host`.
 *
 * The vim extension lives in a compartment so Ctrl+M (and the Format
 * Pane default) can switch it without rebuilding the editor.
 */
export function createCmEditor(host: HTMLElement, options: CmEditorOptions): CmEditor {
  const vimCompartment = new Compartment();

  const tokenize = options.tokenize ?? highlight;
  const inertLine = options.inertLine === undefined
    ? /^\s*\.(data|size|renderTo)\(/
    : options.inertLine;

  const highlighter = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = tokenDecorations(view, options.tokenColors, tokenize, inertLine);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged) {
          this.decorations = tokenDecorations(u.view, options.tokenColors, tokenize, inertLine);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );

  // Look and feel oriented on Power BI's DAX editor window: a quiet
  // numbered gutter, a subtly highlighted active line, VS-style colours
  // (which the code-view palette supplies).
  const dark = options.dark === true;
  // The type size is an INLINE style on the editor element — themes are
  // classes, classes can lose specificity fights, inline cannot. Ctrl+
  // wheel, the zoom keys and the A± items all funnel through applySize.
  let fontSize = options.fontSize ?? 12;

  const theme = EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      color: options.tokenColors.plain,
      ...(options.fillHost ? { height: '100%' } : {}),
    },
    ...(options.fillHost ? { '.cm-scroller': { overflow: 'auto' } } : {}),
    '.cm-content': {
      fontFamily: '"Cascadia Code",Consolas,"SF Mono",Menlo,monospace',
      lineHeight: '1.55',
      padding: '10px 0',
      caretColor: options.ink,
    },
    '.cm-line': { padding: '0 12px' },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: dark ? '#6e7681' : '#a0a8b0',
      border: 'none',
      fontFamily: '"Cascadia Code",Consolas,monospace',
      paddingLeft: '6px',
    },
    '.cm-lineNumbers .cm-gutterElement': { minWidth: '28px' },
    '.cm-activeLine': { backgroundColor: dark ? '#ffffff08' : '#00000006' },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: dark ? '#e6edf3' : '#333333',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor': { borderLeftColor: options.ink },
    '.cm-fat-cursor': {
      background: options.ink,
      opacity: '0.55',
      color: 'inherit',
    },
    '&:not(.cm-focused) .cm-fat-cursor': { background: 'none', outline: `1px solid ${options.ink}` },
    '.cm-selectionBackground': { background: `${options.ink}22` },
    '&.cm-focused .cm-selectionBackground': { background: `${options.ink}33` },
    '.ggpbi-code-inert': { opacity: '0.45' },
    '.cm-panels': {
      backgroundColor: 'transparent',
      color: 'inherit',
      fontFamily: '"Cascadia Code",Consolas,monospace',
      fontSize: '11px',
      padding: '2px 10px',
    },
  });

  let wasInsert = false;
  let vimOn = options.vimEnabled;

  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: options.code,
      extensions: [
        // Ctrl+M outranks everything, including vim's key handling.
        // (Zoom keys are handled on the raw event below — CodeMirror's
        // key descriptors miss layout differences like = on Shift+0.)
        Prec.highest(keymap.of([
          { key: 'Ctrl-m', run: () => { options.onToggleVim?.(); return true; } },
        ])),
        vimCompartment.of(options.vimEnabled ? vim() : []),
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        ...(options.completions
          ? [autocompletion({ override: [options.completions] })]
          : []),
        keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap]),
        highlighter,
        theme,
        EditorView.updateListener.of((u: ViewUpdate) => {
          if (u.docChanged) options.onDocChange?.();
          // Normal-mode edits apply as they happen (dd, x, p, u…): the
          // doc changed while vim is on and not inserting.
          if (u.docChanged && vimActive() && !insertActive()) options.onAutoApply?.();
        }),
      ],
    }),
  });

  // Docked, the height promise must hold whatever the surrounding CSS
  // does — inline styles outrank generated theme classes.
  if (options.fillHost) {
    view.dom.style.height = '100%';
    view.scrollDOM.style.overflow = 'auto';
  }
  view.dom.style.fontSize = `${fontSize}px`;

  // The gutter numbers sit where CodeMirror MEASURED the lines to be.
  // The measure is deferred to an animation frame — in the sandbox it
  // can run before the editor font finishes loading, and the numbers
  // stack beside the wrong lines. Reading layout (coordsAtPos) flushes
  // the pending measure synchronously; the fonts.ready hook re-measures
  // once the real font metrics exist.
  const measureNow = (): void => {
    view.requestMeasure();
    try { view.coordsAtPos(0); } catch { /* headless test DOM */ }
  };
  measureNow();
  (document as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready?.then(
    () => view.requestMeasure(),
  );

  const applySize = (next: number): boolean => {
    const clamped = Math.max(8, Math.min(28, next));
    if (clamped === fontSize) return false;
    fontSize = clamped;
    view.dom.style.fontSize = `${fontSize}px`;
    measureNow();
    options.onFontSizeChange?.(fontSize);
    return true;
  };

  /** The keyboard zoom: +1, -1, or 0 to reset to the default size. */
  const zoom = (delta: number): void => {
    applySize(delta === 0 ? 12 : fontSize + delta);
  };

  // Raw keydown, not a CodeMirror key descriptor: event.key carries the
  // character the LAYOUT produced, so Ctrl and + / - / 0 work on a
  // German keyboard (where = hides behind Shift+0) as well as a US one.
  view.dom.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); e.stopPropagation(); zoom(1); }
    else if (e.key === '-') { e.preventDefault(); e.stopPropagation(); zoom(-1); }
    else if (e.key === '0') { e.preventDefault(); e.stopPropagation(); zoom(0); }
  }, true);

  // Ctrl+wheel: type size, the editor way. Plain wheel keeps scrolling.
  view.dom.addEventListener('wheel', (e: WheelEvent) => {
    if (!e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    applySize(fontSize + (e.deltaY < 0 ? 1 : -1));
  }, { passive: false });

  const vimActive = (): boolean => vimOn;

  const insertActive = (): boolean => {
    const cm = getCM(view);
    return cm?.state.vim?.insertMode === true;
  };

  const wireVimEvents = (): void => {
    const cm = getCM(view);
    if (!cm) return;
    cm.on('vim-mode-change', (change: { mode: string }) => {
      options.onVimModeChange?.(change.mode);
      // Esc back from insert: the typed text becomes the chart.
      if (wasInsert && change.mode === 'normal') options.onAutoApply?.();
      wasInsert = change.mode === 'insert';
    });
    options.onVimModeChange?.('normal');
  };
  if (options.vimEnabled) wireVimEvents();

  return {
    view,
    getText: () => view.state.doc.toString(),
    setText: (text) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }),
    setVim: (on) => {
      vimOn = on;
      view.dispatch({ effects: vimCompartment.reconfigure(on ? vim() : []) });
      if (on) wireVimEvents();
      view.focus();
    },
    zoom,
    enterInsert: () => {
      const cm = getCM(view);
      if (cm && !insertActive()) (Vim as { handleKey: (cm: unknown, key: string, origin: string) => unknown }).handleKey(cm, 'i', 'mapping');
      view.focus();
    },
    exitInsert: () => {
      const cm = getCM(view);
      if (cm && insertActive()) (Vim as { handleKey: (cm: unknown, key: string, origin: string) => unknown }).handleKey(cm, '<Esc>', 'mapping');
      view.focus();
    },
    focus: () => view.focus(),
    getCursor: () => view.state.selection.main.head,
    setCursor: (pos) => {
      const p = Math.min(pos, view.state.doc.length);
      view.dispatch({ selection: { anchor: p } });
    },
    destroy: () => view.destroy(),
  };
}
