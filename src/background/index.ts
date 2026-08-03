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
import { browserMessaging } from '@compat/messaging';

console.log(`[QuickCopy:Background] Service worker starting... (build: ${__BUILD_ID__})`);

async function initialize(): Promise<void> {
  const compat = BrowserCompat.getInstance();
  logger.info(`${EXTENSION_NAME} v${EXTENSION_VERSION} starting`, {
    browser: compat.getBrowserName(),
    manifestVersion: compat.manifestVersion,
  });

  await settingsService.load();

  const settings = await settingsService.getAll();

  themeManager.initialize(settings.theme as ThemeMode);

  shortcutManager.initialize();

  shortcutManager.register('capture-region', () => {
    logger.info('capture-region shortcut triggered');
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) return;
      browserMessaging.sendMessageToTab(tab.id, {
        type: 'overlay:show',
        mode: 'region',
        source: 'background',
        target: 'content',
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      }).catch(err => logger.error('Failed to send overlay:show', err));
    });
  });

  shortcutManager.register('toggle-sidebar', () => {
    logger.info('toggle-sidebar shortcut triggered');
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) return;
      browserMessaging.sendMessageToTab(tab.id, {
        type: 'sidebar:toggle',
        source: 'background',
        target: 'content',
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      }).catch(err => logger.error('Failed to send sidebar:toggle', err));
    });
  });

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
  const RELAY_TIMEOUT_MS = 65000;
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
