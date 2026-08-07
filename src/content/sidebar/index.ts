import type { Root } from 'react-dom/client';
import { SIDEBAR_ID } from '@shared/constants';
import { logger } from '@utils/logger';
import { browserMessaging } from '@compat/messaging';
import { settingsService } from '@services/SettingsService';
import { eventBus } from '@utils/eventBus';
import { createThemeApplier } from '@utils/theme';
import type { DiagnosticLogMessage, MessageResponse } from '@type/messages';

const SIDEBAR_EXPAND_EVENT = 'quickcopy:sidebar:set-expanded';

const SIDEBAR_THEME_TOKENS = `
  --color-bg-primary: #0d0f14;
  --color-bg-secondary: #151922;
  --color-bg-tertiary: #1d222c;
  --color-bg-hover: #1a1f29;
  --color-bg-active: #262c38;
  --color-text-primary: #f0f3f8;
  --color-text-secondary: #a3adbb;
  --color-text-muted: #7b8594;
  --color-text-inverse: #0d0f14;
  --color-on-accent: #ffffff;
  --color-border-default: rgba(255, 255, 255, 0.14);
  --color-border-muted: rgba(255, 255, 255, 0.08);
  --color-border-hover: rgba(255, 255, 255, 0.24);
  --color-border-active: #63b0ff;
  --color-accent-primary: #63b0ff;
  --color-accent-success: #4ac26b;
  --color-accent-warning: #e3b341;
  --color-accent-error: #ff6b66;
  --color-accent-info: #8cc5ff;
  --color-accent-success-soft: rgba(74, 194, 107, 0.16);
  --color-accent-warning-soft: rgba(227, 179, 65, 0.16);
  --color-accent-error-soft: rgba(255, 107, 102, 0.14);
  --color-accent-info-soft: rgba(140, 197, 255, 0.14);
  --color-overlay: rgba(3, 5, 9, 0.55);
  --color-shadow: rgba(0, 0, 0, 0.4);
  --glass-bg: rgba(24, 28, 36, 0.62);
  --glass-bg-strong: rgba(32, 37, 46, 0.82);
  --glass-border: rgba(255, 255, 255, 0.16);
  --glass-highlight: rgba(255, 255, 255, 0.22);
  --glass-rim: rgba(0, 0, 0, 0.28);
  --glass-shadow: rgba(0, 0, 0, 0.5);
  --hover-overlay: rgba(255, 255, 255, 0.08);
  --glass-sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.09) 0%, rgba(255, 255, 255, 0.02) 40%, rgba(255, 255, 255, 0.05) 100%);
  --gradient-primary: linear-gradient(180deg, #6cb6ff 0%, #3d93f5 100%);
  --gradient-primary-hover: linear-gradient(180deg, #7cc0ff 0%, #4ea0fa 100%);
  --gradient-primary-active: linear-gradient(180deg, #4a9df6 0%, #2f83dc 100%);
  --gradient-secondary: linear-gradient(180deg, rgba(255, 255, 255, 0.11) 0%, rgba(255, 255, 255, 0.04) 100%);
  --gradient-secondary-hover: linear-gradient(180deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.06) 100%);
  --gradient-secondary-active: linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.02) 100%);
  --gradient-danger: linear-gradient(180deg, #ff706b 0%, #e5484d 100%);
  --btn-primary-shadow: 0 1px 2px rgba(0, 0, 0, 0.35), 0 4px 14px rgba(99, 176, 255, 0.22);
  --btn-primary-shadow-hover: 0 1px 2px rgba(0, 0, 0, 0.35), 0 6px 20px rgba(99, 176, 255, 0.3);
  --focus-ring: rgba(99, 176, 255, 0.35);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.35);
  --shadow-xl: 0 24px 64px rgba(0, 0, 0, 0.6), 0 8px 16px rgba(0, 0, 0, 0.45);
`;

