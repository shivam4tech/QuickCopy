import { useState, useEffect, useCallback } from 'react';
import type { ExtensionSettings } from '@type/settings';
import { defaultSettings } from '@type/settings';
import { settingsService } from '@services/SettingsService';
import { eventBus } from '@utils/eventBus';

export function useSettings() {
  const [settings, setSettings] = useState<ExtensionSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsService.load().then((s) => {
      setSettings(s);
      setLoading(false);
    });

    const unsub = eventBus.on('settings:changed', (partial) => {
      setSettings((prev) => ({ ...prev, ...partial }));
    });

    return unsub;
  }, []);

  const updateSetting = useCallback(<K extends keyof ExtensionSettings>(
    key: K,
    value: ExtensionSettings[K],
  ) => {
    settingsService.set(key, value);
  }, []);

  const updateSettings = useCallback((updates: Partial<ExtensionSettings>) => {
    settingsService.setMultiple(updates);
  }, []);

  const resetSettings = useCallback(() => {
    settingsService.reset();
  }, []);

  return {
    settings,
    loading,
    updateSetting,
    updateSettings,
    resetSettings,
  };
}
