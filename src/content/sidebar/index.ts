import type { Root } from 'react-dom/client';
import { SIDEBAR_ID } from '@shared/constants';
import { logger } from '@utils/logger';
import { browserMessaging } from '@compat/messaging';
import { settingsService } from '@services/SettingsService';
import { eventBus } from '@utils/eventBus';
import { createThemeApplier } from '@utils/theme';
import type { DiagnosticLogMessage, MessageResponse } from '@type/messages';

import { SIDEBAR_THEME_TOKENS, SIDEBAR_THEME_TOKENS_LIGHT } from '@styles/sidebarTokens';

const SIDEBAR_EXPAND_EVENT = 'ekadanta:sidebar:set-expanded';

let root: Root | null = null;
let container: HTMLDivElement | null = null;
/** devicePixelRatio at mount — browser zoom mutates it, so it doubles as the zoom factor. */
let zoomBaseDpr = 1;
let zoomResizeHandler: (() => void) | null = null;

export async function mountSidebar(onClose?: () => void, options?: { persistent?: boolean }): Promise<void> {
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

    #ekadanta-sidebar-root {
      pointer-events: auto;
    }
  `;
  shadow.appendChild(resetStyle);

  const mountPoint = document.createElement('div');
  mountPoint.id = 'ekadanta-sidebar-root';
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
    persistent: options?.persistent === true,
  }));

  // Counter-scale the panel when the host page is browser-zoomed (devicePixel
  // Ratio multiplies with the zoom factor) so it keeps its designed size
  // instead of ballooning with the page. `zoom` scales rendering without
  // creating a containing block, so the fixed-position panel stays put.
  zoomBaseDpr = window.devicePixelRatio || 1;
  zoomResizeHandler = () => {
    if (!container) return;
    const dpr = window.devicePixelRatio || 1;
    const ratio = zoomBaseDpr / dpr;
    (container.style as CSSStyleDeclaration & { zoom?: string }).zoom = ratio === 1 ? '' : String(ratio);
  };
  window.addEventListener('resize', zoomResizeHandler);

  logger.info('Sidebar mounted');
}

export function unmountSidebar(): void {
  if (zoomResizeHandler) {
    window.removeEventListener('resize', zoomResizeHandler);
    zoomResizeHandler = null;
  }

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
  // Already the last child: appending again would remove and re-insert the
  // host, which restarts the panel's entrance animation — visibly a second
  // "load" of the side panel.
  const parent = container.parentNode;
  if (parent && parent.lastChild === container) return;
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

  console.log(`[Ekadanta:diag] Sidebar raised to top`, payload);
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
