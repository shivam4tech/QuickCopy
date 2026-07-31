import { logger } from '@utils/logger';

type StorageArea = 'local' | 'sync' | 'session';

function getBrowserAPI(): typeof chrome {
  if (typeof chrome !== 'undefined') return chrome;
  if (typeof browser !== 'undefined') return browser as typeof chrome;
  throw new Error('No browser API detected');
}

function getStorageArea(area: StorageArea): chrome.storage.StorageArea {
  const api = getBrowserAPI();
  switch (area) {
    case 'local': return api.storage.local;
    case 'sync': return api.storage.sync;
    case 'session': return api.storage.session;
  }
}

export const browserStorage = {
  async get<T>(
    keys: string | string[] | Record<string, unknown> | null | undefined,
    area: StorageArea = 'local',
  ): Promise<Record<string, T>> {
    try {
      const storage = getStorageArea(area);
      const result = await storage.get(keys);
      return result as Record<string, T>;
    } catch (error) {
      logger.error('Storage get failed', error);
      throw error;
    }
  },

  async set<T>(items: Record<string, T>, area: StorageArea = 'local'): Promise<void> {
    try {
      const storage = getStorageArea(area);
      await storage.set(items);
    } catch (error) {
      logger.error('Storage set failed', error);
      throw error;
    }
  },

  async remove(keys: string | string[], area: StorageArea = 'local'): Promise<void> {
    try {
      const storage = getStorageArea(area);
      await storage.remove(keys);
    } catch (error) {
      logger.error('Storage remove failed', error);
      throw error;
    }
  },

  async clear(area: StorageArea = 'local'): Promise<void> {
    try {
      const storage = getStorageArea(area);
      await storage.clear();
    } catch (error) {
      logger.error('Storage clear failed', error);
      throw error;
    }
  },

  onChanged(
    callback: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void,
  ): () => void {
    try {
      const api = getBrowserAPI();
      const listener = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string,
      ) => {
        callback(changes, areaName);
      };
      api.storage.onChanged.addListener(listener);
      return () => {
        api.storage.onChanged.removeListener(listener);
      };
    } catch {
      logger.warn('No browser API for storage.onChanged');
      return () => {};
    }
  },
};
