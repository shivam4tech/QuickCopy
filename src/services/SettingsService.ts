import type { ExtensionSettings } from '@type/settings';
import { defaultSettings } from '@type/settings';
import { browserStorage } from '@compat/storage';
import { STORAGE_KEYS } from '@shared/constants';
import { eventBus } from '@utils/eventBus';
import { logger } from '@utils/logger';

export class SettingsService {
  private static instance: SettingsService;
  private settings: ExtensionSettings = defaultSettings;
  private loaded = false;

  private constructor() {}

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  async load(): Promise<ExtensionSettings> {
    if (this.loaded) {
      return this.settings;
    }

    try {
      const result = await browserStorage.get<ExtensionSettings>(STORAGE_KEYS.SETTINGS);
      const stored = result[STORAGE_KEYS.SETTINGS];

      if (stored) {
        this.settings = { ...defaultSettings, ...stored };
      } else {
        this.settings = { ...defaultSettings };
        await this.persist();
      }

      this.loaded = true;
      eventBus.emit('settings:loaded', this.settings);
      logger.info('Settings loaded', this.settings);
    } catch (error) {
      logger.error('Failed to load settings', error);
      this.settings = { ...defaultSettings };
    }

    return this.settings;
  }

  async get<K extends keyof ExtensionSettings>(key: K): Promise<ExtensionSettings[K]> {
    if (!this.loaded) {
      await this.load();
    }
    return this.settings[key];
  }

  async getAll(): Promise<ExtensionSettings> {
    if (!this.loaded) {
      await this.load();
    }
    return { ...this.settings };
  }

  async set<K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]): Promise<void> {
    this.settings[key] = value;
    await this.persist();
    eventBus.emit('settings:changed', { [key]: value });
    logger.info(`Setting updated: ${key}`, value);
  }

  async setMultiple(updates: Partial<ExtensionSettings>): Promise<void> {
    Object.assign(this.settings, updates);
    await this.persist();
    eventBus.emit('settings:changed', updates);
    logger.info('Settings updated', updates);
  }

  async reset(): Promise<void> {
    this.settings = { ...defaultSettings };
    await this.persist();
    eventBus.emit('settings:changed', this.settings);
    logger.info('Settings reset to defaults');
  }

  get defaultSettings(): ExtensionSettings {
    return { ...defaultSettings };
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  private async persist(): Promise<void> {
    try {
      await browserStorage.set({ [STORAGE_KEYS.SETTINGS]: this.settings });
    } catch (error) {
      logger.error('Failed to persist settings', error);
    }
  }
}

export const settingsService = SettingsService.getInstance();
