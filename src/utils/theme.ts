import type { ThemeMode } from '@type/index';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export type ResolvedTheme = 'dark' | 'light';

export function resolveThemeMode(mode: ThemeMode): ResolvedTheme {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export function applyThemeToElement(target: HTMLElement | null, mode: ThemeMode): void {
  if (!target) return;
  target.dataset.theme = resolveThemeMode(mode);
}

export type ThemeApplier = (mode: ThemeMode) => void;

/**
 * Creates a theme applier bound to a target element (the document root for
 * extension pages, the shadow host for the in-page sidebar). Keeps `system`
 * in sync with the OS color-scheme preference while it is selected.
 */
export function createThemeApplier(target: () => HTMLElement | null): ThemeApplier {
  let current: ThemeMode = 'dark';
  let mq: MediaQueryList | null = null;
  let listening = false;

  const onMqChange = () => {
    if (current === 'system') applyThemeToElement(target(), 'system');
  };

  const setTheme: ThemeApplier = (mode) => {
    current = mode;
    if (mq === null && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      mq = window.matchMedia(DARK_QUERY);
    }
    if (listening && mq) {
      mq.removeEventListener('change', onMqChange);
      listening = false;
    }
    if (mode === 'system' && mq) {
      mq.addEventListener('change', onMqChange);
      listening = true;
    }
    applyThemeToElement(target(), mode);
  };

  return setTheme;
}

export interface ThemeController {
  setTheme: ThemeApplier;
}

export const themeController: ThemeController = {
  setTheme: createThemeApplier(() => document.documentElement),
};
