import { useState, useEffect, useCallback } from 'react';
import type { ThemeMode } from '@type/index';
import { eventBus } from '@utils/eventBus';

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const unsub = eventBus.on('theme:changed', (newTheme) => {
      setTheme(newTheme);
      setResolvedTheme(newTheme === 'system' ? resolveSystemTheme() : newTheme);
    });

    return unsub;
  }, []);

  const resolveSystemTheme = useCallback((): 'dark' | 'light' => {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  const applyTheme = useCallback((mode: ThemeMode) => {
    const resolved = mode === 'system' ? resolveSystemTheme() : mode;
    document.documentElement.dataset.theme = resolved;
    setTheme(mode);
    setResolvedTheme(resolved);
    eventBus.emit('theme:changed', mode);
  }, [resolveSystemTheme]);

  return { theme, resolvedTheme, applyTheme };
}
