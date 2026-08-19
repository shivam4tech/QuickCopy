export type BrowserType = 'chrome' | 'firefox' | 'edge' | 'brave' | 'chromium';

export type ThemeMode = 'dark' | 'light' | 'system';

export type CopyBehavior = 'plain' | 'formatted' | 'smart';

export type OcrLanguage =
  | 'eng'
  | 'fra'
  | 'deu'
  | 'spa'
  | 'ita'
  | 'por'
  | 'rus'
  | 'jpn'
  | 'kor'
  | 'chi_sim'
  | 'chi_tra';

export type SidebarPosition = 'left' | 'right';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type OverlayState = 'idle' | 'selecting' | 'capturing' | 'complete';

export type CaptureMode = 'region' | 'viewport' | 'element';

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrResult {
  text: string;
  confidence: number;
  blocks: OcrBlock[];
  language: string;
  duration: number;
  /** routing/engine metadata attached by OCRManager (optional, debug) */
  engine?: OcrEngineInfo;
  /** set when the result came from the PDF capture window (drives the accuracy note in the panel) */
  fromPdf?: boolean;
}

export interface OcrEngineInfo {
  provider: 'tesseract' | 'codeocr';
  mode: 'auto' | 'text' | 'code' | 'debug';
  routeReason: string;
  textScore: number;
  codeScore: number;
  retried: boolean;
  retryReason: string | null;
  fallbackUsed: boolean;
  analysisMs: number;
  recognitionMs: number;
}

export interface OcrBlock {
  text: string;
  confidence: number;
  bbox: Region;
}

export interface CaptureResult {
  dataUrl: string;
  region: Region;
  timestamp: number;
}

export interface ExtensionInfo {
  version: string;
  name: string;
  browser: BrowserType;
  manifestVersion: 2 | 3;
}
