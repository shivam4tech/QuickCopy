import { logger } from '@utils/logger';

function getBrowserAPI(): typeof chrome {
  if (typeof chrome !== 'undefined') return chrome;
  if (typeof browser !== 'undefined') return browser as typeof chrome;
  throw new Error('No browser API detected');
}

function getTabs(): typeof chrome.tabs {
  return getBrowserAPI().tabs;
}

export const browserTabs = {
  async query(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
    try {
      const tabs = getTabs();
      return await tabs.query(queryInfo);
    } catch (error) {
      logger.error('tabs.query failed', error);
      throw error;
    }
  },

  async getCurrent(): Promise<chrome.tabs.Tab | null> {
    try {
      const tabs = getTabs();
      const tab = await tabs.getCurrent();
      return tab ?? null;
    } catch (error) {
      logger.error('tabs.getCurrent failed', error);
      return null;
    }
  },

  async getActive(): Promise<chrome.tabs.Tab | null> {
    try {
      const tabs = getTabs();
      const results = await tabs.query({ active: true, currentWindow: true });
      return results[0] ?? null;
    } catch (error) {
      logger.error('tabs.getActive failed', error);
      return null;
    }
  },

  async sendMessage<T>(tabId: number, message: unknown): Promise<T> {
    try {
      const tabs = getTabs();
      const result = await tabs.sendMessage(tabId, message);
      return result as T;
    } catch (error) {
      logger.error('tabs.sendMessage failed', error);
      throw error;
    }
  },

  async captureVisibleTab(windowId?: number): Promise<string> {
    try {
      const tabs = getTabs();
      const wId = windowId ?? chrome.windows.WINDOW_ID_CURRENT;
      return await tabs.captureVisibleTab(wId, { format: 'png' });
    } catch (error) {
      logger.error('tabs.captureVisibleTab failed', error);
      throw error;
    }
  },

  async executeScript(tabId: number, details: chrome.tabs.InjectDetails): Promise<unknown[]> {
    try {
      const tabs = getTabs();
      return await tabs.executeScript(tabId, details);
    } catch (error) {
      logger.error('tabs.executeScript failed', error);
      throw error;
    }
  },
};
