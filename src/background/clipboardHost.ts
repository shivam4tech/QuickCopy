import { getErrorMessage } from '@utils/logger';
import type { ClipboardWriteMessage, ClipboardWriteResponse, MessageResponse } from '@type/messages';

export function handleClipboardWrite(
  message: ClipboardWriteMessage,
  sendResponse: (response: MessageResponse) => void,
): void {
  const write = async (): Promise<ClipboardWriteResponse> => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return { success: false, error: 'Clipboard API unavailable in this context' };
    }
    try {
      if (message.format === 'formatted') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([message.text], { type: 'text/plain' }),
            'text/html': new Blob([message.text], { type: 'text/html' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(message.text);
      }
      console.log(`[QuickCopy:Clipboard] written in background (${message.format}, ${message.text.length} chars)`);
      return { success: true };
    } catch (err) {
      console.error(`[QuickCopy:Clipboard] background write FAILED`, getErrorMessage(err));
      return { success: false, error: getErrorMessage(err) };
    }
  };

  write().then((resp) => {
    sendResponse(resp);
  }).catch((err) => {
    sendResponse({ success: false, error: getErrorMessage(err) });
  });
}
