import type { CopyBehavior } from '@type/index';
import type { ClipboardWriteMessage, ClipboardWriteResponse } from '@type/messages';
import { eventBus } from '@utils/eventBus';
import { logger } from '@utils/logger';
import { getErrorMessage, getErrorStack } from '@utils/logger';
import { timeoutClipboard } from '@utils/timeout';
import { browserMessaging } from '@compat/messaging';

export class ClipboardService {
  private static instance: ClipboardService;

  private constructor() {}

  static getInstance(): ClipboardService {
    if (!ClipboardService.instance) {
      ClipboardService.instance = new ClipboardService();
    }
    return ClipboardService.instance;
  }

  async copy(text: string, behavior: CopyBehavior = 'smart'): Promise<boolean> {
    console.log(`[QuickCopy] [9/10] Clipboard copy requested`, { textLength: text.length, behavior });

    try {
      const startTime = performance.now();

      const backgroundCopied = await this.tryBackgroundCopy(text, behavior);
      if (!backgroundCopied) {
        if (behavior === 'formatted') {
          await this.copyFormatted(text);
        } else {
          await this.copyPlain(text);
        }
      }

      const elapsed = Math.round(performance.now() - startTime);
      console.log(`[QuickCopy] [9/10] Clipboard copied ✓ (${elapsed}ms)`);

      eventBus.emit('clipboard:written', true);
      eventBus.emit('status:update', { status: 'ready', message: 'Copied to clipboard' });
      logger.info('Copied to clipboard', { chars: text.length });
      return true;
    } catch (error) {
      const errMsg = getErrorMessage(error);
      console.error(`[QuickCopy] [9/10] Clipboard FAILED`, {
        message: errMsg,
        stack: getErrorStack(error),
        textLength: text.length,
        type: typeof error,
      });
      const safeErr = error instanceof Error ? error : new Error(errMsg);
      eventBus.emit('clipboard:failed', safeErr);
      eventBus.emit('clipboard:written', false);
      eventBus.emit('status:update', { status: 'error', message: 'Copy to clipboard failed' });
      return false;
    }
  }

  private async tryBackgroundCopy(text: string, behavior: CopyBehavior): Promise<boolean> {
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) return false;
    try {
      const message: ClipboardWriteMessage = {
        type: 'clipboard:write',
        text,
        format: behavior === 'formatted' ? 'formatted' : 'plain',
        source: 'content',
        target: 'background',
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };
      const resp = await browserMessaging.sendMessage<ClipboardWriteResponse>(message);
      if (resp?.success === true) {
        console.log(`[QuickCopy] [9/10] Copied via background clipboard host ✓`);
        return true;
      }
      console.log(`[QuickCopy] [9/10] Background clipboard host unavailable (${resp?.error ?? 'unknown'}) — falling back to local copy`);
      return false;
    } catch (err) {
      console.log(`[QuickCopy] [9/10] Background clipboard host unreachable — falling back to local copy: ${getErrorMessage(err)}`);
      return false;
    }
  }

  private async copyPlain(text: string): Promise<void> {
    try {
      console.log(`[QuickCopy] [9/10] Trying navigator.clipboard.writeText...`);
      await timeoutClipboard(navigator.clipboard.writeText(text));
      console.log(`[QuickCopy] [9/10] navigator.clipboard.writeText succeeded`);
    } catch (primaryErr) {
      console.log(`[QuickCopy] [9/10] navigator.clipboard.writeText failed: ${getErrorMessage(primaryErr)}, trying execCommand fallback...`);
      await this.copyPlainFallback(text);
    }
  }

  private copyPlainFallback(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        document.body.appendChild(textarea);

        textarea.focus();
        textarea.select();

        const success = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (success) {
          console.log(`[QuickCopy] [9/10] execCommand('copy') succeeded`);
          resolve();
        } else {
          const msg = 'execCommand copy returned false';
          console.error(`[QuickCopy] [9/10] ${msg}`);
          reject(new Error(msg));
        }
      } catch (fallbackErr) {
        console.error(`[QuickCopy] [9/10] execCommand fallback FAILED`, getErrorMessage(fallbackErr));
        reject(fallbackErr instanceof Error ? fallbackErr : new Error(getErrorMessage(fallbackErr)));
      }
    });
  }

  private async copyFormatted(text: string): Promise<void> {
    console.log(`[QuickCopy] [9/10] Trying formatted clipboard write with ClipboardItem...`);
    const blob = new Blob([text], { type: 'text/html' });
    await timeoutClipboard(
      navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'text/html': blob,
        }),
      ])
    );
    console.log(`[QuickCopy] [9/10] Formatted clipboard write succeeded`);
  }

  async isAvailable(): Promise<boolean> {
    return !!navigator.clipboard?.writeText;
  }

  async read(): Promise<string> {
    return navigator.clipboard.readText();
  }
}

export const clipboardService = ClipboardService.getInstance();
