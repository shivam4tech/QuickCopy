import { logger } from '@utils/logger';

type CommandHandler = (command: string, tab?: chrome.tabs.Tab) => void;

function getBrowserAPI(): typeof chrome {
  if (typeof chrome !== 'undefined') return chrome;
  if (typeof browser !== 'undefined') return browser as typeof chrome;
  throw new Error('No browser API detected');
}

export const browserCommands = {
  onCommand(handler: CommandHandler): () => void {
    try {
      const commands = getBrowserAPI().commands;
      commands.onCommand.addListener(handler);
      return () => {
        commands.onCommand.removeListener(handler);
      };
    } catch (error) {
      logger.error('commands.onCommand failed', error);
      return () => {};
    }
  },

  async getAll(): Promise<chrome.commands.Command[]> {
    try {
      const commands = getBrowserAPI().commands;
      return await commands.getAll();
    } catch (error) {
      logger.error('commands.getAll failed', error);
      return [];
    }
  },
};
