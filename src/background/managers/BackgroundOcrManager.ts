import type { OcrResult, OcrLanguage } from '@type/index';
import { getErrorMessage, getErrorStack } from '@utils/logger';
import { timeoutOCR, withTimeout } from '@utils/timeout';
import { flattenTesseractBlocks } from '../../services/ocr/geometry';

interface TesseractWorker {
  recognize(image: string, options?: Record<string, unknown>, output?: Record<string, boolean>): Promise<{ data: { text: string; confidence: number; blocks: unknown[] } }>;
  terminate(): Promise<void>;
}

export type BackgroundOcrStatus = 'unavailable' | 'idle' | 'initializing' | 'ready' | 'failed';

const TRAINEDDATA_CACHE_DB = 'keyval-store';
const TRAINEDDATA_CACHE_STORE = 'keyval';

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(TRAINEDDATA_CACHE_DB);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(TRAINEDDATA_CACHE_STORE)) {
        req.result.createObjectStore(TRAINEDDATA_CACHE_STORE);
      }
    };
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TRAINEDDATA_CACHE_STORE, 'readonly');
    const req = tx.objectStore(TRAINEDDATA_CACHE_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB get failed'));
  });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TRAINEDDATA_CACHE_STORE, 'readwrite');
    tx.objectStore(TRAINEDDATA_CACHE_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('indexedDB put failed'));
    tx.onabort = () => reject(tx.error ?? new Error('indexedDB put aborted'));
  });
}

async function seedTraineddataCache(lang: string, langPath: string): Promise<boolean> {
  try {
    const resp = await fetch(`${langPath}${lang}.traineddata`);
    if (!resp.ok) {
      console.warn(`[QuickCopy:Background] traineddata fetch failed (${resp.status})`);
      return false;
    }
    const data = new Uint8Array(await resp.arrayBuffer());
    const key = `./${lang}.traineddata`;
    const db = await idbOpen();
    try {
      const existing = await idbGet(db, key);
      if (existing instanceof Uint8Array && existing.length === data.length) {
        console.log(`[QuickCopy:Background] traineddata already cached (${data.length} bytes)`);
        return true;
      }
      await idbPut(db, key, data);
      console.log(`[QuickCopy:Background] seeded traineddata cache (${data.length} bytes, key="${key}")`);
      return true;
    } finally {
      db.close();
    }
  } catch (err) {
    console.error(`[QuickCopy:Background] traineddata cache seed FAILED`, getErrorMessage(err));
    return false;
  }
}

export class BackgroundOcrManager {
  private static instance: BackgroundOcrManager;
  private worker: TesseractWorker | null = null;
  private status: BackgroundOcrStatus = 'idle';
  private initPromise: Promise<{ success: boolean; reason?: string }> | null = null;

  private constructor() {}

  static getInstance(): BackgroundOcrManager {
    if (!BackgroundOcrManager.instance) {
      BackgroundOcrManager.instance = new BackgroundOcrManager();
    }
    return BackgroundOcrManager.instance;
  }

  getStatus(): BackgroundOcrStatus {
    return this.status;
  }

  async init(): Promise<{ success: boolean; reason?: string }> {
    if (this.status === 'ready') return { success: true };
    if (this.status === 'unavailable') return { success: false, reason: 'worker-unavailable' };
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.createWorker();
    return this.initPromise;
  }

