import { settingsService } from '@services/SettingsService';
import { BrowserCompat } from '@compat/BrowserCompat';
import { shortcutManager } from './managers/ShortcutManager';
import { themeManager } from './managers/ThemeManager';
import { handleOcrMessage } from './ocrHost';
import { ensureOffscreenDocument } from './offscreenHost';
import { handleClipboardWrite } from './clipboardHost';
import { eventBus } from '@utils/eventBus';
import { logger } from '@utils/logger';
import { EXTENSION_NAME, EXTENSION_VERSION } from '@shared/constants';
import { getErrorMessage, getErrorStack } from '@utils/logger';
import type { ExtensionMessage, MessageResponse } from '@type/messages';
import type { ThemeMode } from '@type/index';
import type { LanguagesGetDataMessage, LanguagesGetDataResponse, PdfOpenWindowMessage } from '@type/messages';
import { languageManager } from '@services/ocr/LanguageManager';
import { browserMessaging } from '@compat/messaging';
import { arrayBufferToBase64 } from '@utils/encoding';
import { detectPdfUrl } from '../pdf/PdfDetector';
import { pdfWindowManager } from '../pdf/PdfWindowManager';
import { STORAGE_KEYS } from '@shared/constants';
import { defaultSettings, type ExtensionSettings } from '@type/settings';

console.log(`[QuickCopy:Background] Service worker starting... (build: ${__BUILD_ID__})`);

async function isPaused(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const stored = result[STORAGE_KEYS.SETTINGS] as ExtensionSettings | undefined;
    return stored ? stored.enabled === false : !defaultSettings.enabled;
  } catch {
    return false;
  }
}

/**
 * Resolve the tab the user is looking at.
 *
 * `lastFocusedWindow` is used instead of `currentWindow`, which is unreliable
 * on a freshly woken service worker (the window-focus state may not be
 * resolved yet, so the query can silently return nothing). A second attempt
 * through `windows.getLastFocused` covers the remaining races.
 */
async function resolveActiveTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id != null) return tab;
  } catch (err) {
    logger.warn('resolveActiveTab: lastFocusedWindow query failed', getErrorMessage(err));
  }
  try {
    const win = await chrome.windows.getLastFocused();
    if (win.id != null) {
      const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
      if (tab?.id != null) return tab;
    }
  } catch (err) {
    logger.warn('resolveActiveTab: getLastFocused fallback failed', getErrorMessage(err));
  }
  return null;
}

async function handleCaptureRegionCommand(): Promise<void> {
  logger.info('capture-region triggered');
  if (await isPaused()) {
    logger.info('capture-region: extension paused — ignoring shortcut');
    return;
  }
  const tab = await resolveActiveTab();
  if (!tab) {
    logger.warn('capture-region: could not resolve the active tab');
    return;
  }

  const detection = detectPdfUrl(tab.url, (tab as { mimeType?: string }).mimeType);
  if (detection.pdfUrl && tab.id != null) {
    logger.info('capture-region: PDF tab detected — opening capture window', {
      pdfUrl: detection.pdfUrl,
      via: detection.via,
    });
    await pdfWindowManager.openForTab(tab.id, detection.pdfUrl);
    return;
  }

  if (tab.id == null) return;
  logger.info('capture-region: sending overlay:show to tab', { tabId: tab.id });
  await browserMessaging.sendMessageToTab(tab.id, {
    type: 'overlay:show',
    mode: 'region',
    source: 'background',
    target: 'content',
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  }).catch(err => logger.error('Failed to send overlay:show', err));
}

async function handleToggleSidebarCommand(): Promise<void> {
  logger.info('toggle-sidebar triggered');
  const tab = await resolveActiveTab();
  if (!tab?.id) return;
  await browserMessaging.sendMessageToTab(tab.id, {
    type: 'sidebar:toggle',
    source: 'background',
    target: 'content',
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  }).catch(err => logger.error('Failed to send sidebar:toggle', err));
}

