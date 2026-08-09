/**
 * Console output gate for shipped builds.
 *
 * Extensions should not spam the page console. By default every console
 * method is a no-op; when `debugMode` is enabled in settings, the original
 * methods are restored so the dev can debug on real pages. Settings are read
 * asynchronously, so contexts start quiet and flip to loud when (and only
 * when) debugMode is on.
 */

import { STORAGE_KEYS } from '@shared/constants';
import { defaultSettings, type ExtensionSettings } from '@type/settings';

type ConsoleMethodName = 'log' | 'info' | 'warn' | 'error' | 'debug';

const CONSOLE_METHODS: ConsoleMethodName[] = ['log', 'info', 'warn', 'error', 'debug'];

// Capture the real methods before anything can replace them.
const originalMethods: Record<ConsoleMethodName, (...args: unknown[]) => void> = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

let gated = false;

function setGated(next: boolean): void {
  if (gated === next) return;
  gated = next;
  const consoleAny = console as unknown as Record<string, unknown>;
  for (const name of CONSOLE_METHODS) {
    consoleAny[name] = next ? () => undefined : originalMethods[name];
  }
}

function applySettings(settings: ExtensionSettings | undefined): void {
  setGated(settings ? settings.debugMode !== true : true);
}

/**
 * Silences console output unless debugMode is enabled in settings.
 * Call once at the top of every extension context (content script, service
 * worker, offscreen document, PDF viewer window) before any logging happens.
 */
export function initConsoleGate(): void {
  setGated(true); // quiet by default — shipping default; settings re-enable below

  try {
    void chrome.storage.local.get(STORAGE_KEYS.SETTINGS).then((result) => {
      applySettings((result[STORAGE_KEYS.SETTINGS] as ExtensionSettings | undefined) ?? defaultSettings);
    });
  } catch {
    // storage unavailable (e.g. host page) — stay quiet
  }

  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      const change = changes[STORAGE_KEYS.SETTINGS];
      if (change?.newValue) {
        applySettings(change.newValue as ExtensionSettings);
      }
    });
  } catch {
    // storage unavailable — stay quiet
  }
}
