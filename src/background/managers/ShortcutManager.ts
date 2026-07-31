import { browserCommands } from '@compat/commands';
import { eventBus } from '@utils/eventBus';
import { logger } from '@utils/logger';

type ShortcutAction = 'capture-region' | 'toggle-sidebar';

export class ShortcutManager {
  private static instance: ShortcutManager;
  private handlers = new Map<string, () => void>();
  private cleanup: (() => void) | null = null;

  private constructor() {}

  static getInstance(): ShortcutManager {
    if (!ShortcutManager.instance) {
      ShortcutManager.instance = new ShortcutManager();
    }
    return ShortcutManager.instance;
  }

  initialize(): void {
    this.cleanup = browserCommands.onCommand((command) => {
      const handler = this.handlers.get(command);
      if (handler) {
        logger.info(`Shortcut triggered: ${command}`);
        eventBus.emit('shortcut:triggered', command);
        handler();
      } else {
        logger.warn(`No handler for shortcut: ${command}`);
      }
    });

    logger.info('ShortcutManager initialized');
  }

  register(action: ShortcutAction, handler: () => void): void {
    this.handlers.set(action, handler);
    logger.debug(`Shortcut registered: ${action}`);
  }

  unregister(action: ShortcutAction): void {
    this.handlers.delete(action);
    logger.debug(`Shortcut unregistered: ${action}`);
  }

  async getRegisteredCommands(): Promise<string[]> {
    const commands = await browserCommands.getAll();
    return commands.map((c) => c.name ?? '').filter(Boolean);
  }

  destroy(): void {
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = null;
    }
    this.handlers.clear();
    logger.info('ShortcutManager destroyed');
  }
}

export const shortcutManager = ShortcutManager.getInstance();
