import { logger } from '@utils/logger';

type MenuOnClickHandler = (
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
) => void | Promise<void>;

function getBrowserAPI(): typeof chrome {
  if (typeof chrome !== 'undefined') return chrome;
  if (typeof browser !== 'undefined') return browser as typeof chrome;
  throw new Error('No browser API detected');
}

function getContextMenus(): typeof chrome.contextMenus {
  return getBrowserAPI().contextMenus;
}

function getLastError(): Error | undefined {
  const err = chrome.runtime.lastError;
  return err ? new Error(err.message) : undefined;
}

export const browserContextMenus = {
  create(
    createProperties: chrome.contextMenus.CreateProperties,
    callback?: () => void,
  ): string | number | undefined {
    try {
      const menus = getContextMenus();
      return menus.create(createProperties, callback);
    } catch (error) {
      logger.error('contextMenus.create failed', error);
      return undefined;
    }
  },

  remove(menuItemId: string | number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const menus = getContextMenus();
        menus.remove(menuItemId, () => {
          const err = getLastError();
          if (err) reject(err);
          else resolve();
        });
      } catch (error) {
        logger.error('contextMenus.remove failed', error);
        reject(error);
      }
    });
  },

  removeAll(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const menus = getContextMenus();
        menus.removeAll(() => {
          const err = getLastError();
          if (err) reject(err);
          else resolve();
        });
      } catch (error) {
        logger.error('contextMenus.removeAll failed', error);
        reject(error);
      }
    });
  },

  onClicked(handler: MenuOnClickHandler): () => void {
    const menus = getContextMenus();
    menus.onClicked.addListener(handler);
    return () => {
      menus.onClicked.removeListener(handler);
    };
  },
};
