import type { OcrResult } from '@type/index';
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
      console.warn(`[Ekadanta:Background] traineddata fetch failed (${resp.status})`);
      return false;
    }
    const data = new Uint8Array(await resp.arrayBuffer());
    const key = `./${lang}.traineddata`;
    const db = await idbOpen();
    try {
      const existing = await idbGet(db, key);
      if (existing instanceof Uint8Array && existing.length === data.length) {
        console.log(`[Ekadanta:Background] traineddata already cached (${data.length} bytes)`);
        return true;
      }
      await idbPut(db, key, data);
      console.log(`[Ekadanta:Background] seeded traineddata cache (${data.length} bytes, key="${key}")`);
      return true;
    } finally {
      db.close();
    }
  } catch (err) {
    console.error(`[Ekadanta:Background] traineddata cache seed FAILED`, getErrorMessage(err));
    return false;
  }
}

export class BackgroundOcrManager {
  private static instance: BackgroundOcrManager;
  private worker: TesseractWorker | null = null;
  private status: BackgroundOcrStatus = 'idle';
  private initPromise: Promise<{ success: boolean; reason?: string }> | null = null;
  private currentLanguage: string | null = null;

  private constructor() {}

  static getInstance(): BackgroundOcrManager {
    if (!BackgroundOcrManager.instance) {
      BackgroundOcrManager.instance = new BackgroundOcrManager();
    }
    return BackgroundOcrManager.instance;
  }

  private async syncMode(): Promise<void> {
  }

  getStatus(): BackgroundOcrStatus {
    return this.status;
  }

  getActiveLanguage(): string | null {
    return this.currentLanguage;
  }

  async init(language?: string): Promise<{ success: boolean; reason?: string }> {
    const lang = language ?? 'eng';
    if (this.status === 'ready' && this.worker && this.currentLanguage === lang) {
      return { success: true };
    }
    if (this.status === 'unavailable') return { success: false, reason: 'worker-unavailable' };
    if (this.initPromise) return this.initPromise;

    this.currentLanguage = lang;
    this.initPromise = this.createWorker(lang);
    return this.initPromise;
  }

