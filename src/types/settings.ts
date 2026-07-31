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
