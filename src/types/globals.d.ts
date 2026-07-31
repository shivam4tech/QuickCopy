import type { BrowserType, CaptureResult, OcrResult, Region, ThemeMode, LogLevel } from './index';
import type { ExtensionSettings } from './settings';
import type { EventMap, EventHandler, Unsubscribe, EventBusInterface } from './events';
import type { ExtensionMessage, MessageHandler, MessageResponse } from './messages';
import type { OcrServiceInterface, CaptureServiceInterface, ClipboardServiceInterface, SettingsServiceInterface } from './services';

declare global {
  const __BUILD_ID__: string;
}

export type {
  BrowserType,
  CaptureResult,
  OcrResult,
  Region,
  ThemeMode,
  LogLevel,
  ExtensionSettings,
  EventMap,
  EventHandler,
  Unsubscribe,
  EventBusInterface,
  ExtensionMessage,
  MessageHandler,
  MessageResponse,
  OcrServiceInterface,
  CaptureServiceInterface,
  ClipboardServiceInterface,
  SettingsServiceInterface,
};
