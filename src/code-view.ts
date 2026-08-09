/**
 * Debug view: the ggpbi code behind the chart, as a code block.
 *
 * The Format Pane builds charts by clicking, which leaves no artefact to
 * read, copy or paste into a bug report. Switching this on overlays the
 * fluent chain that would produce the same chart.
 *
 * It is an overlay, not a layout element: a debug view should not resize
 * the chart it is describing, and switching it off must leave the plot
 * exactly as it was. It starts where the subtitle sits and grows
 * downwards, scrolling instead of covering the whole panel.
 *
 * With an onApply handler the block is an editor (CodeMirror — see
 * cm-editor.ts); read-only it stays a plain highlighted <pre>, and
 * CodeMirror never runs for it.
 */
import { highlight, type CodeToken, type TokenKind } from './codegen';
import { highlightR } from './r-codegen';
import { highlightJson, ggpbirInertLines } from './ggpbir-codegen';
import { createCmEditor, type CmEditor } from './cm-editor';
import { createGgpbiCompletions, createGgplot2Completions } from './cm-completions';
import type { ResolvedTheme } from './theme';

export type CodeSyntax = 'ggpbi' | 'ggplot2' | 'ggpbir';

/** The overlay's syntax cycle, in the order the header switch walks it. */
export const SYNTAX_CYCLE: CodeSyntax[] = ['ggpbi', 'ggplot2', 'ggpbir'];

const TOKENIZERS: Record<CodeSyntax, (code: string) => CodeToken[]> = {
  ggpbi: highlight,
  ggplot2: highlightR,
  ggpbir: highlightJson,
};

