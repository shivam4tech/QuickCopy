import {
  LANGUAGES,
  TESSDATA_BASE_URL,
  getLanguageByCode,
  type LanguageEntry,
  type InstalledLanguage,
} from '@type/language';

const IDB_NAME = 'keyval-store';
const IDB_STORE = 'keyval';

export type { InstalledLanguage };

export interface DownloadProgress {
  status: 'downloading' | 'complete' | 'error';
  progress: number;
  error?: string;
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
  });
}

async function idbGet(key: string): Promise<unknown> {
  const db = await openIdb();
  try {
    return await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('indexedDB get failed'));
    });
  } finally {
    db.close();
  }
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openIdb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('indexedDB put failed'));
      tx.onabort = () => reject(tx.error ?? new Error('indexedDB put aborted'));
    });
  } finally {
    db.close();
  }
}

async function idbDelete(key: string): Promise<void> {
  const db = await openIdb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('indexedDB delete failed'));
    });
  } finally {
    db.close();
  }
}

export class LanguageManager {
  private static instance: LanguageManager;
  private downloadAbort: AbortController | null = null;

  private constructor() {}

  static getInstance(): LanguageManager {
    if (!LanguageManager.instance) {
      LanguageManager.instance = new LanguageManager();
    }
    return LanguageManager.instance;
  }

  getAvailableLanguages(): LanguageEntry[] {
    return LANGUAGES;
  }

  async getInstalledLanguages(): Promise<InstalledLanguage[]> {
    try {
      const stored = await idbGet('installed-languages');
      if (stored && typeof stored === 'object') {
        return Object.values(stored) as InstalledLanguage[];
      }
    } catch {
      // ignore
    }
    return [];
  }

  async isLanguageInstalled(code: string): Promise<boolean> {
    const installed = await this.getInstalledLanguages();
    return installed.some((l) => l.code === code);
  }

  async getActiveLanguageString(secondaryCode: string | null): Promise<string> {
    if (!secondaryCode || secondaryCode === 'eng') {
      return 'eng';
    }
    const installed = await this.isLanguageInstalled(secondaryCode);
    if (!installed) {
      return 'eng';
    }
    return `eng+${secondaryCode}`;
  }

  async downloadLanguage(
    code: string,
    onProgress?: (progress: DownloadProgress) => void,
  ): Promise<boolean> {
    const lang = getLanguageByCode(code);
    if (!lang) {
      onProgress?.({ status: 'error', progress: 0, error: 'Language not found' });
      return false;
    }

    if (await this.isLanguageInstalled(code)) {
      onProgress?.({ status: 'complete', progress: 100 });
      return true;
    }

    this.downloadAbort = new AbortController();

    try {
      const url = `${TESSDATA_BASE_URL}${code}.traineddata`;
      onProgress?.({ status: 'downloading', progress: 0 });

      const response = await fetch(url, { signal: this.downloadAbort.signal });
      if (!response.ok) {
        onProgress?.({ status: 'error', progress: 0, error: `Download failed (${response.status})` });
        return false;
      }

      const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10);
      const reader = response.body?.getReader();
      if (!reader) {
        onProgress?.({ status: 'error', progress: 0, error: 'No response body' });
        return false;
      }

      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (contentLength > 0) {
            const pct = Math.round((received / contentLength) * 100);
            onProgress?.({ status: 'downloading', progress: pct });
          }
        }
      }

      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const data = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
      }

      await this.storeLanguage(code, data);

      console.log(`[Language] Downloaded ${code} (${totalLength} bytes)`);
      onProgress?.({ status: 'complete', progress: 100 });
      return true;
    } catch (err) {
      if (this.downloadAbort?.signal.aborted) {
        onProgress?.({ status: 'error', progress: 0, error: 'Download cancelled' });
      } else {
        console.error(`[Language] Download failed for ${code}`, err);
        onProgress?.({ status: 'error', progress: 0, error: (err as Error).message ?? 'Unknown error' });
      }
      return false;
    } finally {
      this.downloadAbort = null;
    }
  }

  cancelDownload(): void {
    this.downloadAbort?.abort();
  }

  /**
   * Store traineddata for a language (marks it installed).
   * Used by downloadLanguage and by content scripts syncing the
   * extension-level store into their page-local IndexedDB.
   */
  async storeLanguage(code: string, data: Uint8Array): Promise<void> {
    const key = `./${code}.traineddata`;
    await idbPut(key, data);

    const installed = await this.getInstalledLanguages();
    const updated = installed.filter((l) => l.code !== code);
    updated.push({ code, installedAt: Date.now(), size: data.length });
    const record: Record<string, InstalledLanguage> = {};
    for (const l of updated) {
      record[l.code] = l;
    }
    await idbPut('installed-languages', record);
  }

  async removeLanguage(code: string): Promise<void> {
    const key = `./${code}.traineddata`;
    await idbDelete(key);

    const installed = await this.getInstalledLanguages();
    const updated = installed.filter((l) => l.code !== code);
    const record: Record<string, InstalledLanguage> = {};
    for (const l of updated) {
      record[l.code] = l;
    }
    await idbPut('installed-languages', record);

    console.log(`[Language] Removed ${code}`);
  }

  async getTraineddata(code: string): Promise<Uint8Array | null> {
    const key = `./${code}.traineddata`;
    const data = await idbGet(key);
    return data instanceof Uint8Array ? data : null;
  }
}

export const languageManager = LanguageManager.getInstance();
