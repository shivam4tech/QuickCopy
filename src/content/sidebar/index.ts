import type { Root } from 'react-dom/client';
import { SIDEBAR_ID } from '@shared/constants';
import { logger } from '@utils/logger';

const SIDEBAR_EXPAND_EVENT = 'quickcopy:sidebar:set-expanded';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

export async function mountSidebar(onClose?: () => void): Promise<void> {
  if (container) {
    logger.debug('Sidebar already mounted');
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
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
  `;
  shadow.appendChild(resetStyle);

  const mountPoint = document.createElement('div');
  mountPoint.id = 'quickcopy-sidebar-root';
  shadow.appendChild(mountPoint);

  document.body.appendChild(container);

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

export function isSidebarMounted(): boolean {
  return container !== null && document.body.contains(container);
}

export function setSidebarExpanded(expanded: boolean): void {
  window.dispatchEvent(new CustomEvent(SIDEBAR_EXPAND_EVENT, { detail: expanded }));
}
