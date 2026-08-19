import type { ExtensionMessage, MessageResponse } from '@type/messages';
import { logger } from '@utils/logger';

function getBrowserAPI(): typeof chrome {
  if (typeof chrome !== 'undefined') return chrome;
  if (typeof browser !== 'undefined') return browser as typeof chrome;
  throw new Error('No browser API detected');
}

function getRuntime() {
  return getBrowserAPI().runtime;
}

function getTabs(): typeof chrome.tabs {
  return getBrowserAPI().tabs;
}

export const browserMessaging = {
  sendMessage<T = MessageResponse>(message: ExtensionMessage): Promise<T> {
    console.log(`[Ekadanta] sendMessage`, { type: message.type, id: message.id });
    return (getRuntime().sendMessage(message) as Promise<T>).catch((err: Error) => {
      logger.error('sendMessage failed', err);
      throw err;
    });
  },

  sendMessageToTab<T = MessageResponse>(tabId: number, message: ExtensionMessage): Promise<T> {
    return (getTabs().sendMessage(tabId, message) as Promise<T>).catch((err: Error) => {
      logger.error('sendMessageToTab failed', err);
      throw err;
    });
  },

  onMessage(
    handler: (
      message: ExtensionMessage,
      sender: chrome.runtime.MessageSender,
    ) => Promise<MessageResponse | void>,
  ): () => void {
    const runtime = getRuntime();
    const listener = (
      message: ExtensionMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: MessageResponse) => void,
    ) => {
      Promise.resolve(handler(message, sender)).then((result) => {
        if (result) sendResponse(result);
      });
      return true;
    };
    runtime.onMessage.addListener(listener);
    return () => {
      runtime.onMessage.removeListener(listener);
    };
  },

  connect(name?: string): chrome.runtime.Port {
    return getRuntime().connect({ name });
  },

  onConnect(handler: (port: chrome.runtime.Port) => void): () => void {
    const runtime = getRuntime();
    runtime.onConnect.addListener(handler);
    return () => {
      runtime.onConnect.removeListener(handler);
    };
  },

  getURL(path: string): string {
    return getRuntime().getURL(path);
  },
};
