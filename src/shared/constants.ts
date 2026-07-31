export const EXTENSION_NAME = 'QuickCopy';
export const EXTENSION_VERSION = '0.2.0';

export const STORAGE_KEYS = {
  SETTINGS: 'quickcopy:settings',
  THEME: 'quickcopy:theme',
  HISTORY: 'quickcopy:history',
} as const;

export const MESSAGE_IDS = {
  CAPTURE_REGION: 'quickcopy:capture-region',
  CAPTURE_VIEWPORT: 'quickcopy:capture-viewport',
  OCR_REQUEST: 'quickcopy:ocr-request',
  OCR_RESULT: 'quickcopy:ocr-result',
  CLIPBOARD_WRITE: 'quickcopy:clipboard-write',
  OVERLAY_SHOW: 'quickcopy:overlay-show',
  OVERLAY_HIDE: 'quickcopy:overlay-hide',
  SIDEBAR_TOGGLE: 'quickcopy:sidebar-toggle',
  SIDEBAR_OPEN: 'quickcopy:sidebar-open',
  SIDEBAR_CLOSE: 'quickcopy:sidebar-close',
  SETTINGS_CHANGED: 'quickcopy:settings-changed',
  THEME_CHANGED: 'quickcopy:theme-changed',
  SHORTCUT_TRIGGERED: 'quickcopy:shortcut-triggered',
  STATUS_UPDATE: 'quickcopy:status-update',
} as const;

export const OVERLAY_Z_INDEX = 2147483646;
export const SIDEBAR_Z_INDEX = 2147483647;

export const SIDEBAR_WIDTH = 360;
export const SIDEBAR_ANIMATION_DURATION = 250;

export const DEFAULT_SIDEBAR_DURATION = 10000;

export const REGION_SELECTION_MIN_SIZE = 10;

export const CONTENT_SCRIPT_ID = 'quickcopy-root';
export const OVERLAY_ID = 'quickcopy-overlay';
export const SIDEBAR_ID = 'quickcopy-sidebar';
