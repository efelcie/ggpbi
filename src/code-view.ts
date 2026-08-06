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
 */
import { highlight, type TokenKind } from './codegen';
import type { ResolvedTheme } from './theme';

/** Colours per token kind, for a light and a dark surface. */
const PALETTE: Record<'light' | 'dark', Record<TokenKind, string>> = {
  light: {
    plain: '#6a737d',
    call: '#6f42c1',
    string: '#032f62',
    number: '#005cc5',
    keyword: '#d73a49',
    property: '#22863a',
    punct: '#586069',
  },
  dark: {
    plain: '#8b949e',
    call: '#d2a8ff',
    string: '#a5d6ff',
    number: '#79c0ff',
    keyword: '#ff7b72',
    property: '#7ee787',
    punct: '#8b949e',
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

export interface CodeViewOptions {
  /** Called when the close button is pressed (browser demo only). */
  onClose?: () => void;
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
  const border = dark ? '#30363d' : '#d0d7de';
  const headerInk = dark ? '#8b949e' : '#57606a';

  const panel = container.ownerDocument.createElement('div');
  panel.className = 'ggpbi-code-view';
  panel.style.cssText = [
    'position:absolute',
    'top:8px', 'left:8px', 'right:8px',
    'max-height:calc(100% - 16px)',
    'display:flex', 'flex-direction:column',
    `background-color:${surface}`,
    `border:1px solid ${border}`,
    'border-radius:6px',
    'box-shadow:0 2px 8px rgba(0,0,0,0.15)',
    'z-index:10',
    'overflow:hidden',
    // The chart underneath stays interactive except where the panel is.
    'pointer-events:auto',
  ].join(';');

  // --- Header: what this is, and a way to take the text with you ---
  const header = container.ownerDocument.createElement('div');
  header.style.cssText = [
    'display:flex', 'align-items:center', 'justify-content:space-between',
    'gap:8px', 'padding:6px 10px',
    `border-bottom:1px solid ${border}`,
    `color:${headerInk}`,
    'font:600 11px/1.4 "Segoe UI",sans-serif',
    'flex:0 0 auto',
  ].join(';');

  const title = container.ownerDocument.createElement('span');
  title.textContent = 'ggpbi code';
  header.appendChild(title);

  const actions = container.ownerDocument.createElement('span');
  actions.style.cssText = 'display:flex;gap:6px;align-items:center';

  const button = (label: string): HTMLButtonElement => {
    const b = container.ownerDocument.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = [
      'cursor:pointer', 'padding:2px 8px',
      'background-color:transparent', `border:1px solid ${border}`,
      'border-radius:4px', `color:${headerInk}`,
      'font:inherit',
    ].join(';');
    return b;
  };

  const copyBtn = button('Copy');
  copyBtn.addEventListener('click', () => {
    void copyText(container, code).then((ok) => {
      copyBtn.textContent = ok ? 'Copied' : 'Press Ctrl+C';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    });
  });
  actions.appendChild(copyBtn);

  if (options.onClose) {
    const closeBtn = button('✕');
    closeBtn.setAttribute('aria-label', 'Hide code');
    closeBtn.addEventListener('click', options.onClose);
    actions.appendChild(closeBtn);
  }
  header.appendChild(actions);
  panel.appendChild(header);

  // --- The code itself ---
  const pre = container.ownerDocument.createElement('pre');
  pre.style.cssText = [
    'margin:0', 'padding:10px 12px', 'overflow:auto', 'flex:1 1 auto',
    'font:12px/1.55 "Cascadia Code",Consolas,"SF Mono",Menlo,monospace',
    `color:${colors.plain}`,
    'white-space:pre', 'tab-size:2',
    // Selectable so Ctrl+C works when the clipboard API is blocked.
    'user-select:text', '-webkit-user-select:text',
  ].join(';');

  const codeEl = container.ownerDocument.createElement('code');
  for (const token of highlight(code)) {
    const span = container.ownerDocument.createElement('span');
    span.textContent = token.text;
    span.style.color = colors[token.kind];
    codeEl.appendChild(span);
  }
  pre.appendChild(codeEl);
  panel.appendChild(pre);

  container.appendChild(panel);
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
