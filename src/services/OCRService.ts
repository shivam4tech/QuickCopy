import type { OcrResult, OcrLanguage } from '@type/index';
import type { OcrServiceInterface } from '@type/services';
import type { OcrInitResponse, OcrRecognizeResponse } from '@type/messages';
import { eventBus } from '@utils/eventBus';
import { logger, getErrorMessage, getErrorStack } from '@utils/logger';
import { timeoutOCR, withTimeout } from '@utils/timeout';
import { browserMessaging } from '@compat/messaging';
import { flattenTesseractBlocks } from './ocr/geometry';
import { OCRManager } from './ocr/OCRManager';
import type { OcrMode } from './ocr/router/OCRRouter';
import { settingsService } from './SettingsService';
import { languageManager } from './ocr/LanguageManager';
import { isWorkerSpawnBlockedByTrustedTypes } from '@utils/trustedTypes';

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
  private ocrManager: OCRManager | null = null;
  private settingsMode: OcrMode = 'auto';

  private constructor() {}

  private async syncMode(): Promise<OcrMode> {
    try {
      const mode = await settingsService.get('ocrMode');
      if (mode) this.settingsMode = mode;
    } catch {
      // default to auto
    }
    this.ocrManager?.setMode(this.settingsMode);
    return this.settingsMode;
  }

  private async getActiveLanguageString(): Promise<string> {
    try {
      const secondary = await settingsService.get('secondaryLanguage');
      return languageManager.getActiveLanguageString(secondary as string | null);
    } catch {
      return 'eng';
    }
  }

  private getOrCreateManager(): OCRManager {
    if (!this.ocrManager) {
      this.ocrManager = new OCRManager({
        mode: this.settingsMode,
        tesseract: {
          isReady: () => !!this.worker,
          recognize: (imageData, language) => this.recognizeWithLocalWorker(imageData, language),
        },
      });
    }
    return this.ocrManager;
  }

  static getInstance(): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  private async initBackground(): Promise<boolean> {
    if (this.backgroundMode) return true;

    const langStr = await this.getActiveLanguageString();
    const sendProbe = () => browserMessaging.sendMessage<OcrInitResponse>({
      type: 'ocr:init',
      language: langStr,
      source: 'content',
      target: 'background',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    });

    const toReady = (r?: OcrInitResponse): boolean => r?.success === true;
    const toDead = (r?: OcrInitResponse): boolean => r?.reason === 'worker-unavailable' || r?.reason === 'init-failed';

    try {
      console.log(`[Ekadanta] [6/10] Probing background OCR worker...`);
      let response: OcrInitResponse | undefined;
      try {
        response = await withTimeout(sendProbe(), 3000, 'background OCR probe');
      } catch {
        response = undefined;
      }

      if (toReady(response)) {
        this.backgroundMode = true;
        console.log(`[Ekadanta] [6/10] OCR worker is running in the BACKGROUND context`);
        return true;
      }
      if (toDead(response)) {
        console.log(`[Ekadanta] [6/10] Background OCR unavailable (${response?.reason}) — using local worker`);
        return false;
      }

      console.log(`[Ekadanta] [6/10] Background OCR initializing — polling for readiness (each poll keeps the event page alive)`);
      // The keepalive heartbeat + alarm keep the service worker resident and
      // its OCR worker warm, so this is a short, bounded wait: either the warm
      // worker answers on the first probe, or the cold one becomes ready
      // quickly. Long polling here previously left the UI stuck on "Performing
      // OCR..." for over a minute, so keep the deadline tight.
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          const next = await withTimeout(sendProbe(), 2000, 'background OCR poll');
          if (toReady(next)) {
            this.backgroundMode = true;
            console.log(`[Ekadanta] [6/10] OCR worker became ready in the BACKGROUND context`);
            return true;
          }
          if (toDead(next)) {
            console.log(`[Ekadanta] [6/10] Background OCR unavailable (${next?.reason}) — using local worker`);
            return false;
          }
        } catch {
          // transient message failure — keep polling
        }
      }

      console.warn(`[Ekadanta] [6/10] Background OCR did not become ready within 20s — using local worker`);
      return false;
    } catch (err) {
      console.warn(`[Ekadanta] [6/10] Background OCR probe FAILED`, getErrorMessage(err));
      return false;
    }
  }

  async initialize(): Promise<boolean> {
    if (this._disposed) return false;
    if (!isExtensionContextValid()) return false;

    if (this.initialized) {
      console.log(`[Ekadanta] [6/10] OCR worker already initialized (${this.backgroundMode ? 'background' : 'local'})`);
      return true;
    }

    // Pages with enforce-mode Trusted Types that restrict policy names (e.g.
    // LinkedIn) cannot spawn in-page workers at all — skip straight to the
    // background path instead of burning 30s on a doomed worker init.
    if (isWorkerSpawnBlockedByTrustedTypes()) {
      logger.info('Trusted Types policy blocks in-page workers — using background OCR');
      return this.initBackground();
    }

    // Strict worker-src/script-src CSPs (YouTube, LinkedIn, ...) block blob
    // workers in the page context; the browser logs a CSP violation for every
    // attempt. Probe once (cached per page) so we quietly fall back to
    // background OCR instead of failing loudly on each recognize. The probe
    // uses a blob URL because that is tesseract's primary worker path.
    if (!(await this.probeBlobWorkerSpawn())) {
      logger.info('Page CSP blocks in-page OCR workers — using background OCR');
      return this.initBackground();
    }

    // Fast path: try the in-page worker first. The old CSP probe used the
    // extension worker URL and produced false negatives (pages where that URL
    // is blocked but blob-URL workers work fine), which forced a 20s
    // background wait for no reason. The blob-URL probe above mirrors what
    // tesseract actually does, so it stays in sync.
    //
    // Local-first, sequential: the in-page worker is the fastest and most
    // reliable engine (no service-worker dependency), so prefer it whenever it
    // can spawn. Only when the page blocks in-page workers (strict CSP,
    // Trusted Types) do we fall through to the background worker, which the
    // keepalive keeps warm so it is fast on the pages that actually need it.
    // A parallel local+background race was tried here and caused multi-minute
    // hangs (background init storms / backgroundMode flapping), so the two
    // paths must NOT run concurrently.
    if (await this.initLocal()) {
      return true;
    }

    return this.initBackground();
  }

  private blobProbePromise: Promise<boolean> | null = null;

  /**
   * Probes whether the page allows blob-URL workers. Strict pages report the
   * CSP violation to the browser console (unavoidable — it is emitted by the
   * browser itself, not by page JS), but we only trigger it once per page and
   * never retry, so restricted sites are quiet after the first probe.
   */
  private probeBlobWorkerSpawn(): Promise<boolean> {
    if (this.blobProbePromise) return this.blobProbePromise;

    this.blobProbePromise = new Promise<boolean>((resolve) => {
      if (typeof Worker === 'undefined') {
        resolve(false);
        return;
      }

      let worker: Worker | null = null;
      let blobUrl: string | null = null;
      let settled = false;
      const finish = (ok: boolean): void => {
        if (settled) return;
        settled = true;
        try { worker?.terminate(); } catch { /* ignore */ }
        try { if (blobUrl) URL.revokeObjectURL(blobUrl); } catch { /* ignore */ }
        resolve(ok);
      };

      try {
        blobUrl = URL.createObjectURL(new Blob(
          ['self.onmessage=function(e){self.postMessage("qc-probe-pong")}'],
          { type: 'text/javascript' },
        ));
        const timeout = setTimeout(() => {
          // No error and no message within the budget — treat as allowed.
          finish(true);
        }, 2000);

        worker = new Worker(blobUrl);
        worker.onmessage = (event) => {
          if (event.data === 'qc-probe-pong') {
            clearTimeout(timeout);
            finish(true);
          }
        };
        worker.onerror = () => {
          clearTimeout(timeout);
          finish(false);
        };
      } catch {
        finish(false);
      }
    });

    return this.blobProbePromise;
  }

  private async initLocal(): Promise<boolean> {
    if (this.workerInitPromise) {
      console.log(`[Ekadanta] [6/10] OCR worker initialization already in progress, waiting...`);
      await this.workerInitPromise;
      return this.initialized;
    }

    this.workerInitPromise = this.initWorker();
    try {
      const initStart = performance.now();
      await withTimeout(this.workerInitPromise, 30000, 'OCR worker initialization');
      this.initialized = true;
      console.log(`[Ekadanta] [6/10] OCR worker ready ✓ (${Math.round(performance.now() - initStart)}ms)`);
      return true;
    } catch (err) {
      console.error(`[Ekadanta] [6/10] OCR worker FAILED`, {
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
    console.log(`[Ekadanta] [6/10] Importing tesseract.js...`);

    const importStart = performance.now();
    const Tesseract = await import('tesseract.js');
    console.log(`[Ekadanta] [6/10] tesseract.js imported in ${Math.round(performance.now() - importStart)}ms`);

    const baseUrl = chrome.runtime.getURL('tessdata/');
    const workerPath = `${baseUrl}worker.min.js`;
    const corePath = baseUrl;
    const langPath = baseUrl;

    const langStr = await this.getActiveLanguageString();
    console.log(`[Ekadanta] [6/10] OCR language: ${langStr}`);

    console.log(`[Ekadanta] [6/10] Worker paths:`, {
      workerPath,
      corePath,
      langPath,
    });

    console.log(`[Ekadanta] [6/10] Environment probe (Task 5/6):`, {
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

    console.log(`[Ekadanta] [6/10] Service worker registrations:`, await (async () => {
      try {
        const regs = await navigator.serviceWorker?.getRegistrations();
        return regs?.map(r => r.scope) ?? [];
      } catch (err) {
        return `unavailable: ${getErrorMessage(err)}`;
      }
    })());

    console.log(`[Ekadanta] [6/10] Verifying tessdata assets...`);
    try {
      const workerResp = await fetch(workerPath, { method: 'HEAD' });
      console.log(`[Ekadanta] [6/10] worker.min.js:`, {
        status: workerResp.status,
        statusText: workerResp.statusText,
        contentType: workerResp.headers.get('content-type') ?? 'none',
        redirected: workerResp.redirected,
        finalUrl: workerResp.url,
      });

      const traineddataResp = await fetch(`${baseUrl}eng.traineddata`, { method: 'HEAD' });
      console.log(`[Ekadanta] [6/10] eng.traineddata:`, {
        status: traineddataResp.status,
        statusText: traineddataResp.statusText,
        contentType: traineddataResp.headers.get('content-type') ?? 'none',
        size: traineddataResp.headers.get('content-length') || 'unknown',
        redirected: traineddataResp.redirected,
        finalUrl: traineddataResp.url,
      });

      const coreResp = await fetch(`${baseUrl}tesseract-core-simd-lstm.wasm.js`, { method: 'HEAD' });
      console.log(`[Ekadanta] [6/10] tesseract-core-simd-lstm.wasm.js:`, {
        status: coreResp.status,
        contentType: coreResp.headers.get('content-type') ?? 'none',
        redirected: coreResp.redirected,
        finalUrl: coreResp.url,
      });
    } catch (fetchErr) {
      console.error(`[Ekadanta] [6/10] Asset verification FAILED`, {
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
        console.log(`[Ekadanta] [6/10] Loading Tesseract core...`);
        eventBus.emit('status:update', { status: 'busy', message: 'Loading OCR engine...' });
      } else if (msg.status === 'initializing tesseract') {
        console.log(`[Ekadanta] [6/10] Initializing Tesseract...`);
        eventBus.emit('status:update', { status: 'busy', message: 'Initializing OCR...' });
      } else if (msg.status === 'loading language traineddata') {
        console.log(`[Ekadanta] [6/10] Loading language data...`);
        eventBus.emit('status:update', { status: 'busy', message: 'Loading language data...' });
      } else if (msg.status === 'initializing api') {
        console.log(`[Ekadanta] [6/10] Starting OCR engine...`);
        eventBus.emit('status:update', { status: 'busy', message: 'Starting OCR engine...' });
      } else if (msg.status === 'recognizing') {
        console.log(`[Ekadanta] [7/10] OCR recognizing... ${Math.round(msg.progress * 100)}%`);
      } else {
        console.log(`[Ekadanta] [6/10] Tesseract: ${msg.status} (${Math.round(msg.progress * 100)}%)`);
      }
      logger.debug(`Tesseract: ${msg.status} (${Math.round(msg.progress * 100)}%)`);
    };

    console.log(`[Ekadanta] [6/10] Creating Tesseract worker...`);
    const workerStart = performance.now();

    let workerInstance: unknown;
    const heartbeat = setInterval(() => {
      console.warn(`[Ekadanta] [6/10] Still awaiting createWorker() after ${Math.round(performance.now() - workerStart)}ms — worker promise has NOT settled`);
    }, 5000);
    try {
      try {
        workerInstance = await Tesseract.createWorker(langStr, undefined, {
          workerPath,
          corePath,
          langPath,
          gzip: false,
          logger: ocrLogger,
        });
        console.log(`[Ekadanta] [6/10] createWorker succeeded via default (blob URL) worker path`);
      } catch (blobPathErr) {
        console.warn(`[Ekadanta] [6/10] createWorker via blob URL path FAILED — retrying with direct extension worker URL`, describeError(blobPathErr));
        workerInstance = await Tesseract.createWorker(langStr, undefined, {
          workerPath,
          corePath,
          langPath,
          workerBlobURL: false,
          gzip: false,
          logger: ocrLogger,
        });
        console.log(`[Ekadanta] [6/10] createWorker succeeded via direct extension worker URL path`);
      }
    } catch (createErr) {
      console.error(`[Ekadanta] [6/10] Tesseract.createWorker() THREW (both paths)`, describeError(createErr));
      throw createErr;
    } finally {
      clearInterval(heartbeat);
    }
    console.log(`[Ekadanta] [6/10] createWorker() returned:`, {
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

    console.log(`[Ekadanta] [6/10] Worker created in ${Math.round(performance.now() - workerStart)}ms`);
    logger.info('OCRService: worker initialized');
  }

  private async recognizeInBackground(imageData: string): Promise<OcrResult> {
    console.log(`[Ekadanta] [7/10] OCR started (background worker)`);
    const startTime = performance.now();
    eventBus.emit('ocr:started', undefined);
    eventBus.emit('status:update', { status: 'busy', message: 'Performing OCR...' });

    try {
      const langStr = await this.getActiveLanguageString();
      const response = await withTimeout(
        browserMessaging.sendMessage<OcrRecognizeResponse>({
          type: 'ocr:recognize',
          imageData,
          language: langStr,
          source: 'content',
          target: 'background',
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        }),
        30000,
        'background OCR recognize',
      );

      if (response?.success !== true || !response.result) {
        throw new Error(response?.error ?? 'Background OCR returned failure');
      }

      const ocrResult: OcrResult = response.result;
      const duration = performance.now() - startTime;
      ocrResult.duration = duration;

      console.log(`[Ekadanta] [8/10] OCR finished ✓ (background)`, {
        textLength: ocrResult.text.length,
        confidence: ocrResult.confidence.toFixed(1) + '%',
        blockCount: ocrResult.blocks.length,
        executionTimeMs: Math.round(duration),
      });

      if (ocrResult.text.length === 0) {
        console.warn(`[Ekadanta] [8/10] OCR returned empty text (confidence: ${ocrResult.confidence})`);
      }

      eventBus.emit('ocr:completed', ocrResult);
      eventBus.emit('status:update', { status: 'ready', message: 'OCR completed' });
      logger.info('OCR completed (background)', { confidence: ocrResult.confidence, chars: ocrResult.text.length, duration: `${Math.round(duration)}ms` });

      return ocrResult;
    } catch (error) {
      console.error(`[Ekadanta] [7/10] OCR FAILED (background)`, {
        message: getErrorMessage(error),
        stack: getErrorStack(error),
        durationMs: Math.round(performance.now() - startTime),
        type: typeof error,
      });
      const safeErr = error instanceof Error ? error : new Error(getErrorMessage(error));
      // The background service worker idles out after ~30s. A page that cached
      // backgroundMode=true then hits a dead worker on the next capture;
      // without this reset every later attempt reuses the stale mode and fails
      // the same way (continuous failing scans). Clearing the cached mode
      // forces the next recognize through initialize() → probe → re-init.
      this.backgroundMode = false;
      this.initialized = false;
      eventBus.emit('ocr:failed', safeErr);
      eventBus.emit('status:update', { status: 'error', message: 'OCR failed' });
      throw safeErr;
    }
  }

  async recognize(imageData: string, _language?: OcrLanguage): Promise<OcrResult> {
    if (this._disposed) throw new Error('OCRService disposed');
    console.log(`[Ekadanta] [7/10] OCR started`);

    const ready = await this.initialize();
    if (!ready) {
      const errMsg = 'OCR worker not available';
      console.error(`[Ekadanta] [7/10] OCR FAILED: ${errMsg}`);
      throw new Error(errMsg);
    }

    await this.syncMode();

    if (this.backgroundMode) {
      return this.recognizeInBackground(imageData);
    }

    const startTime = performance.now();
    eventBus.emit('ocr:started', undefined);
    eventBus.emit('status:update', { status: 'busy', message: 'Performing OCR...' });

    try {
      const manager = this.getOrCreateManager();
      const result = await manager.recognize(imageData, _language);
      result.duration = performance.now() - startTime;

      console.log(`[Ekadanta] [8/10] OCR finished ✓`, {
        textLength: result.text.length,
        confidence: result.confidence.toFixed(1) + '%',
        blockCount: result.blocks.length,
        executionTimeMs: Math.round(result.duration),
        engine: result.engine?.provider,
        route: result.engine?.routeReason,
        retried: result.engine?.retried ?? false,
        codeScore: result.engine?.codeScore,
        textScore: result.engine?.textScore,
      });

      if (result.text.length === 0) {
        console.warn(`[Ekadanta] [8/10] OCR returned empty text (confidence: ${result.confidence})`);
      }

      eventBus.emit('ocr:completed', result);
      eventBus.emit('status:update', { status: 'ready', message: 'OCR completed' });
      logger.info('OCR completed', { confidence: result.confidence, chars: result.text.length, duration: `${Math.round(result.duration)}ms`, engine: result.engine?.provider });

      return result;
    } catch (error) {
      console.error(`[Ekadanta] [7/10] OCR FAILED`, {
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

  /**
   * Local (in-page) Tesseract recognition, invoked by OCRManager. Pure
   * recognition — no routing/events here.
   */
  private async recognizeWithLocalWorker(imageData: string, language?: OcrLanguage): Promise<OcrResult> {
    const worker = this.worker;
    if (!worker) throw new Error('OCR worker not available');

    const startTime = performance.now();
    const result = await timeoutOCR(
      worker.recognize(imageData, {}, { blocks: true })
    ) as Awaited<ReturnType<TesseractWorker['recognize']>>;

    const text = result.data.text || '';
    const confidence = typeof result.data.confidence === 'number' ? result.data.confidence : 0;
    const blocks = flattenTesseractBlocks(result.data.blocks);

    if (text.length === 0) {
      console.warn(`[Ekadanta] [8/10] OCR returned empty text (confidence: ${confidence})`);
    }

    return {
      text,
      confidence,
      blocks,
      language: language ?? 'eng',
      duration: performance.now() - startTime,
    };
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

  /**
   * Rebuild the OCR worker with the current language settings.
   * Called when the secondary language setting changes.
   *
   * Always resets the cached init state, even when no worker exists yet (e.g.
   * a tab or PDF window that loaded before the language was downloaded): the
   * next initialize()/recognize() then re-reads the active language and picks
   * up the new traineddata without needing a browser restart.
   */
  async rebuildWorker(): Promise<void> {
    console.log(`[Ekadanta] [6/10] Rebuilding OCR worker for language change...`);

    if (this.worker && !this.backgroundMode) {
      try {
        await this.worker.terminate();
      } catch {
        // ignore
      }
      this.worker = null;
    }

    if (this.backgroundMode) {
      try {
        await browserMessaging.sendMessage({
          type: 'ocr:terminate',
          source: 'content',
          target: 'background',
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        });
      } catch {
        // ignore
      }
    }

    this.initialized = false;
    this.workerInitPromise = null;
    this.backgroundMode = false;

    console.log(`[Ekadanta] [6/10] OCR worker reset — will re-init with the current language on next recognize()`);
  }
}

export const ocrService = OCRService.getInstance();