const SIDEBAR_THEME_TOKENS_LIGHT = `
  --color-bg-primary: #f5f7fa;
  --color-bg-secondary: #ffffff;
  --color-bg-tertiary: #e9edf2;
  --color-bg-hover: #edf1f5;
  --color-bg-active: #e2e7ed;
  --color-text-primary: #1c2126;
  --color-text-secondary: #454e57;
  --color-text-muted: #5f6b76;
  --color-text-inverse: #ffffff;
  --color-on-accent: #ffffff;
  --color-border-default: #cfd7e0;
  --color-border-muted: #e3e8ee;
  --color-border-hover: #9fb0c1;
  --color-border-active: #0969da;
  --color-accent-primary: #0969da;
  --color-accent-success: #1a7f37;
  --color-accent-warning: #9a6700;
  --color-accent-error: #cf222e;
  --color-accent-info: #0969da;
  --color-accent-success-soft: rgba(26, 127, 55, 0.12);
  --color-accent-warning-soft: rgba(154, 103, 0, 0.12);
  --color-accent-error-soft: rgba(207, 34, 46, 0.1);
  --color-accent-info-soft: rgba(9, 105, 218, 0.1);
  --color-overlay: rgba(15, 23, 42, 0.35);
  --color-shadow: rgba(15, 23, 42, 0.16);
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-bg-strong: rgba(255, 255, 255, 0.85);
  --glass-border: rgba(15, 23, 42, 0.1);
  --glass-highlight: rgba(255, 255, 255, 0.95);
  --glass-rim: rgba(15, 23, 42, 0.04);
  --glass-shadow: rgba(15, 23, 42, 0.18);
  --hover-overlay: rgba(15, 23, 42, 0.06);
  --glass-sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.4) 38%, rgba(15, 23, 42, 0.03) 100%);
  --gradient-primary: linear-gradient(180deg, #2b8af2 0%, #0969da 100%);
  --gradient-primary-hover: linear-gradient(180deg, #3f97f5 0%, #1474e2 100%);
  --gradient-primary-active: linear-gradient(180deg, #1a76e0 0%, #0758b6 100%);
  --gradient-secondary: linear-gradient(180deg, #ffffff 0%, #f1f4f8 100%);
  --gradient-secondary-hover: linear-gradient(180deg, #ffffff 0%, #e8edf3 100%);
  --gradient-secondary-active: linear-gradient(180deg, #e9eef4 0%, #e2e7ed 100%);
  --gradient-danger: linear-gradient(180deg, #f0594f 0%, #cf222e 100%);
  --btn-primary-shadow: 0 1px 2px rgba(15, 23, 42, 0.18), 0 4px 14px rgba(9, 105, 218, 0.25);
  --btn-primary-shadow-hover: 0 1px 2px rgba(15, 23, 42, 0.18), 0 6px 20px rgba(9, 105, 218, 0.32);
  --focus-ring: rgba(9, 105, 218, 0.28);
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.08);
  --shadow-md: 0 2px 8px rgba(15, 23, 42, 0.1);
  --shadow-lg: 0 8px 24px rgba(15, 23, 42, 0.1), 0 2px 6px rgba(15, 23, 42, 0.06);
  --shadow-xl: 0 24px 64px rgba(15, 23, 42, 0.14), 0 8px 16px rgba(15, 23, 42, 0.08);
`;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

