import type { ThemeMode, CopyBehavior, OcrLanguage, SidebarPosition } from './index';

export interface ExtensionSettings {
  theme: ThemeMode;
  sidebarDuration: number;
  sidebarPosition: SidebarPosition;
  shortcutCapture: string;
  shortcutSidebar: string;
  ocrLanguage: OcrLanguage;
  copyBehavior: CopyBehavior;
  autoCopy: boolean;
  /** When on, copied text always ends with a newline; when off, trailing newlines are stripped */
  appendNewline: boolean;
  showPanel: boolean;
  showConfirmation: boolean;
  enableContextMenu: boolean;
  privacyMode: boolean;
  telemetry: boolean;
  smartCleanup: boolean;
  programmingCleanup: boolean;
  markdownCleanup: boolean;
  terminalCleanup: boolean;
  debugMode: boolean;
  confidenceThreshold: number;
  /** OCR engine selection: auto routing, force text (Tesseract), force code, or auto+debug */
  ocrMode: 'auto' | 'text' | 'code' | 'debug';
}

export type SettingsKey = keyof ExtensionSettings;

export const defaultSettings: ExtensionSettings = {
  theme: 'dark',
  sidebarDuration: 10000,
  sidebarPosition: 'right',
  shortcutCapture: 'Alt+Shift+C',
  shortcutSidebar: 'Alt+Shift+S',
  ocrLanguage: 'eng',
  copyBehavior: 'smart',
  autoCopy: true,
  appendNewline: true,
  showPanel: true,
  showConfirmation: true,
  enableContextMenu: true,
  privacyMode: false,
  telemetry: false,
  smartCleanup: true,
  programmingCleanup: true,
  markdownCleanup: true,
  terminalCleanup: true,
  debugMode: false,
  confidenceThreshold: 60,
  ocrMode: 'auto',
};

export interface SettingsGroup {
  id: string;
  title: string;
  description: string;
  settings: SettingsField[];
}

export interface SettingsField {
  key: SettingsKey;
  label: string;
  description: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'shortcut';
  options?: { label: string; value: string }[];
  placeholder?: string;
}
