import type { OcrLanguage, OcrResult } from '@type/index';

export type OCRProviderId = 'tesseract' | 'codeocr';

/**
 * Contract every OCR engine provider implements. Providers own their own
 * preprocessing; the formatter must never care which provider produced output.
 */
export interface OCRProvider {
  readonly id: OCRProviderId;

  /** Full initialization (loads engine assets). */
  initialize(): Promise<boolean>;

  /**
   * Kick off lazy initialization without awaiting. No-op when already
   * initializing/ready. Used by the router to warm the code engine before the
   * next capture.
   */
  ensureWarm(): void;

  /**
   * Resolve true when the provider is ready, false if it fails or does not
   * become ready within the budget. Always resolves (never throws).
   */
  whenReady(timeoutMs: number): Promise<boolean>;

  isReady(): boolean;

  isWarming(): boolean;

  /** Run recognition on a captured image data URL. */
  recognize(imageData: string, language?: OcrLanguage): Promise<OcrResult>;

  terminate(): Promise<void>;
}
