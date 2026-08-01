import type { Root } from 'react-dom/client';
import { SIDEBAR_ID } from '@shared/constants';
import { logger } from '@utils/logger';
import { browserMessaging } from '@compat/messaging';
import type { DiagnosticLogMessage, MessageResponse } from '@type/messages';

const SIDEBAR_EXPAND_EVENT = 'quickcopy:sidebar:set-expanded';

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
