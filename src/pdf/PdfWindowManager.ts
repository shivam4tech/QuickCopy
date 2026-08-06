import { logger, getErrorMessage } from '@utils/logger';

/**
 * Opens the QuickCopy PDF capture window for a tab, and keeps a single
 * window per tab (re-opening focuses the existing window instead of
 * spawning duplicates).
 */
export class PdfWindowManager {
  private readonly windowsByTab = new Map<number, number>();
  private readonly tabsByWindow = new Map<number, number>();

  constructor() {
    chrome.windows.onRemoved.addListener((windowId) => {
      const tabId = this.tabsByWindow.get(windowId);
      if (tabId == null) return;
      this.windowsByTab.delete(tabId);
      this.tabsByWindow.delete(windowId);
      logger.info('PDF capture window closed', { tabId, windowId });
    });
  }

  isOpenForTab(tabId: number): boolean {
    return this.windowsByTab.has(tabId);
  }

  async openForTab(tabId: number, pdfUrl: string): Promise<void> {
    const existing = this.windowsByTab.get(tabId);
    if (existing != null) {
      try {
        await chrome.windows.update(existing, { focused: true });
        return;
      } catch (err) {
        logger.warn('Failed to focus existing PDF window, reopening', getErrorMessage(err));
        this.windowsByTab.delete(tabId);
      }
    }

    const pageUrl = `${chrome.runtime.getURL('src/pdf/window.html')}?url=${encodeURIComponent(pdfUrl)}`;
    try {
      const win = await chrome.windows.create({
        url: pageUrl,
        type: 'popup',
        width: 1080,
        height: 760,
        focused: true,
      });
      if (win.id == null) return;
      this.windowsByTab.set(tabId, win.id);
      this.tabsByWindow.set(win.id, tabId);
      logger.info('PDF capture window opened', { tabId, windowId: win.id });
    } catch (err) {
      logger.error('Failed to open PDF capture window', err);
    }
  }
}

export const pdfWindowManager = new PdfWindowManager();