  private async createWorker(): Promise<{ success: boolean; reason?: string }> {
    this.status = 'initializing';
    console.log(`[QuickCopy:Background] OCR init started (build: ${__BUILD_ID__})`);

    if (typeof Worker === 'undefined') {
      console.warn(`[QuickCopy:Background] Worker constructor UNAVAILABLE in this background context — content script will fall back to local OCR`);
      this.status = 'unavailable';
      return { success: false, reason: 'worker-unavailable' };
    }

    try {
      try {
        const probeWorker = new Worker('data:text/javascript,self.close()');
        setTimeout(() => { try { probeWorker.terminate(); } catch { /* noop */ } }, 0);
        console.log(`[QuickCopy:Background] Worker probe OK (workers allowed in this context)`);
      } catch (probeErr) {
        console.warn(`[QuickCopy:Background] Worker probe FAILED`, {
          message: getErrorMessage(probeErr),
          stack: getErrorStack(probeErr),
          constructorName: probeErr?.constructor?.name ?? 'N/A',
        });
        this.status = 'unavailable';
        return { success: false, reason: 'worker-unavailable' };
      }

      const baseUrl = chrome.runtime.getURL('tessdata/');
      const workerPath = `${baseUrl}worker.min.js`;
      const corePath = baseUrl;
      const langPath = baseUrl;
      console.log(`[QuickCopy:Background] Worker paths:`, { workerPath, corePath, langPath, workerBlobURL: false });

      console.log(`[QuickCopy:Background] Verifying tessdata assets...`);
      for (const asset of ['worker.min.js', 'eng.traineddata', 'tesseract-core-simd-lstm.wasm.js']) {
        try {
          const resp = await fetch(`${baseUrl}${asset}`, { method: 'HEAD' });
          console.log(`[QuickCopy:Background] ${asset}: ${resp.status} ${resp.statusText}`);
        } catch (fetchErr) {
          console.error(`[QuickCopy:Background] asset fetch FAILED: ${asset}`, getErrorMessage(fetchErr));
        }
      }

      const importStart = performance.now();
      console.log(`[QuickCopy:Background] Importing tesseract.js...`);
      const Tesseract = await import('tesseract.js');
      console.log(`[QuickCopy:Background] tesseract.js imported in ${Math.round(performance.now() - importStart)}ms`);

      console.log(`[QuickCopy:Background] Seeding traineddata cache (worker fetch of moz-extension:// URLs is blocked, cache avoids it)...`);
      await seedTraineddataCache('eng', baseUrl);

      console.log(`[QuickCopy:Background] Creating Tesseract worker...`);
      const workerStart = performance.now();
      const heartbeat = setInterval(() => {
        console.warn(`[QuickCopy:Background] Still awaiting createWorker() after ${Math.round(performance.now() - workerStart)}ms — worker promise has NOT settled`);
      }, 5000);

      let workerInstance: unknown;
      try {
        workerInstance = await withTimeout(
          Tesseract.createWorker('eng', undefined, {
            workerPath,
            corePath,
            langPath,
            workerBlobURL: false,
            errorHandler: (data: unknown) => {
              console.error(`[QuickCopy:Background] tesseract worker reported an error`, data);
            },
            logger: (msg: { status: string; progress: number }) => {
              console.log(`[QuickCopy:Background] tesseract: ${msg.status} (${Math.round(msg.progress * 100)}%)`);
            },
          }),
          45000,
          'background createWorker',
        );
      } catch (createErr) {
        console.error(`[QuickCopy:Background] Tesseract.createWorker() THREW`, {
          message: getErrorMessage(createErr),
          stack: getErrorStack(createErr),
          type: typeof createErr,
          constructorName: createErr?.constructor?.name ?? 'N/A',
        });
        throw createErr;
      } finally {
        clearInterval(heartbeat);
      }

      if (!workerInstance) {
        throw new Error(`Tesseract.createWorker() returned ${typeof workerInstance} — internal init was silently swallowed`);
      }

      this.worker = workerInstance as unknown as TesseractWorker;
      this.status = 'ready';
      console.log(`[QuickCopy:Background] OCR worker ready in ${Math.round(performance.now() - workerStart)}ms`);
      return { success: true };
    } catch (err) {
      console.error(`[QuickCopy:Background] OCR init FAILED`, {
        message: getErrorMessage(err),
        stack: getErrorStack(err),
        type: typeof err,
      });
      this.status = 'failed';
      this.initPromise = null;
      return { success: false, reason: 'init-failed' };
    }
  }

  async recognize(imageData: string, language?: OcrLanguage): Promise<OcrResult> {
    const init = await this.init();
    if (!init.success || !this.worker) {
      throw new Error(`Background OCR unavailable (${init.reason ?? 'unknown'})`);
    }

    const startTime = performance.now();
    console.log(`[QuickCopy:Background] recognize() called with image of length ${imageData.length}`);

    const result = await timeoutOCR(
      this.worker.recognize(imageData, {}, { blocks: true })
    ) as Awaited<ReturnType<TesseractWorker['recognize']>>;

    const duration = performance.now() - startTime;
    const text = result.data.text || '';
    const confidence = typeof result.data.confidence === 'number' ? result.data.confidence : 0;
    const blocks = flattenTesseractBlocks(result.data.blocks);

    console.log(`[QuickCopy:Background] recognize() finished`, {
      textLength: text.length,
      confidence: confidence.toFixed(1) + '%',
      blockCount: blocks.length,
      executionTimeMs: Math.round(duration),
    });

    if (text.length === 0) {
      console.warn(`[QuickCopy:Background] OCR returned empty text (confidence: ${confidence})`);
    }

    return {
      text,
      confidence,
      blocks,
      language: language ?? 'eng',
      duration,
    };
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch (err) {
        console.error(`[QuickCopy:Background] terminate() error`, getErrorMessage(err));
      }
      this.worker = null;
    }
    this.status = 'idle';
    this.initPromise = null;
    console.log(`[QuickCopy:Background] OCR worker terminated`);
  }
}

export const backgroundOcrManager = BackgroundOcrManager.getInstance();