  private async createWorker(lang: string): Promise<{ success: boolean; reason?: string }> {
    this.status = 'initializing';
    console.log(`[Ekadanta:Background] OCR init started (build: ${__BUILD_ID__})`);

    if (typeof Worker === 'undefined') {
      console.warn(`[Ekadanta:Background] Worker constructor UNAVAILABLE in this background context — content script will fall back to local OCR`);
      this.status = 'unavailable';
      return { success: false, reason: 'worker-unavailable' };
    }

    try {
      const baseUrl = chrome.runtime.getURL('tessdata/');
      const workerPath = `${baseUrl}worker.min.js`;
      const corePath = baseUrl;
      const langPath = baseUrl;
      console.log(`[Ekadanta:Background] Worker paths:`, { workerPath, corePath, langPath, workerBlobURL: false });

      console.log(`[Ekadanta:Background] Verifying tessdata assets...`);
      for (const asset of ['worker.min.js', 'eng.traineddata', 'tesseract-core-simd-lstm.wasm.js']) {
        try {
          const resp = await fetch(`${baseUrl}${asset}`, { method: 'HEAD' });
          console.log(`[Ekadanta:Background] ${asset}: ${resp.status} ${resp.statusText}`);
        } catch (fetchErr) {
          console.error(`[Ekadanta:Background] asset fetch FAILED: ${asset}`, getErrorMessage(fetchErr));
        }
      }

      const importStart = performance.now();
      console.log(`[Ekadanta:Background] Importing tesseract.js...`);
      const Tesseract = await import('tesseract.js');
      console.log(`[Ekadanta:Background] tesseract.js imported in ${Math.round(performance.now() - importStart)}ms`);

      console.log(`[Ekadanta:Background] Seeding traineddata cache (worker fetch of moz-extension:// URLs is blocked, cache avoids it)...`);
      await seedTraineddataCache('eng', baseUrl);

      console.log(`[Ekadanta:Background] Creating Tesseract worker (lang: ${lang})...`);
      const workerStart = performance.now();
      const heartbeat = setInterval(() => {
        console.warn(`[Ekadanta:Background] Still awaiting createWorker() after ${Math.round(performance.now() - workerStart)}ms — worker promise has NOT settled`);
      }, 5000);

      let workerInstance: unknown;
      try {
        workerInstance = await withTimeout(
          Tesseract.createWorker(lang, undefined, {
            workerPath,
            corePath,
            langPath,
            workerBlobURL: false,
            gzip: false,
            errorHandler: (data: unknown) => {
              console.error(`[Ekadanta:Background] tesseract worker reported an error`, data);
            },
            logger: (msg: { status: string; progress: number }) => {
              console.log(`[Ekadanta:Background] tesseract: ${msg.status} (${Math.round(msg.progress * 100)}%)`);
            },
          }),
          45000,
          'background createWorker',
        );
      } catch (createErr) {
        console.error(`[Ekadanta:Background] Tesseract.createWorker() THREW`, {
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
      console.log(`[Ekadanta:Background] OCR worker ready in ${Math.round(performance.now() - workerStart)}ms`);
      return { success: true };
    } catch (err) {
      console.error(`[Ekadanta:Background] OCR init FAILED`, {
        message: getErrorMessage(err),
        stack: getErrorStack(err),
        type: typeof err,
      });
      this.status = 'failed';
      this.initPromise = null;
      return { success: false, reason: 'init-failed' };
    }
  }

  async recognize(imageData: string, language?: string): Promise<OcrResult> {
    const lang = language ?? 'eng';

    if (this.status !== 'ready' || !this.worker || this.currentLanguage !== lang) {
      if (this.initPromise) {
        try {
          await this.initPromise;
        } catch {
          // fall through and re-init
        }
      }
      if (this.worker) {
        console.log(`[Ekadanta:Background] Rebuilding worker for language change (${this.currentLanguage} → ${lang})`);
        await this.terminate();
      }
    }

    const init = await this.init(lang);
    if (!init.success || !this.worker) {
      throw new Error(`Background OCR unavailable (${init.reason ?? 'unknown'})`);
    }

    await this.syncMode();
    const startTime = performance.now();
    console.log(`[Ekadanta:Background] recognize() called with image of length ${imageData.length}`);

    const result = await this.recognizeWithWorker(imageData, language);
    result.duration = performance.now() - startTime;

    console.log(`[Ekadanta:Background] recognize() finished`, {
      textLength: result.text.length,
      confidence: result.confidence.toFixed(1) + '%',
      blockCount: result.blocks.length,
      executionTimeMs: Math.round(result.duration),
    });

    if (result.text.length === 0) {
      console.warn(`[Ekadanta:Background] OCR returned empty text (confidence: ${result.confidence})`);
    }

    return result;
  }

  private async recognizeWithWorker(imageData: string, language?: string): Promise<OcrResult> {
    if (!this.worker) throw new Error('Background OCR worker not available');

    const startTime = performance.now();
    const result = await timeoutOCR(
      this.worker.recognize(imageData, {}, { blocks: true })
    ) as Awaited<ReturnType<TesseractWorker['recognize']>>;

    const text = result.data.text || '';
    const confidence = typeof result.data.confidence === 'number' ? result.data.confidence : 0;
    const blocks = flattenTesseractBlocks(result.data.blocks);

    if (text.length === 0) {
      console.warn(`[Ekadanta:Background] OCR returned empty text (confidence: ${confidence})`);
    }

    return {
      text,
      confidence,
      blocks,
      language: language ?? 'eng',
      duration: performance.now() - startTime,
    };
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch (err) {
        console.error(`[Ekadanta:Background] terminate() error`, getErrorMessage(err));
      }
      this.worker = null;
    }
    this.currentLanguage = null;
    this.status = 'idle';
    this.initPromise = null;
    console.log(`[Ekadanta:Background] OCR worker terminated`);
  }
}

export const backgroundOcrManager = BackgroundOcrManager.getInstance();
