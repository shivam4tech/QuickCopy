import { getErrorMessage } from '@utils/logger';

let offscreenCreation: Promise<boolean> | null = null;

const getOffscreenContexts = chrome.runtime.getContexts as (
  filter: chrome.runtime.ContextFilter,
) => Promise<chrome.runtime.ExtensionContext[]>;

export async function ensureOffscreenDocument(): Promise<boolean> {
  if (typeof chrome.offscreen === 'undefined') {
    console.log(`[Ekadanta:Background] chrome.offscreen API unavailable`);
    return false;
  }
  if (!offscreenCreation) {
    offscreenCreation = (async () => {
      try {
        const contexts = await getOffscreenContexts({
          contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
        });
        if (contexts.length > 0) {
          console.log(`[Ekadanta:Background] offscreen document already present`);
          return true;
        }
      } catch (err) {
        console.warn(`[Ekadanta:Background] getContexts failed, will try createDocument`, getErrorMessage(err));
      }
      try {
        await chrome.offscreen.createDocument({
          url: 'src/offscreen/index.html',
          reasons: [chrome.offscreen.Reason.WORKERS, chrome.offscreen.Reason.CLIPBOARD],
          justification: 'Host the Tesseract OCR worker and reliable clipboard writes (Chrome service workers cannot construct Workers or focus the clipboard).',
        });
        console.log(`[Ekadanta:Background] offscreen document created`);
        return true;
      } catch (err) {
        console.error(`[Ekadanta:Background] offscreen createDocument FAILED`, getErrorMessage(err));
        offscreenCreation = null;
        return false;
      }
    })();
  }
  return offscreenCreation;
}
