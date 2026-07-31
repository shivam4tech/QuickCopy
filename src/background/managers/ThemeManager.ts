import type { ThemeMode } from '@type/index';
import { eventBus } from '@utils/eventBus';
import { logger } from '@utils/logger';

export class ThemeManager {
  private static instance: ThemeManager;
  private currentTheme: ThemeMode = 'dark';

  private constructor() {}

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  initialize(defaultTheme: ThemeMode = 'dark'): void {
    this.currentTheme = defaultTheme;
    this.broadcast();
    logger.info(`ThemeManager initialized with theme: ${defaultTheme}`);
  }

  setTheme(theme: ThemeMode): void {
    if (this.currentTheme === theme) return;
    this.currentTheme = theme;
    this.broadcast();
    logger.info(`Theme changed to: ${theme}`);
  }

  getTheme(): ThemeMode {
    return this.currentTheme;
  }

  toggle(): void {
    const next = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
  }

  private broadcast(): void {
    eventBus.emit('theme:changed', this.currentTheme);
  }
}

export const themeManager = ThemeManager.getInstance();
