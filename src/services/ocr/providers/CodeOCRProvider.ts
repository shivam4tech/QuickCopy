import type { OCRProvider } from './OCRProvider';
import { decodeDataUrl } from '../image';
import type { OcrLanguage, OcrResult, OcrBlock } from '@type/index';

/**
 * PP-OCRv5 code OCR engine via @ocr-web/core + onnxruntime-web.
 *
 * Lazy: never initialized at startup. ensureWarm() loads the worker + models
 * only when the router decides code. Models and ORT wasm are self-hosted under
 * chrome-extension:// (public/codeocr, public/ort) and fetched on demand.
 */

interface OcrLine {
  text: string;
  box: number[][];
  confidence: number;
}

interface CodeOcrEngineLike {
  recognize(input: unknown, opts?: Record<string, unknown>): Promise<{ lines: OcrLine[]; fullText: string; durationMs: number }>;
  dispose(): Promise<void>;
}

const WARM_BUDGET_MS = 3000;

function quadToRect(box: number[][]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of box) {
    const x = point[0];
    const y = point[1];
    if (x === undefined || y === undefined) continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: Math.round(minX), y: Math.round(minY), width: Math.round(maxX - minX), height: Math.round(maxY - minY) };
}

export class CodeOCRProvider implements OCRProvider {
  readonly id = 'codeocr' as const;
  private engine: CodeOcrEngineLike | null = null;
  private worker: Worker | null = null;
  private ready = false;
  private warming = false;
  private warmPromise: Promise<boolean> | null = null;

  ensureWarm(): void {
    if (this.ready || this.warming) return;
    this.warming = true;
    this.warmPromise = this.createEngine()
      .then((ok) => {
        this.ready = ok;
        this.warming = false;
        return ok;
      })
      .catch(() => {
        this.ready = false;
        this.warming = false;
        return false;
      });
  }

  whenReady(timeoutMs: number): Promise<boolean> {
    if (this.ready) return Promise.resolve(true);
    this.ensureWarm();
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(this.ready), timeoutMs);
      (this.warmPromise ?? Promise.resolve(false)).then((ok) => {
        clearTimeout(timer);
        resolve(ok);
      });
    });
  }

  private async createEngine(): Promise<boolean> {
    try {
      if (typeof Worker === 'undefined') {
        console.warn(`[QuickCopy] CodeOCR skipped: no Worker API in this context (service worker)`);
        return false;
      }
      console.log(`[QuickCopy] CodeOCR warm-up starting (loading PP-OCRv5 + onnxruntime-web)...`);
      const t0 = performance.now();
      const workerUrlMod = await import('@ocr-web/core/worker?worker&url');
      const { OcrEngineWorker } = await import('@ocr-web/core');
      const worker = new Worker(workerUrlMod.default);
      this.worker = worker;

      const baseUrl = chrome.runtime.getURL('codeocr/');
      const wasmPaths = chrome.runtime.getURL('ort/');
      this.engine = (await OcrEngineWorker.create({
        worker,
        models: {
          detection: `${baseUrl}ppocrv5_det.onnx`,
          recognition: `${baseUrl}ppocrv5_rec.onnx`,
        },
        dictionary: `${baseUrl}ppocrv5_dict.txt`,
        runtime: 'wasm',
        wasmPaths,
        numThreads: 1,
        onProgress: (p: { loaded: number; total: number; file: string }) => {
          if (p.loaded === p.total) {
            console.log(`[QuickCopy] CodeOCR loaded ${p.file} in ${Math.round(performance.now() - t0)}ms`);
          }
        },
      })) as unknown as CodeOcrEngineLike;
      console.log(`[QuickCopy] CodeOCR worker ready in ${Math.round(performance.now() - t0)}ms`);
      return true;
    } catch (err) {
      console.error('[QuickCopy] CodeOCR warm-up FAILED', err);
      try {
        this.worker?.terminate();
      } catch {
        /* noop */
      }
      this.worker = null;
      this.engine = null;
      return false;
    }
  }

  async initialize(): Promise<boolean> {
    this.ensureWarm();
    const ok = await this.whenReady(WARM_BUDGET_MS);
    return ok;
  }

  isReady(): boolean {
    return this.ready;
  }

  isWarming(): boolean {
    return this.warming;
  }

  async recognize(imageData: string, language?: OcrLanguage): Promise<OcrResult> {
    if (!this.engine) throw new Error('CodeOCR engine unavailable');
    const decoded = await decodeDataUrl(imageData);
    if (!decoded) throw new Error('CodeOCR cannot decode image in this context');

    const bytes = new Uint8ClampedArray(decoded.data);
    const image: ImageData = new ImageData(bytes, decoded.width, decoded.height);
    const start = performance.now();
    const result = await this.engine.recognize(image, {
      useClassification: false,
      maxSideLen: 1024,
    });

    const blocks: OcrBlock[] = result.lines.map((line) => ({
      text: line.text,
      confidence: Math.max(0, Math.min(100, line.confidence * 100)),
      bbox: quadToRect(line.box),
    }));
    const confidence = blocks.length > 0 ? blocks.reduce((a, b) => a + b.confidence, 0) / blocks.length : 0;

    return {
      text: result.fullText,
      confidence,
      blocks,
      language: language ?? 'eng',
      duration: result.durationMs || performance.now() - start,
    };
  }

  async terminate(): Promise<void> {
    if (this.engine) {
      try {
        await this.engine.dispose();
      } catch {
        /* noop */
      }
    }
    this.engine = null;
    this.worker = null;
    this.ready = false;
    this.warming = false;
    this.warmPromise = null;
  }
}
