export const EXTENSION_NAME = 'Ekadanta';
export const EXTENSION_VERSION = '1.5.2';

export const STORAGE_KEYS = {
  SETTINGS: 'ekadanta:settings',
  THEME: 'ekadanta:theme',
  HISTORY: 'ekadanta:history',
} as const;

export const MESSAGE_IDS = {
  CAPTURE_REGION: 'ekadanta:capture-region',
  CAPTURE_VIEWPORT: 'ekadanta:capture-viewport',
  OCR_REQUEST: 'ekadanta:ocr-request',
  OCR_RESULT: 'ekadanta:ocr-result',
  CLIPBOARD_WRITE: 'ekadanta:clipboard-write',
  OVERLAY_SHOW: 'ekadanta:overlay-show',
  OVERLAY_HIDE: 'ekadanta:overlay-hide',
  SIDEBAR_TOGGLE: 'ekadanta:sidebar-toggle',
  SIDEBAR_OPEN: 'ekadanta:sidebar-open',
  SIDEBAR_CLOSE: 'ekadanta:sidebar-close',
  SETTINGS_CHANGED: 'ekadanta:settings-changed',
  THEME_CHANGED: 'ekadanta:theme-changed',
  SHORTCUT_TRIGGERED: 'ekadanta:shortcut-triggered',
  STATUS_UPDATE: 'ekadanta:status-update',
} as const;

export const OVERLAY_Z_INDEX = 2147483647;
export const SIDEBAR_Z_INDEX = 2147483647;

export const SIDEBAR_WIDTH = 360;
export const SIDEBAR_ANIMATION_DURATION = 250;

export const DEFAULT_SIDEBAR_DURATION = 10000;

// Only degenerate (zero-size) boxes cancel: drags are already gated by the
// 8px engagement threshold, and a 10px minimum here forced users to drag
// *past* small targets (images) so the box spanned the surrounding text.
export const REGION_SELECTION_MIN_SIZE = 1;

export const CONTENT_SCRIPT_ID = 'ekadanta-root';
export const OVERLAY_ID = 'ekadanta-overlay';
export const SIDEBAR_ID = 'ekadanta-sidebar';
