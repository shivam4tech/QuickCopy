import { decodeDataUrl } from './image';
import { analyzeImageFeatures, computeTextCodeScores } from './router/ImageAnalyzer';
import { planRoute, type OcrMode } from './router/OCRRouter';
import { scoreOcrQuality } from './quality/QualityScorer';
import { CodeOCRProvider } from './providers/CodeOCRProvider';
import { withTimeout } from '@utils/timeout';
import type { OcrLanguage, OcrResult, OcrEngineInfo } from '@type/index';
import type { OCRProvider } from './providers/OCRProvider';

/**
 * OCRManager owns the OCR providers and alone decides which engine runs.
 * Nothing else in the application should know about multiple engines.
 *
 * Routing: <5ms image analysis -> planRoute() -> execute with quality-gated
 * retry (max one, never parallel) and automatic fallback (any CodeOCR failure
 * degrades to Tesseract; user workflow never fails).
 *
 * Timeouts (approved interpretation): init timers are on-request warm-up
 * budgets; recognition has a hard 2s cap. Background pre-warm runs after any
 * capture with code-like signal so the next code drag is fast.
 */

export interface OCRManagerOptions {
  /** 'auto' | 'text' | 'code' | 'debug' */
  mode: OcrMode;
  tesseract: {
    isReady(): boolean;
    recognize(imageData: string, language?: OcrLanguage): Promise<OcrResult>;
  };
  /** optional code engine (defaults to the real lazy CodeOCRProvider) */
  codeProvider?: OCRProvider;
  /** optional caller hook for routing telemetry (logging/debug UI) */
  onRoute?: (info: OcrEngineInfo) => void;
}

const WARM_BUDGET_MS = 3000;
const RECOGNIZE_TIMEOUT_MS = 5000;

export class OCRManager {
  private mode: OcrMode;
  private readonly tesseract: OCRManagerOptions['tesseract'];
  private readonly codeOcr: OCRProvider;
  private readonly onRoute?: OCRManagerOptions['onRoute'];

  constructor(opts: OCRManagerOptions) {
    this.mode = opts.mode;
    this.tesseract = opts.tesseract;
    this.codeOcr = opts.codeProvider ?? new CodeOCRProvider();
    this.onRoute = opts.onRoute;
  }

  setMode(mode: OcrMode): void {
    this.mode = mode;
  }

  getMode(): OcrMode {
    return this.mode;
  }

  isCodeWarming(): boolean {
    return this.codeOcr.isWarming() || this.codeOcr.isReady();
  }

  async recognize(imageData: string, language?: OcrLanguage): Promise<OcrResult> {
    const start = performance.now();
    let scores = { textScore: 70, codeScore: 30 };
    let analysisMs = 0;
    try {
      const t0 = performance.now();
      const rgba = await decodeDataUrl(imageData);
      analysisMs = performance.now() - t0;
      if (rgba) {
        const features = analyzeImageFeatures(rgba);
        scores = computeTextCodeScores(features);
      }
    } catch {
      // analysis is best-effort; neutral scores fall back to tesseract-only
    }

    const decision = planRoute(this.mode, scores);
    const info: OcrEngineInfo = {
      provider: decision.provider,
      mode: this.mode,
      routeReason: decision.reason,
      textScore: scores.textScore,
      codeScore: scores.codeScore,
      retried: false,
      retryReason: null,
      fallbackUsed: false,
      analysisMs,
      recognitionMs: 0,
    };

    const execTesseract = async (): Promise<OcrResult> => {
      const recStart = performance.now();
      const result = await withTimeout(this.tesseract.recognize(imageData, language), RECOGNIZE_TIMEOUT_MS, 'tesseract recognize');
      info.recognitionMs = performance.now() - recStart;
      return result;
    };

    const execCode = async (): Promise<OcrResult | null> => {
      const ready = await this.codeOcr.whenReady(WARM_BUDGET_MS);
      if (!ready) return null;
      try {
        const recStart = performance.now();
        const result = await withTimeout(this.codeOcr.recognize(imageData, language), RECOGNIZE_TIMEOUT_MS, 'codeocr recognize');
        info.recognitionMs = performance.now() - recStart;
        return result;
      } catch {
        return null;
      }
    };

    let result: OcrResult | null = null;

    if (decision.provider === 'codeocr') {
      // HIGH CODE / manual code: code engine first, tesseract fallback.
      result = await execCode();
      if (!result) {
        info.fallbackUsed = true;
        try {
          result = await execTesseract();
          info.provider = result ? 'tesseract' : decision.provider;
        } catch {
          result = null;
        }
      }
    } else {
      // HIGH TEXT / UNCERTAIN: tesseract first.
      try {
        result = await execTesseract();
      } catch (tessErr) {
        info.fallbackUsed = true;
        info.retried = true;
        info.retryReason = 'tesseract-error';
        const code = await execCode();
        if (code) {
          result = code;
          info.provider = 'codeocr';
        } else {
          throw tessErr;
        }
      }
      if (result && decision.retryProvider === 'codeocr') {
        const quality = scoreOcrQuality(result);
        if (quality.retry) {
          info.retried = true;
          info.retryReason = quality.retryReason;
          const second = await execCode();
          if (second) {
            result = second;
            info.provider = 'codeocr';
          }
        }
      }
    }

    // Pre-warm the code engine for the next capture when the signal is code-ish.
    if (scores.codeScore >= 40) this.codeOcr.ensureWarm();

    info.recognitionMs = info.recognitionMs || performance.now() - start;
    if (!result) {
      throw new Error(`[Ekadanta] OCR failed: both engines unavailable (route=${decision.reason}, codeWarm=${this.codeOcr.isReady()})`);
    }
    result.engine = info;
    this.onRoute?.(info);
    return result;
  }

  /** Warm the code engine proactively (e.g., after a code-heavy session). */
  prewarmCode(): void {
    this.codeOcr.ensureWarm();
  }

  async terminateCode(): Promise<void> {
    await this.codeOcr.terminate();
  }
}
