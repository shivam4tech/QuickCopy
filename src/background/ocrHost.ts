import { backgroundOcrManager } from './managers/BackgroundOcrManager';
import { getErrorMessage } from '@utils/logger';
import type { ExtensionMessage, MessageResponse } from '@type/messages';

const OCR_RECOGNIZE_TIMEOUT_MS = 5000;

export function handleOcrMessage(
  message: ExtensionMessage,
  sendResponse: (response: MessageResponse) => void,
): boolean {
  if (message.type === 'ocr:init') {
    const status = backgroundOcrManager.getStatus();
    const language = 'language' in message && typeof message.language === 'string'
      ? message.language
      : undefined;
    if (status === 'ready' && backgroundOcrManager.getActiveLanguage() === (language ?? 'eng')) {
      sendResponse({ success: true, mode: 'background' } as unknown as MessageResponse);
    } else if (status === 'unavailable') {
      sendResponse({ success: false, mode: 'local', reason: 'worker-unavailable' } as unknown as MessageResponse);
    } else {
      backgroundOcrManager.init(language).then(({ success, reason }) => {
        console.log(`[Ekadanta:OCR] async ocr:init completed`, { success, reason });
      }).catch((err) => {
        console.error(`[Ekadanta:OCR] async ocr:init handler FAILED`, getErrorMessage(err));
      });
      sendResponse({ success: false, mode: 'local', reason: status === 'failed' ? 'init-failed' : 'not-ready' } as unknown as MessageResponse);
    }
    return true;
  }
  if (message.type === 'ocr:recognize') {
    let responded = false;
    const timer = setTimeout(() => {
      if (responded) return;
      responded = true;
      console.error(`[Ekadanta:OCR] ocr:recognize TIMEOUT (${OCR_RECOGNIZE_TIMEOUT_MS}ms)`);
      sendResponse({ success: false, error: 'OCR recognize timed out' } as unknown as MessageResponse);
    }, OCR_RECOGNIZE_TIMEOUT_MS);

    backgroundOcrManager.recognize(message.imageData, message.language)
      .then((result) => {
        if (responded) return;
        responded = true;
        clearTimeout(timer);
        sendResponse({ success: true, result } as unknown as MessageResponse);
      })
      .catch((err) => {
        if (responded) return;
        responded = true;
        clearTimeout(timer);
        console.error(`[Ekadanta:OCR] ocr:recognize handler FAILED`, getErrorMessage(err));
        sendResponse({ success: false, error: getErrorMessage(err) } as unknown as MessageResponse);
      });
    return true;
  }
  if (message.type === 'ocr:terminate') {
    backgroundOcrManager.terminate().then(() => {
      sendResponse({ success: true } as MessageResponse);
    });
    return true;
  }
  return false;
}
