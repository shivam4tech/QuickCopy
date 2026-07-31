import type { OverlayState, CaptureResult, OcrResult, ThemeMode } from './index';
import type { ExtensionSettings } from './settings';

export interface EventMap {
  'app:ready': void;
  'app:error': Error;

  'overlay:shown': void;
  'overlay:hidden': void;
  'overlay:stateChange': OverlayState;

  'capture:started': void;
  'capture:completed': CaptureResult;
  'capture:failed': Error;

  'ocr:started': void;
  'ocr:completed': OcrResult;
  'ocr:failed': Error;

  'postprocessing:started': void;
  'postprocessing:completed': OcrResult;

  'clipboard:written': boolean;
  'clipboard:failed': Error;

  'sidebar:opened': void;
  'sidebar:closed': void;
  'sidebar:toggled': boolean;

  'settings:changed': Partial<ExtensionSettings>;
  'settings:loaded': ExtensionSettings;

  'theme:changed': ThemeMode;

  'shortcut:triggered': string;

  'pipeline:stateChange': string;

  'status:update': { status: string; message?: string };
}

export type EventHandler<T = void> = (data: T) => void;

export type Unsubscribe = () => void;

export interface EventBusInterface {
  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): Unsubscribe;
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void;
  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void;
  clear(): void;
}
