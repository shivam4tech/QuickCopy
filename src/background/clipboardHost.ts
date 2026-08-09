import { getErrorMessage } from '@utils/logger';
import type { ClipboardWriteMessage, ClipboardWriteResponse, MessageResponse } from '@type/messages';

/**
 * execCommand('copy') works without document focus, unlike navigator.clipboard.
 * Chrome offscreen documents can never hold focus, so the Clipboard API throws
 * "Document is not focused" — this is the reliable path there.
 */
function copyWithExecCommand(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  } finally {
    document.body.removeChild(textarea);
  }
  return ok;
}

export function handleClipboardWrite(
  message: ClipboardWriteMessage,
  sendResponse: (response: MessageResponse) => void,
): void {
  const write = async (): Promise<ClipboardWriteResponse> => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      if (copyWithExecCommand(message.text)) {
        return { success: true };
      }
      return { success: false, error: 'Clipboard API unavailable in this context' };
    }

    try {
      // Offscreen documents can't be focused by the user; focusing here is a
      // best-effort for environments where the Clipboard API still accepts it.
      window.focus();
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
      // Offscreen documents cannot hold focus, so navigator.clipboard throws
      // "Document is not focused" here. Fall back to execCommand('copy'),
      // which only needs a selected textarea, not document focus.
      if (copyWithExecCommand(message.text)) {
        console.log(`[QuickCopy:Clipboard] written via execCommand fallback (${message.format}, ${message.text.length} chars)`);
        return { success: true };
      }
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