/**
 * Register command handlers synchronously at module load.
 *
 * The service worker is woken BY the shortcut press, so the listener must
 * exist before the first `await` in this module — otherwise Chrome dispatches
 * `onCommand` while nothing is listening and the press is silently dropped.
 * This was the cause of intermittent "nothing happens" trigger behavior.
 */
function registerCommandHandlers(): void {
  shortcutManager.initialize();
  shortcutManager.register('capture-region', () => {
    void handleCaptureRegionCommand();
  });
  shortcutManager.register('toggle-sidebar', () => {
    void handleToggleSidebarCommand();
  });
}

registerCommandHandlers();

async function initialize(): Promise<void> {
  const compat = BrowserCompat.getInstance();
  logger.info(`${EXTENSION_NAME} v${EXTENSION_VERSION} starting`, {
    browser: compat.getBrowserName(),
    manifestVersion: compat.manifestVersion,
  });

  await settingsService.load();

  const settings = await settingsService.getAll();

  themeManager.initialize(settings.theme as ThemeMode);

  eventBus.emit('app:ready', undefined);
  logger.info(`${EXTENSION_NAME} initialized successfully`);

  if (typeof Worker === 'undefined') {
    ensureOffscreenDocument().then((ok) => {
      console.log(`[QuickCopy:Background] Offscreen OCR warm-up: ${ok ? 'ready' : 'unavailable'}`);
    }).catch((err) => {
      console.error(`[QuickCopy:Background] Offscreen OCR warm-up failed`, getErrorMessage(err));
    });
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  logger.info('Extension installed/updated', details);
});

function handleCaptureViewport(
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void,
): void {
  const windowId = sender.tab?.windowId;
  console.log(`[QuickCopy:Background] capture:viewport from tab ${sender.tab?.id}, windowId=${windowId}`);

  const CAPTURE_TIMEOUT_MS = 10000;
  let responded = false;

  const safeRespond = (response: MessageResponse) => {
    if (responded) return;
    responded = true;
    sendResponse(response);
  };

  const timer = setTimeout(() => {
    console.error(`[QuickCopy:Background] captureVisibleTab TIMEOUT (${CAPTURE_TIMEOUT_MS}ms)`);
    safeRespond({ error: 'captureVisibleTab timed out' } as MessageResponse);
  }, CAPTURE_TIMEOUT_MS);

  try {
    const captureCallback = (dataUrl: string) => {
      clearTimeout(timer);
      if (responded) return;
      const err = chrome.runtime.lastError;
      if (err) {
        console.error(`[QuickCopy:Background] captureVisibleTab FAILED`, getErrorMessage(err));
        safeRespond({ error: getErrorMessage(err) } as MessageResponse);
      } else {
        console.log(`[QuickCopy:Background] captureVisibleTab SUCCESS`, { dataUrlLength: dataUrl.length });
        safeRespond({ success: true, dataUrl } as unknown as MessageResponse);
      }
    };

    if (windowId != null) {
      chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, captureCallback);
    } else {
      chrome.tabs.captureVisibleTab({ format: 'png' }, captureCallback);
    }
  } catch (ex) {
    clearTimeout(timer);
    console.error(`[QuickCopy:Background] captureVisibleTab threw`, ex);
    safeRespond({ error: `captureVisibleTab threw: ${getErrorMessage(ex)}` } as MessageResponse);
  }
}

