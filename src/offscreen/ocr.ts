import { backgroundOcrManager } from '../background/managers/BackgroundOcrManager';
import { handleOcrMessage } from '../background/ocrHost';
import { handleClipboardWrite } from '../background/clipboardHost';
import type { ExtensionMessage, MessageResponse } from '@type/messages';
import { initConsoleGate } from '@utils/logGate';

initConsoleGate();

console.log(`[QuickCopy:OCR] Offscreen OCR host starting... (build: ${__BUILD_ID__})`);

backgroundOcrManager.init().then(({ success, reason }) => {
  console.log(`[QuickCopy:OCR] Auto-init result:`, success ? 'ready' : reason ?? 'unknown');
}).catch((err) => {
  console.error(`[QuickCopy:OCR] Auto-init threw`, err);
});

chrome.runtime.onMessage.addListener((
  message: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void,
) => {
  if (message.source !== 'background') return false;

  if (message.type === 'clipboard:write') {
    handleClipboardWrite(message, sendResponse);
    return true;
  }

  if (message.type === 'ocr:init' || message.type === 'ocr:recognize' || message.type === 'ocr:terminate') {
    return handleOcrMessage(message, sendResponse);
  }

  return false;
});