const INERT: Record<CodeSyntax, RegExp | ((text: string) => boolean[]) | null> = {
  // Host-owned lines: the symbolic calls, the report palette, contrast
  // state and locale — shown whole, greyed, ignored on apply.
  ggpbi: /^\s*(\.(data|size|renderTo)\(|\.format\(\{ locale|colorPalette:|isHighContrast:)/,
  ggplot2: /^\s*(colorPalette|isHighContrast) = /,
  ggpbir: ggpbirInertLines,
};

/**
 * Colours per token kind, for a light and a dark surface — the palette
 * Power BI's own DAX editor speaks (Visual Studio colours): functions
 * ochre-brown, strings rust, numbers green-ish, keywords blue.
 */
const PALETTE: Record<'light' | 'dark', Record<TokenKind, string>> = {
  light: {
    plain: '#333333',
    call: '#795e26',
    string: '#a31515',
    number: '#098658',
    keyword: '#0000ff',
    property: '#001080',
    punct: '#666666',
  },
  dark: {
    plain: '#d4d4d4',
    call: '#dcdcaa',
    string: '#ce9178',
    number: '#b5cea8',
    keyword: '#569cd6',
    property: '#9cdcfe',
    punct: '#a0a0a0',
  },
};

/** Perceived brightness — decides which palette reads on this theme. */
function isDarkSurface(hex: string): boolean {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
}

/**
 * Session override for the editor's modal (vim) layer, toggled with
 * Ctrl+M. `undefined` follows the host's default (the Format Pane's
 * "Vim mode" toggle); a boolean survives re-renders of the visual and
 * resets on reload. The default of defaults is a standard editor.
 */
let vimSessionOverride: boolean | undefined;

/**
 * Caret position carried across the re-render an auto-apply triggers, so
 * the cursor stays where the edit happened instead of jumping home.
 */
let vimCaretMemory: number | undefined;

/**
 * Vim sub-mode carried the same way: an idle-apply must not kick the
 * writer out of insert mode mid-thought.
 */
let vimModeMemory: 'insert' | undefined;

/** The Ctrl+wheel type size — a session preference, like the vim state. */
let editorFontSize = 12;

/** Forget the session's modal-editing override and caret — for teardown/tests. */
export function resetVimSession(): void {
  vimSessionOverride = undefined;
  vimCaretMemory = undefined;
  vimModeMemory = undefined;
  editorFontSize = 12;
}

export interface CodeViewOptions {
  /** Called when the close button is pressed (browser demo only). */
  onClose?: () => void;
  /**
   * Called with the edited code when it should apply. Return an error
   * message to show it in the panel, or null to accept — the caller then
   * re-renders and this panel is rebuilt with the applied state. Providing
   * this handler is what makes the block an editor.
   */
  onApply?: (code: string) => string | null;
  /** True while an edit is applied — labels the panel "(edited)". */
  edited?: boolean;
  /**
   * Default for the modal (vim) editing layer — the Format Pane's
   * "Vim mode" toggle. Ctrl+M overrides it for the session.
   */
  vimDefault?: boolean;
  /** Which dialect the block speaks — picks tokenizer and dimming rules. */
  syntax?: CodeSyntax;
  /**
   * Called when the header's language switch is clicked, with the next
   * dialect in the cycle. The host persists it (Theme → Code syntax) and
   * re-renders; without this handler the switch is not offered.
   */
  onSyntaxChange?: (syntax: CodeSyntax) => void;
  /**
   * Called when the header's vim switch (or Ctrl+M) flips modal editing.
   * The host persists it (Theme → Vim mode); the editor flips instantly
   * either way.
   */
  onVimChange?: (on: boolean) => void;
  /**
   * Docked: a full-height pane in a split layout (advanced edit) instead
   * of a floating overlay — square corners, no shadow, fills its host.
   */
  docked?: boolean;
  /** The bound well fields, for value suggestions — only what exists. */
  fields?: string[];
}

/**
 * Render the code block into `container` and return its element.
 *
 * The container is expected to be position:relative — `createSvg` already
 * guarantees that.
 */
export function renderCodeView(
  container: HTMLElement,
  code: string,
  theme: ResolvedTheme,
  options: CodeViewOptions = {},
): HTMLElement {
  const dark = isDarkSurface(theme.paper ?? '#ffffff');
  const colors = PALETTE[dark ? 'dark' : 'light'];
  const surface = dark ? '#0d1117' : '#f6f8fa';
  // The floating overlay lets a breath of the chart shine through — the
  // background only; text and controls stay fully opaque. Docked panes
  // are part of the layout and stay solid.
  const overlaySurface = dark ? 'rgba(13, 17, 23, 0.96)' : 'rgba(246, 248, 250, 0.96)';
  const border = dark ? '#30363d' : '#d0d7de';
  const headerInk = dark ? '#8b949e' : '#57606a';
  const inkColor = dark ? '#e6edf3' : '#1f2328';
  const doc = container.ownerDocument;

  // One identity, two placements: the same editor window everywhere —
  // same tone, same inner behaviour — floating with rounded corners and
  // a shadow in the report, flush and square in the split view.
  const panel = doc.createElement('div');
  panel.className = 'ggpbi-code-view';
  panel.style.cssText = (options.docked
    ? [
      'position:relative', 'width:100%', 'height:100%',
      'display:flex', 'flex-direction:column',
      `background-color:${overlaySurface}`,
      `border-right:1px solid ${border}`,
      'overflow:hidden',
    ]
    : [
      'position:absolute',
      'top:8px', 'left:8px', 'right:8px',
      // A fixed-height editor window, like the docked pane — not a box
      // that grows with its content. Read-only overlays size themselves.
      ...(options.onApply ? ['height:45%', 'min-height:180px'] : ['max-height:calc(100% - 16px)']),
      'display:flex', 'flex-direction:column',
      `background-color:${overlaySurface}`,
      `border:1px solid ${border}`,
      'border-radius:6px',
      'box-shadow:0 2px 8px rgba(0,0,0,0.15)',
      'z-index:10',
      'overflow:hidden',
      // The chart underneath stays interactive except where the panel is.
      'pointer-events:auto',
    ]).join(';');

  // --- Header: what this is, and a way to take the text with you ---
  const header = doc.createElement('div');
  header.style.cssText = [
    'display:flex', 'align-items:center', 'justify-content:space-between',
    'gap:8px', 'padding:6px 10px',
    `border-bottom:1px solid ${border}`,
    `color:${headerInk}`,
    'font:600 11px/1.4 "Segoe UI",sans-serif',
    'flex:0 0 auto',
  ].join(';');

  const title = doc.createElement('span');
  title.textContent = options.edited ? 'ggpbi code (edited)' : 'ggpbi code';
  header.appendChild(title); // the mode badge lives in the status bar below

  const actions = doc.createElement('span');
  actions.style.cssText = 'display:flex;gap:6px;align-items:center';

  // One size everywhere: an explicit font, not `inherit` — the header and
  // the footer set different type, and buttons must not follow either.
  const button = (label: string): HTMLButtonElement => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = [
      'cursor:pointer', 'padding:2px 8px', 'min-width:56px',
      'background-color:transparent', `border:1px solid ${border}`,
      'border-radius:4px', `color:${headerInk}`,
      'font:600 11px/1.4 "Segoe UI",sans-serif', 'text-align:center',
    ].join(';');
    return b;
  };

  const syntax: CodeSyntax = options.syntax ?? 'ggpbi';

  // A small flat icon cluster top-right, the way code blocks do it:
  // copy (⧉ → ✓ on success), then close. Copy takes whatever is
  // currently in the block — including an edit in progress; the editable
  // branch below points this at the editor.
  let currentText = (): string => code;
  const iconButton = (glyph: string, label: string): HTMLButtonElement => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = glyph;
    b.setAttribute('aria-label', label);
    b.title = label;
    b.style.cssText = [
      'cursor:pointer', 'padding:0', 'width:18px', 'height:18px',
      'line-height:18px', 'text-align:center',
      'background-color:transparent', 'border:none', 'border-radius:3px',
      `color:${headerInk}`, 'font:11px/18px "Segoe UI",sans-serif',
    ].join(';');
    b.addEventListener('mouseenter', () => { b.style.backgroundColor = border; });
    b.addEventListener('mouseleave', () => { b.style.backgroundColor = 'transparent'; });
    return b;
  };
  const copyBtn = iconButton('⧉', 'Copy code');
  copyBtn.classList.add('ggpbi-copy');
  copyBtn.addEventListener('click', () => {
    void copyText(container, currentText()).then((ok) => {
      copyBtn.textContent = ok ? '✓' : '⧉';
      copyBtn.title = ok ? 'Copied' : 'Select the text and press Ctrl+C';
      setTimeout(() => { copyBtn.textContent = '⧉'; copyBtn.title = 'Copy code'; }, 2000);
    });
  });
  actions.appendChild(copyBtn);

  if (options.onClose) {
    // Window-manager sized: a small flat glyph next to copy.
    const closeBtn = iconButton('✕', 'Hide code');
    closeBtn.addEventListener('click', options.onClose);
    actions.appendChild(closeBtn);
  }
  header.appendChild(actions);
  panel.appendChild(header);

  // --- Error strip: parse feedback while editing ---
  const errorBar = doc.createElement('div');
  errorBar.className = 'ggpbi-code-error';
  errorBar.style.cssText = [
    'display:none', 'padding:5px 12px', 'flex:0 0 auto',
    `border-bottom:1px solid ${border}`,
    `color:${dark ? '#ff7b72' : '#cf222e'}`,
    'font:11px/1.4 "Segoe UI",sans-serif',
    'white-space:pre-wrap',
  ].join(';');
  panel.appendChild(errorBar);

  // --- Read-only: a plain highlighted <pre>, no editor machinery ---
  if (!options.onApply) {
    const pre = doc.createElement('pre');
    pre.style.cssText = [
      'margin:0', 'padding:10px 12px', 'overflow:auto', 'flex:1 1 auto',
      'font:12px/1.55 "Cascadia Code",Consolas,"SF Mono",Menlo,monospace',
      `color:${colors.plain}`,
      'white-space:pre', 'tab-size:2',
      // Selectable so Ctrl+C works when the clipboard API is blocked.
      'user-select:text', '-webkit-user-select:text',
    ].join(';');
    const codeEl = doc.createElement('code');
    const tokenize = TOKENIZERS[syntax];
    for (const token of tokenize(code)) {
      const span = doc.createElement('span');
      span.textContent = token.text;
      span.style.color = colors[token.kind];
      codeEl.appendChild(span);
    }
    pre.appendChild(codeEl);
    panel.appendChild(pre);
    container.appendChild(panel);
    return panel;
  }

  // --- Editable: CodeMirror, with vim as a switchable layer ---
  const onApply = options.onApply;
  const vimEffective = (): boolean => vimSessionOverride ?? options.vimDefault ?? false;

  const host = doc.createElement('div');
  // The editor owns the scrolling in both placements, so its bars sit at
  // the window's edges however little code there is.
  host.style.cssText = 'overflow:hidden;flex:1 1 auto';

  // --- Status bar: flat, VS-Code-style — text you can click, no chrome ---
  const statusBar = doc.createElement('div');
  statusBar.className = 'ggpbi-code-status';
  statusBar.style.cssText = [
    'display:flex', 'align-items:center', 'justify-content:space-between',
    'gap:4px', 'padding:2px 10px', 'flex:0 0 auto',
    `border-top:1px solid ${border}`,
    `color:${headerInk}`,
    // Two points below the editor type — a status bar, not a code line.
    'font:10px/1.6 "Cascadia Code",Consolas,"SF Mono",Menlo,monospace',
  ].join(';');
  const statusLeft = doc.createElement('span');
  statusLeft.style.cssText = 'display:flex;gap:10px;align-items:center';
  const statusRight = doc.createElement('span');
  statusRight.style.cssText = 'display:flex;gap:12px;align-items:center';
  statusBar.appendChild(statusLeft);
  statusBar.appendChild(statusRight);

  const statusItem = (label: string, title: string): HTMLSpanElement => {
    const item = doc.createElement('span');
    item.textContent = label;
    item.title = title;
    item.setAttribute('role', 'button');
    item.tabIndex = 0;
    item.style.cssText = 'cursor:pointer;user-select:none';
    return item;
  };

  const showError = (message: string): void => {
    errorBar.textContent = message;
    errorBar.style.display = '';
  };

  /**
   * Modal editing applies by itself: whenever the editor is (back) in
   * normal mode with changed text, the chart follows — Esc after typing,
   * or any normal-mode edit (dd, x, p, u). In normal mode, what you see
   * is what the chart is. Errors show in the strip and keep the text.
   * The plain editor keeps its explicit Apply/Cancel instead.
   */
  const autoApply = (): void => {
    const text = editor.getText();
    if (text === code) return;
    vimCaretMemory = editor.getCursor();
    vimModeMemory = lastMode === 'insert' ? 'insert' : undefined;
    const error = onApply(text);
    if (error) showError(error);
    // On success the caller re-renders; caret and mode memory survive
    // into the rebuilt panel.
  };

  // The idle window: vim edits apply themselves, but only once the
  // keyboard has been quiet for a moment — an update per keystroke would
  // make writing impossible. Any further edit restarts the clock.
  const IDLE_APPLY_MS = 2000;
  let applyTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleApply = (): void => {
    if (applyTimer !== undefined) clearTimeout(applyTimer);
    applyTimer = setTimeout(() => { applyTimer = undefined; autoApply(); }, IDLE_APPLY_MS);
  };
  const cancelScheduledApply = (): void => {
    if (applyTimer !== undefined) clearTimeout(applyTimer);
    applyTimer = undefined;
  };

  // Left, vim's own statusline spot: the mode — itself a control: click
  // NORMAL to start typing, click INSERT to step back out. The on/off
  // toggle and the language selection live on the right.
  const modeItem = statusItem('', 'Click to switch between INSERT and NORMAL');
  modeItem.classList.add('ggpbi-vim-mode');
  modeItem.style.display = 'none';
  statusLeft.appendChild(modeItem);

  // Type zoom as visible controls — shortcuts and Ctrl+wheel work too,
  // but hosts and layouts steal them; a click cannot be stolen.
  const zoomOutItem = statusItem('A−', 'Smaller type (Ctrl+-)');
  zoomOutItem.classList.add('ggpbi-zoom-out');
  const zoomInItem = statusItem('A+', 'Larger type (Ctrl++, Ctrl+0 resets)');
  zoomInItem.classList.add('ggpbi-zoom-in');

  const vimToggleItem = statusItem('vim-mode: off', 'Toggle vim editing (Ctrl+M)');
  vimToggleItem.classList.add('ggpbi-vim-toggle');

  let lastMode = 'normal';
  const setBadge = (mode: string): void => {
    lastMode = mode;
    modeItem.textContent = `-- ${mode.toUpperCase()} --`;
  };

  const setVimUi = (on: boolean): void => {
    vimToggleItem.textContent = on ? 'vim-mode: on' : 'vim-mode: off';
    vimToggleItem.setAttribute('aria-pressed', String(on));
    modeItem.style.display = on ? '' : 'none';
    if (on) setBadge(lastMode);
  };

  let vimActive = vimEffective();
  const toggleVim = (): void => {
    vimSessionOverride = !vimEffective();
    vimActive = vimSessionOverride;
    if (vimSessionOverride) lastMode = 'normal';
    else cancelScheduledApply();
    editor.setVim(vimSessionOverride);
    setVimUi(vimSessionOverride);
    // The pane keeps the durable copy — the item and Ctrl+M both persist.
    options.onVimChange?.(vimSessionOverride);
  };
  vimToggleItem.addEventListener('click', () => toggleVim());
  modeItem.addEventListener('click', () => {
    if (lastMode === 'insert') editor.exitInsert();
    else editor.enterInsert();
  });

  // Right: Cancel/Apply while the text differs, and the language — a
  // select dressed as plain text, so the click opens a native menu.
  const cancelItem = statusItem('Cancel', 'Discard the change');
  const applyItem = statusItem('Apply', 'Apply the change to the chart');
  applyItem.style.fontWeight = '700';
  cancelItem.style.display = 'none';
  applyItem.style.display = 'none';
  statusRight.appendChild(cancelItem);
  statusRight.appendChild(applyItem);
  statusRight.appendChild(zoomOutItem);
  statusRight.appendChild(zoomInItem);
  statusRight.appendChild(vimToggleItem);

  if (options.onSyntaxChange) {
    // All three languages, always visible, the active one emphasised —
    // a segmented switch of plain words, not a dropdown. Set a little
    // apart from the vim toggle: two controls, one gap apart.
    const languages = doc.createElement('span');
    languages.className = 'ggpbi-syntax-switch';
    languages.setAttribute('role', 'radiogroup');
    languages.setAttribute('aria-label', 'Code language');
    languages.style.cssText = 'display:flex;gap:8px;align-items:center;margin-left:10px';
    for (const dialect of SYNTAX_CYCLE) {
      const item = statusItem(dialect, `Show the code as ${dialect}`);
      item.classList.add('ggpbi-syntax-option');
      item.setAttribute('role', 'radio');
      const active = dialect === syntax;
      item.setAttribute('aria-checked', String(active));
      item.style.fontWeight = active ? '700' : '400';
      item.style.color = active ? inkColor : headerInk;
      if (!active) {
        item.addEventListener('click', () => options.onSyntaxChange!(dialect));
      }
      languages.appendChild(item);
    }
    statusRight.appendChild(languages);
  }

  const editor: CmEditor = createCmEditor(host, {
    code,
    tokenColors: colors,
    ink: inkColor,
    dark,
    fillHost: true,
    // Suggestions while typing, per dialect — including the well fields
    // where a column belongs; the report-file JSON has none.
    completions: syntax === 'ggpbi' ? createGgpbiCompletions(options.fields)
      : syntax === 'ggplot2' ? createGgplot2Completions(options.fields)
        : undefined,
    fontSize: editorFontSize,
    onFontSizeChange: (px) => { editorFontSize = px; },
    tokenize: TOKENIZERS[syntax],
    inertLine: INERT[syntax],
    vimEnabled: vimEffective(),
    onVimModeChange: setBadge,
    onDocChange: () => {
      const dirty = editor.getText() !== code;
      cancelItem.style.display = dirty ? '' : 'none';
      applyItem.style.display = dirty ? '' : 'none';
      errorBar.style.display = 'none';
      // The idle clock ticks for every vim edit, insert mode included —
      // pausing to look is what applies the chart.
      if (vimActive && dirty) scheduleApply();
    },
    onAutoApply: scheduleApply,
    onToggleVim: toggleVim,
  });
  currentText = () => editor.getText();
  zoomOutItem.addEventListener('click', () => editor.zoom(-1));
  zoomInItem.addEventListener('click', () => editor.zoom(1));
  setVimUi(vimEffective());

  applyItem.addEventListener('click', () => {
    const error = onApply(editor.getText());
    if (error) showError(error);
    // On success the caller re-renders and this panel is rebuilt.
  });
  cancelItem.addEventListener('click', () => {
    editor.setText(code);
  });

  panel.appendChild(host);
  panel.appendChild(statusBar);
  container.appendChild(panel);

  // An auto-apply rebuilt this panel mid-edit: put the cursor back and —
  // now that the editor is in the document — give the keyboard back too.
  if (vimCaretMemory !== undefined) {
    editor.setCursor(Math.min(vimCaretMemory, code.length));
    vimCaretMemory = undefined;
    editor.focus();
  }
  // An idle apply must not kick the writer out of insert mode.
  if (vimEffective() && vimModeMemory === 'insert') {
    editor.enterInsert();
    vimModeMemory = undefined;
  }

  return panel;
}

/**
 * Copy via the async clipboard, falling back to a selection + execCommand.
 *
 * Power BI runs visuals in a sandboxed iframe that often withholds
 * clipboard-write permission, so the button has to survive being told no.
 */
async function copyText(container: HTMLElement, text: string): Promise<boolean> {
  try {
    const clipboard = (container.ownerDocument.defaultView as any)?.navigator?.clipboard;
    if (clipboard?.writeText) {
      await clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied — fall through to the legacy path.
  }
  try {
    const doc = container.ownerDocument;
    const area = doc.createElement('textarea');
    area.value = text;
    area.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    doc.body.appendChild(area);
    area.select();
    const ok = doc.execCommand?.('copy') ?? false;
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