function relayToOffscreen(
  message: ExtensionMessage,
  sendResponse: (response: MessageResponse) => void,
): void {
  const RELAY_TIMEOUT_MS = 5000;
  let responded = false;

  const safeRespond = (resp: MessageResponse) => {
    if (responded) return;
    responded = true;
    sendResponse(resp);
  };

  const timer = setTimeout(() => {
    console.error(`[QuickCopy:Background] Offscreen relay TIMEOUT (${RELAY_TIMEOUT_MS}ms) for ${message.type}`);
    safeRespond({ success: false, error: 'Offscreen relay timed out' } as MessageResponse);
  }, RELAY_TIMEOUT_MS);

  ensureOffscreenDocument()
    .then((ok) => {
      if (!ok) {
        clearTimeout(timer);
        safeRespond({ success: false, mode: 'local', reason: 'worker-unavailable' } as unknown as MessageResponse);
        return;
      }
      return chrome.runtime.sendMessage({
        ...message,
        source: 'background',
        target: 'offscreen',
      } as ExtensionMessage);
    })
    .then((resp) => {
      clearTimeout(timer);
      if (resp) {
        safeRespond(resp as MessageResponse);
      } else {
        safeRespond({ success: false, error: 'Offscreen host did not respond' } as MessageResponse);
      }
    })
    .catch((err) => {
      clearTimeout(timer);
      console.error(`[QuickCopy:Background] Offscreen relay FAILED`, getErrorMessage(err));
      safeRespond({ success: false, error: `Offscreen relay failed: ${getErrorMessage(err)}` } as MessageResponse);
    });
}

chrome.runtime.onMessage.addListener((
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void,
) => {
  if (message.type === 'capture:viewport') {
    handleCaptureViewport(sender, sendResponse);
    return true;
  }
  if (message.type === 'ocr:init' || message.type === 'ocr:recognize' || message.type === 'ocr:terminate') {
    if (typeof Worker === 'undefined') {
      console.log(`[QuickCopy:Background] Service worker has no Worker API — relaying OCR to offscreen document`);
      relayToOffscreen(message, sendResponse);
      return true;
    }
    return handleOcrMessage(message, sendResponse);
  }
  if (message.type === 'clipboard:write') {
    if (typeof Worker === 'undefined') {
      console.log(`[QuickCopy:Background] Relaying clipboard write to offscreen document`);
      relayToOffscreen(message, sendResponse);
      return true;
    }
    handleClipboardWrite(message, sendResponse);
    return true;
  }
  if (message.type === 'diag:log') {
    console.log(`[QuickCopy:Background:diag] ${message.label}`, message.payload);
    sendResponse({ success: true });
    return true;
  }
  if (message.type === 'languages:get-data') {
    const { code } = message as LanguagesGetDataMessage;
    languageManager.getTraineddata(code)
      .then((data) => {
        const resp: LanguagesGetDataResponse = data
          ? { success: true, dataBase64: arrayBufferToBase64(data), size: data.length }
          : { success: false, error: `Language ${code} is not in the store` };
        sendResponse(resp as MessageResponse);
      })
      .catch((err) => {
        console.error(`[QuickCopy:Background] languages:get-data failed for ${code}`, err);
        sendResponse({ success: false, error: getErrorMessage(err) } as MessageResponse);
      });
    return true;
  }
  if (message.type === 'pdf:open-window') {
    const { pdfUrl } = message as PdfOpenWindowMessage;
    const tabId = sender.tab?.id;
    if (tabId != null && pdfUrl) {
      void (async () => {
        if (await isPaused()) {
          logger.info('pdf:open-window: extension paused — ignoring request');
        } else {
          logger.info('pdf:open-window requested from popup', { tabId, pdfUrl });
          void pdfWindowManager.openForTab(tabId, pdfUrl);
        }
      })();
    }
    sendResponse({ success: true });
    return true;
  }
  sendResponse({ success: true });
  return true;
});

initialize().then(() => {
  console.log(`[QuickCopy:Background] Service worker initialized`);
}).catch((error) => {
  console.error(`[QuickCopy:Background] Service worker initialization FAILED`, {
    message: getErrorMessage(error),
    stack: getErrorStack(error),
  });
  logger.error('Failed to initialize background service worker', error);
  eventBus.emit('app:error', error instanceof Error ? error : new Error(getErrorMessage(error)));
});
