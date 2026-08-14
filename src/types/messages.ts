import type { Region, ThemeMode, CaptureResult, OcrResult } from './index';

export type MessageTarget = 'background' | 'content' | 'popup' | 'options' | 'sidebar' | 'offscreen';

export interface MessageBase {
  source: MessageTarget;
  target: MessageTarget;
  id: string;
  timestamp: number;
}

export interface CaptureRegionMessage extends MessageBase {
  type: 'capture:region';
  region: Region;
}

export interface CaptureViewportMessage extends MessageBase {
  type: 'capture:viewport';
}

export interface CaptureCompleteMessage extends MessageBase {
  type: 'capture:complete';
  result: CaptureResult;
}

export interface OcrInitMessage extends MessageBase {
  type: 'ocr:init';
  language?: string;
}

export interface OcrRecognizeMessage extends MessageBase {
  type: 'ocr:recognize';
  imageData: string;
  language?: string;
}

export interface OcrTerminateMessage extends MessageBase {
  type: 'ocr:terminate';
}

export interface OcrInitResponse {
  success: boolean;
  mode?: 'background' | 'local';
  reason?: string;
}

export interface OcrRecognizeResponse {
  success: boolean;
  result?: OcrResult;
  error?: string;
}

export interface OcrResultMessage extends MessageBase {
  type: 'ocr:result';
  result: OcrResult;
}

export interface OcrErrorMessage extends MessageBase {
  type: 'ocr:error';
  error: string;
}

export interface ClipboardWriteMessage extends MessageBase {
  type: 'clipboard:write';
  text: string;
  format: 'plain' | 'formatted';
}

export interface ClipboardWriteResponse {
  success: boolean;
  error?: string;
}

export interface ClipboardResultMessage extends MessageBase {
  type: 'clipboard:result';
  success: boolean;
}

export interface OverlayShowMessage extends MessageBase {
  type: 'overlay:show';
  mode: 'region' | 'viewport' | 'element';
}

export interface OverlayHideMessage extends MessageBase {
  type: 'overlay:hide';
}

export interface SidebarToggleMessage extends MessageBase {
  type: 'sidebar:toggle';
}

export interface SidebarOpenMessage extends MessageBase {
  type: 'sidebar:open';
}

export interface SidebarCloseMessage extends MessageBase {
  type: 'sidebar:close';
}

export interface SettingsChangedMessage extends MessageBase {
  type: 'settings:changed';
  settings: Record<string, unknown>;
}

export interface ThemeChangedMessage extends MessageBase {
  type: 'theme:changed';
  theme: ThemeMode;
}

export interface ShortcutTriggeredMessage extends MessageBase {
  type: 'shortcut:triggered';
  shortcut: string;
}

export interface StatusUpdateMessage extends MessageBase {
  type: 'status:update';
  status: 'ready' | 'busy' | 'error' | 'idle';
  message?: string;
}

export interface DiagnosticLogMessage extends MessageBase {
  type: 'diag:log';
  label: string;
  payload: Record<string, unknown>;
}

export interface LanguagesGetDataMessage extends MessageBase {
  type: 'languages:get-data';
  code: string;
}

export interface PdfOpenWindowMessage extends MessageBase {
  type: 'pdf:open-window';
  pdfUrl: string;
}

export interface KeepaliveMessage extends MessageBase {
  type: 'keepalive';
}

export interface LanguagesGetDataResponse {
  success: boolean;
  /** Base64-encoded traineddata — runtime messaging JSON-serializes, so raw bytes are unsafe. */
  dataBase64?: string;
  size?: number;
  error?: string;
}

export type ExtensionMessage =
  | CaptureRegionMessage
  | CaptureViewportMessage
  | CaptureCompleteMessage
  | OcrInitMessage
  | OcrRecognizeMessage
  | OcrTerminateMessage
  | OcrResultMessage
  | OcrErrorMessage
  | ClipboardWriteMessage
  | ClipboardResultMessage
  | OverlayShowMessage
  | OverlayHideMessage
  | SidebarToggleMessage
  | SidebarOpenMessage
  | SidebarCloseMessage
  | SettingsChangedMessage
  | ThemeChangedMessage
  | ShortcutTriggeredMessage
  | StatusUpdateMessage
  | DiagnosticLogMessage
  | LanguagesGetDataMessage
  | PdfOpenWindowMessage
  | KeepaliveMessage;

export type MessageHandler<T = unknown> = (
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
) => T | Promise<T>;

export type MessageResponse = { success: boolean } | { error: string };