export async function mountSidebar(onClose?: () => void): Promise<void> {
  if (container) {
    logger.debug('Sidebar already mounted');
    raiseSidebarToTop();
    return;
  }

  const { createRoot } = await import('react-dom/client');
  const { Sidebar } = await import('./Sidebar');

  container = document.createElement('div');
  container.id = SIDEBAR_ID;

  const shadow = container.attachShadow({ mode: 'closed' });

  const resetStyle = document.createElement('style');
  resetStyle.textContent = `
    :host {
      all: initial;
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      z-index: 2147483647;
      color-scheme: dark;
      ${SIDEBAR_THEME_TOKENS}
    }

    :host([data-theme='light']) {
      color-scheme: light;
      ${SIDEBAR_THEME_TOKENS_LIGHT}
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    #quickcopy-sidebar-root {
      pointer-events: auto;
    }
  `;
  shadow.appendChild(resetStyle);

  const mountPoint = document.createElement('div');
  mountPoint.id = 'quickcopy-sidebar-root';
  mountPoint.style.pointerEvents = 'auto';
  shadow.appendChild(mountPoint);

  document.documentElement.appendChild(container);

  const applyTheme = createThemeApplier(() => container);
  void settingsService.getAll().then((s) => applyTheme(s.theme));
  eventBus.on('settings:changed', (partial) => {
      if (partial && 'theme' in partial && partial.theme !== undefined) {
        applyTheme(partial.theme);
      }
  });

  const { createElement } = await import('react');
  root = createRoot(mountPoint);
  root.render(createElement(Sidebar, {
    onClose: onClose ?? unmountSidebar,
  }));

  logger.info('Sidebar mounted');
}

export function unmountSidebar(): void {
  if (root) {
    root.unmount();
    root = null;
  }

  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }

  container = null;
  logger.info('Sidebar unmounted');
}

export function raiseSidebarToTop(): void {
  if (!container) return;
  document.documentElement.appendChild(container);
  logStackingContext();
}

function describeElement(el: Element): { tag: string; id: string | null; cls: string | null; position: string; zIndex: string; transform: string | null } {
  const style = getComputedStyle(el);
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    cls: typeof (el as HTMLElement).className === 'string'
      ? ((el as HTMLElement).className as string).split(/\s+/).slice(0, 3).join('.') || null
      : null,
    position: style.position,
    zIndex: style.zIndex,
    transform: style.transform !== 'none' ? style.transform.slice(0, 48) : null,
  };
}

function logStackingContext(): void {
  if (!container) return;

  const path: string[] = [];
  let el: HTMLElement | null = container;
  while (el && el !== document.documentElement) {
    path.push(`${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`);
    el = el.parentElement;
  }

  const overlaySiblings = (root: ParentNode) =>
    Array.from(root.children)
      .map(describeElement)
      .filter((o) => o.position !== 'static' || o.zIndex !== 'auto')
      .slice(-4);

  const hostStyle = getComputedStyle(container);
  const openDialogs = Array.from(document.querySelectorAll('dialog[open]')).map((d) => ({
    ...describeElement(d),
    topLayerNativeDialog: true,
  }));
  const openPopovers = Array.from(document.querySelectorAll('[popover]'))
    .filter((p) => p.matches(':popover-open'))
    .map((p) => ({ ...describeElement(p), topLayerPopover: true }));

  const payload: Record<string, unknown> = {
    hostId: container.id,
    parent: container.parentElement ? `${container.parentElement.tagName.toLowerCase()}${container.parentElement.id ? `#${container.parentElement.id}` : ''}` : null,
    ownerDocIsPage: container.ownerDocument === document,
    domPath: path.join(' > '),
    position: hostStyle.position,
    zIndex: hostStyle.zIndex,
    offsetParent: container.offsetParent ? container.offsetParent.tagName.toLowerCase() : null,
    lastPositionedBodyChildren: overlaySiblings(document.body),
    lastPositionedHtmlChildren: overlaySiblings(document.documentElement),
    openNativeDialogs: openDialogs,
    openPopovers,
  };

  console.log(`[QuickCopy:diag] Sidebar raised to top`, payload);
  const msg: DiagnosticLogMessage = {
    type: 'diag:log',
    source: 'content',
    target: 'background',
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    label: 'Sidebar raised to top',
    payload,
  };
  browserMessaging.sendMessage<MessageResponse>(msg).catch(() => {});
}

export function isSidebarMounted(): boolean {
  return container !== null && document.documentElement.contains(container);
}

export function setSidebarExpanded(expanded: boolean): void {
  window.dispatchEvent(new CustomEvent(SIDEBAR_EXPAND_EVENT, { detail: expanded }));
}
