import type { OcrResult, OcrLanguage, CaptureResult, Region } from './index';

export interface OcrServiceInterface {
  initialize(): Promise<boolean>;
  recognize(imageData: string, language?: OcrLanguage): Promise<OcrResult>;
  isAvailable(): Promise<boolean>;
  getSupportedLanguages(): OcrLanguage[];
  terminate(): Promise<void>;
}

export interface CaptureServiceInterface {
  captureRegion(region: Region): Promise<CaptureResult>;
  captureViewport(): Promise<CaptureResult>;
  captureElement(elementSelector: string): Promise<CaptureResult>;
}

export interface ClipboardServiceInterface {
  copy(text: string, behavior?: string): Promise<boolean>;
  read(): Promise<string>;
  isAvailable(): Promise<boolean>;
}

export interface SettingsServiceInterface {
  load(): Promise<Record<string, unknown>>;
  get<K extends string>(key: K): Promise<unknown>;
  getAll(): Promise<Record<string, unknown>>;
  set<K extends string>(key: K, value: unknown): Promise<void>;
  setMultiple(updates: Record<string, unknown>): Promise<void>;
  reset(): Promise<void>;
}
