import type { OcrResult, OcrLanguage } from '@type/index';
import type { OcrServiceInterface } from '@type/services';
import type { OcrInitResponse, OcrRecognizeResponse } from '@type/messages';
import { eventBus } from '@utils/eventBus';
import { logger, getErrorMessage, getErrorStack } from '@utils/logger';
import { timeoutOCR, withTimeout } from '@utils/timeout';
import { browserMessaging } from '@compat/messaging';

interface TesseractWorker {
  recognize(image: string, options?: Record<string, unknown>, output?: Record<string, boolean>): Promise<{ data: { text: string; confidence: number; blocks: unknown[] } }>;
  terminate(): Promise<void>;
  setParameters(params: Record<string, unknown>): Promise<void>;
}

function isExtensionContextValid(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

export class OCRService implements OcrServiceInterface {
  private static instance: OCRService;
  private worker: TesseractWorker | null = null;
  private initialized = false;
  private workerInitPromise: Promise<void> | null = null;
  private _disposed = false;
  private backgroundMode = false;

  private constructor() {}

  static getInstance(): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  private async initBackground(): Promise<boolean> {
    if (this.backgroundMode) return true;

    const sendProbe = () => browserMessaging.sendMessage<OcrInitResponse>({
      type: 'ocr:init',
      source: 'content',
      target: 'background',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    });

    const toReady = (r?: OcrInitResponse): boolean => r?.success === true;
    const toDead = (r?: OcrInitResponse): boolean => r?.reason === 'worker-unavailable' || r?.reason === 'init-failed';

    try {
      console.log(`[QuickCopy] [6/10] Probing background OCR worker...`);
      let response: OcrInitResponse | undefined;
      try {
        response = await withTimeout(sendProbe(), 3000, 'background OCR probe');
      } catch {
        response = undefined;
      }

      if (toReady(response)) {
        this.backgroundMode = true;
        console.log(`[QuickCopy] [6/10] OCR worker is running in the BACKGROUND context`);
        return true;
      }
      if (toDead(response)) {
        console.log(`[QuickCopy] [6/10] Background OCR unavailable (${response?.reason}) — using local worker`);
        return false;
      }

      console.log(`[QuickCopy] [6/10] Background OCR initializing — polling for readiness (each poll keeps the event page alive)`);
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          const next = await withTimeout(sendProbe(), 2000, 'background OCR poll');
          if (toReady(next)) {
            this.backgroundMode = true;
            console.log(`[QuickCopy] [6/10] OCR worker became ready in the BACKGROUND context`);
            return true;
          }
          if (toDead(next)) {
            console.log(`[QuickCopy] [6/10] Background OCR unavailable (${next?.reason}) — using local worker`);
            return false;
          }
        } catch {
          // transient message failure — keep polling
        }
      }

      console.warn(`[QuickCopy] [6/10] Background OCR did not become ready within 20s — using local worker`);
      return false;
    } catch (err) {
      console.warn(`[QuickCopy] [6/10] Background OCR probe FAILED`, getErrorMessage(err));
      return false;
    }
  }

  private canSpawnWorkersLocally(): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      let probe: Worker | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = (ok: boolean): void => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        try { probe?.terminate(); } catch { /* noop */ }
        resolve(ok);
      };
      try {
        probe = new Worker('data:text/javascript,self.postMessage("probe-ok")');
        timer = setTimeout(() => finish(false), 750);
        probe.onmessage = () => finish(true);
        probe.onerror = () => finish(false);
      } catch {
        finish(false);
      }
    });
  }

  async initialize(): Promise<boolean> {
    if (this._disposed) return false;
    if (!isExtensionContextValid()) return false;

    if (this.initialized) {
      console.log(`[QuickCopy] [6/10] OCR worker already initialized (${this.backgroundMode ? 'background' : 'local'})`);
      return true;
    }

    const localWorkersAllowed = await this.canSpawnWorkersLocally();
    console.log(`[QuickCopy] [6/10] Worker spawn on this page: ${localWorkersAllowed ? 'ALLOWED — using local OCR worker' : 'BLOCKED by page CSP/TrustedTypes — using background OCR worker'}`);

    if (!localWorkersAllowed) {
      const backgroundReady = await this.initBackground();
      if (backgroundReady) return true;
    }

    return this.initLocal();
  }

  private async initLocal(): Promise<boolean> {
    if (this.workerInitPromise) {
      console.log(`[QuickCopy] [6/10] OCR worker initialization already in progress, waiting...`);
      await this.workerInitPromise;
      return this.initialized;
    }

    this.workerInitPromise = this.initWorker();
    try {
      const initStart = performance.now();
      await withTimeout(this.workerInitPromise, 30000, 'OCR worker initialization');
      this.initialized = true;
      console.log(`[QuickCopy] [6/10] OCR worker ready ✓ (${Math.round(performance.now() - initStart)}ms)`);
      return true;
    } catch (err) {
      console.error(`[QuickCopy] [6/10] OCR worker FAILED`, {
        message: getErrorMessage(err),
        stack: getErrorStack(err),
        type: typeof err,
        constructorName: err?.constructor?.name ?? 'N/A',
      });
      this.initialized = false;
      this.worker = null;
      this.workerInitPromise = null;
      return false;
    }
  }

  private async initWorker(): Promise<void> {
    console.log(`[QuickCopy] [6/10] Importing tesseract.js...`);

    const importStart = performance.now();
    const Tesseract = await import('tesseract.js');
    console.log(`[QuickCopy] [6/10] tesseract.js imported in ${Math.round(performance.now() - importStart)}ms`);

    const baseUrl = chrome.runtime.getURL('tessdata/');
    const workerPath = `${baseUrl}worker.min.js`;
    const corePath = baseUrl;
    const langPath = baseUrl;

    console.log(`[QuickCopy] [6/10] Worker paths:`, {
      workerPath,
      corePath,
      langPath,
    });

    console.log(`[QuickCopy] [6/10] Environment probe (Task 5/6):`, {
      documentOrigin: window.location.origin,
      locationOrigin: window.location.origin,
      locationHref: window.location.href,
      extensionOrigin: chrome.runtime.getURL(''),
      serviceWorkerController: (() => {
        try { return navigator.serviceWorker?.controller?.scriptURL ?? null; } catch { return 'unavailable'; }
      })(),
      trustedTypes: (() => {
        const w = globalThis as unknown as { trustedTypes?: unknown };
        return typeof w.trustedTypes === 'undefined' ? 'not-available' : 'available';
      })(),
    });

    console.log(`[QuickCopy] [6/10] Service worker registrations:`, await (async () => {
      try {
        const regs = await navigator.serviceWorker?.getRegistrations();
        return regs?.map(r => r.scope) ?? [];
      } catch (err) {
        return `unavailable: ${getErrorMessage(err)}`;
      }
    })());

    console.log(`[QuickCopy] [6/10] Worker-spawn probe (tests whether new Worker() is allowed in this page context):`);
    try {
      const probeWorker = new Worker('data:text/javascript,self.close()');
      console.log(`[QuickCopy] [6/10] new Worker(data:) SUCCEEDED (no CSP/TrustedTypes restriction)`);
      setTimeout(() => { try { probeWorker.terminate(); } catch { /* noop */ } }, 0);
    } catch (probeErr) {
      console.error(`[QuickCopy] [6/10] new Worker(data:) THREW`, {
        message: getErrorMessage(probeErr),
        stack: getErrorStack(probeErr),
        constructorName: probeErr?.constructor?.name ?? 'N/A',
      });
    }

    console.log(`[QuickCopy] [6/10] Verifying tessdata assets...`);
    try {
      const workerResp = await fetch(workerPath, { method: 'HEAD' });
      console.log(`[QuickCopy] [6/10] worker.min.js:`, {
        status: workerResp.status,
        statusText: workerResp.statusText,
        contentType: workerResp.headers.get('content-type') ?? 'none',
        redirected: workerResp.redirected,
        finalUrl: workerResp.url,
      });

      const traineddataResp = await fetch(`${baseUrl}eng.traineddata`, { method: 'HEAD' });
      console.log(`[QuickCopy] [6/10] eng.traineddata:`, {
        status: traineddataResp.status,
        statusText: traineddataResp.statusText,
        contentType: traineddataResp.headers.get('content-type') ?? 'none',
        size: traineddataResp.headers.get('content-length') || 'unknown',
        redirected: traineddataResp.redirected,
        finalUrl: traineddataResp.url,
      });

      const coreResp = await fetch(`${baseUrl}tesseract-core-simd-lstm.wasm.js`, { method: 'HEAD' });
      console.log(`[QuickCopy] [6/10] tesseract-core-simd-lstm.wasm.js:`, {
        status: coreResp.status,
        contentType: coreResp.headers.get('content-type') ?? 'none',
        redirected: coreResp.redirected,
        finalUrl: coreResp.url,
      });
    } catch (fetchErr) {
      console.error(`[QuickCopy] [6/10] Asset verification FAILED`, {
        message: getErrorMessage(fetchErr),
        stack: getErrorStack(fetchErr),
      });
    }

    const describeError = (err: unknown): Record<string, unknown> => {
      const protoChain: string[] = [];
      let proto: unknown = err;
      while (proto != null && typeof proto === 'object') {
        protoChain.push((proto as { constructor?: { name?: string } }).constructor?.name ?? '?');
        proto = Object.getPrototypeOf(proto);
      }
      let jsonString: string;
      try {
        jsonString = JSON.stringify(err);
      } catch {
        jsonString = '(circular or not stringifiable)';
      }
      return {
        message: getErrorMessage(err),
        stack: getErrorStack(err),
        type: typeof err,
        isNull: err === null,
        isUndefined: err === undefined,
        constructorName: err?.constructor?.name ?? 'N/A',
        prototypeChain: protoChain,
        ownKeys: err && typeof err === 'object' ? Object.getOwnPropertyNames(err as object) : 'N/A',
        jsonStringify: jsonString,
        toString: String(err),
      };
    };

    const ocrLogger = (msg: { status: string; progress: number }) => {
      if (msg.status === 'loading tesseract core') {
        console.log(`[QuickCopy] [6/10] Loading Tesseract core...`);
        eventBus.emit('status:update', { status: 'busy', message: 'Loading OCR engine...' });
      } else if (msg.status === 'initializing tesseract') {
        console.log(`[QuickCopy] [6/10] Initializing Tesseract...`);
        eventBus.emit('status:update', { status: 'busy', message: 'Initializing OCR...' });
      } else if (msg.status === 'loading language traineddata') {
        console.log(`[QuickCopy] [6/10] Loading language data...`);
        eventBus.emit('status:update', { status: 'busy', message: 'Loading language data...' });
      } else if (msg.status === 'initializing api') {
        console.log(`[QuickCopy] [6/10] Starting OCR engine...`);
        eventBus.emit('status:update', { status: 'busy', message: 'Starting OCR engine...' });
      } else if (msg.status === 'recognizing') {
        console.log(`[QuickCopy] [7/10] OCR recognizing... ${Math.round(msg.progress * 100)}%`);
      } else {
        console.log(`[QuickCopy] [6/10] Tesseract: ${msg.status} (${Math.round(msg.progress * 100)}%)`);
      }
      logger.debug(`Tesseract: ${msg.status} (${Math.round(msg.progress * 100)}%)`);
    };

    console.log(`[QuickCopy] [6/10] Creating Tesseract worker...`);
    const workerStart = performance.now();

    let workerInstance: unknown;
    const heartbeat = setInterval(() => {
      console.warn(`[QuickCopy] [6/10] Still awaiting createWorker() after ${Math.round(performance.now() - workerStart)}ms — worker promise has NOT settled`);
    }, 5000);
    try {
      try {
        workerInstance = await Tesseract.createWorker('eng', undefined, {
          workerPath,
          corePath,
          langPath,
          logger: ocrLogger,
        });
        console.log(`[QuickCopy] [6/10] createWorker succeeded via default (blob URL) worker path`);
      } catch (blobPathErr) {
        console.warn(`[QuickCopy] [6/10] createWorker via blob URL path FAILED — retrying with direct extension worker URL`, describeError(blobPathErr));
        workerInstance = await Tesseract.createWorker('eng', undefined, {
          workerPath,
          corePath,
          langPath,
          workerBlobURL: false,
          logger: ocrLogger,
        });
        console.log(`[QuickCopy] [6/10] createWorker succeeded via direct extension worker URL path`);
      }
    } catch (createErr) {
      console.error(`[QuickCopy] [6/10] Tesseract.createWorker() THREW (both paths)`, describeError(createErr));
      throw createErr;
    } finally {
      clearInterval(heartbeat);
    }
    console.log(`[QuickCopy] [6/10] createWorker() returned:`, {
      type: typeof workerInstance,
      isNull: workerInstance === null,
      isUndefined: workerInstance === undefined,
      constructorName: workerInstance?.constructor?.name ?? 'N/A',
      keys: workerInstance && typeof workerInstance === 'object' ? Object.keys(workerInstance as object).slice(0, 20) : 'N/A',
    });

    if (!workerInstance) {
      throw new Error(`Tesseract.createWorker() returned ${typeof workerInstance} — internal init was silently swallowed`);
    }

    this.worker = workerInstance as unknown as TesseractWorker;

    console.log(`[QuickCopy] [6/10] Worker created in ${Math.round(performance.now() - workerStart)}ms`);
    logger.info('OCRService: worker initialized');
  }

  private async recognizeInBackground(imageData: string, language?: OcrLanguage): Promise<OcrResult> {
    console.log(`[QuickCopy] [7/10] OCR started (background worker)`);
    const startTime = performance.now();
    eventBus.emit('ocr:started', undefined);
    eventBus.emit('status:update', { status: 'busy', message: 'Performing OCR...' });

    try {
      const response = await browserMessaging.sendMessage<OcrRecognizeResponse>({
        type: 'ocr:recognize',
        imageData,
        language,
        source: 'content',
        target: 'background',
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      });

      if (response?.success !== true || !response.result) {
        throw new Error(response?.error ?? 'Background OCR returned failure');
      }

      const ocrResult: OcrResult = response.result;
      const duration = performance.now() - startTime;
      ocrResult.duration = duration;

      console.log(`[QuickCopy] [8/10] OCR finished ✓ (background)`, {
        textLength: ocrResult.text.length,
        confidence: ocrResult.confidence.toFixed(1) + '%',
        blockCount: ocrResult.blocks.length,
        executionTimeMs: Math.round(duration),
      });

      if (ocrResult.text.length === 0) {
        console.warn(`[QuickCopy] [8/10] OCR returned empty text (confidence: ${ocrResult.confidence})`);
      }

      eventBus.emit('ocr:completed', ocrResult);
      eventBus.emit('status:update', { status: 'ready', message: 'OCR completed' });
      logger.info('OCR completed (background)', { confidence: ocrResult.confidence, chars: ocrResult.text.length, duration: `${Math.round(duration)}ms` });

      return ocrResult;
    } catch (error) {
      console.error(`[QuickCopy] [7/10] OCR FAILED (background)`, {
        message: getErrorMessage(error),
        stack: getErrorStack(error),
        durationMs: Math.round(performance.now() - startTime),
        type: typeof error,
      });
      const safeErr = error instanceof Error ? error : new Error(getErrorMessage(error));
      eventBus.emit('ocr:failed', safeErr);
      eventBus.emit('status:update', { status: 'error', message: 'OCR failed' });
      throw safeErr;
    }
  }

  async recognize(imageData: string, _language?: OcrLanguage): Promise<OcrResult> {
    if (this._disposed) throw new Error('OCRService disposed');
    console.log(`[QuickCopy] [7/10] OCR started`);

    const ready = await this.initialize();
    if (!ready) {
      const errMsg = 'OCR worker not available';
      console.error(`[QuickCopy] [7/10] OCR FAILED: ${errMsg}`);
      throw new Error(errMsg);
    }

    if (this.backgroundMode) {
      return this.recognizeInBackground(imageData, _language);
    }

    const worker = this.worker;
    if (!worker) {
      const errMsg = 'OCR worker not available';
      console.error(`[QuickCopy] [7/10] OCR FAILED: ${errMsg}`);
      throw new Error(errMsg);
    }

    const startTime = performance.now();
    eventBus.emit('ocr:started', undefined);
    eventBus.emit('status:update', { status: 'busy', message: 'Performing OCR...' });

    try {
      console.log(`[QuickCopy] [7/10] Calling worker.recognize() with image of length ${imageData.length}`);

      const result = await timeoutOCR(
        worker.recognize(imageData, {}, { blocks: true })
      ) as Awaited<ReturnType<TesseractWorker['recognize']>>;

      const duration = performance.now() - startTime;

      const text = result.data.text || '';
      const confidence = typeof result.data.confidence === 'number' ? result.data.confidence : 0;
      const blocks = result.data.blocks ?? [];

      console.log(`[QuickCopy] [8/10] OCR finished ✓`, {
        textLength: text.length,
        confidence: confidence.toFixed(1) + '%',
        blockCount: blocks.length,
        executionTimeMs: Math.round(duration),
      });

      if (text.length === 0) {
        console.warn(`[QuickCopy] [8/10] OCR returned empty text (confidence: ${confidence})`);
      }

      const ocrResult: OcrResult = {
        text,
        confidence,
        blocks: blocks.map((b: unknown) => {
          const block = b as { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } };
          return {
            text: block.text,
            confidence: block.confidence,
            bbox: {
              x: block.bbox.x0,
              y: block.bbox.y0,
              width: block.bbox.x1 - block.bbox.x0,
              height: block.bbox.y1 - block.bbox.y0,
            },
          };
        }),
        language: _language ?? 'eng',
        duration,
      };

      eventBus.emit('ocr:completed', ocrResult);
      eventBus.emit('status:update', { status: 'ready', message: 'OCR completed' });
      logger.info('OCR completed', { confidence: ocrResult.confidence, chars: ocrResult.text.length, duration: `${Math.round(duration)}ms` });

      return ocrResult;
    } catch (error) {
      console.error(`[QuickCopy] [7/10] OCR FAILED`, {
        message: getErrorMessage(error),
        stack: getErrorStack(error),
        durationMs: Math.round(performance.now() - startTime),
        type: typeof error,
      });
      const safeErr = error instanceof Error ? error : new Error(getErrorMessage(error));
      eventBus.emit('ocr:failed', safeErr);
      eventBus.emit('status:update', { status: 'error', message: 'OCR failed' });
      throw safeErr;
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.initialized;
  }

  getSupportedLanguages(): OcrLanguage[] {
    return ['eng'];
  }

  async terminate(): Promise<void> {
    this._disposed = true;
    if (this.backgroundMode) {
      try {
        await browserMessaging.sendMessage({
          type: 'ocr:terminate',
          source: 'content',
          target: 'background',
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        });
      } catch (err) {
        logger.error('OCRService: background terminate error', err);
      }
      this.backgroundMode = false;
    }
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch (err) {
        logger.error('OCRService: terminate error', err);
      }
      this.worker = null;
    }
    this.initialized = false;
    this.workerInitPromise = null;
    logger.info('OCRService: terminated');
  }
}

export const ocrService = OCRService.getInstance();
