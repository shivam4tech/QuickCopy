import type { LogLevel } from '@type/index';

const LOG_PREFIX = '[Ekadanta]';
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = 'info';

function getTimestamp(): string {
  return new Date().toISOString().slice(11, 23);
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, message: string, data?: unknown): string {
  const icon = { debug: '🔍', info: 'ℹ', warn: '⚠', error: '✖' }[level];
  const ts = getTimestamp();
  const base = `${LOG_PREFIX} ${icon} [${ts}] ${message}`;
  return data ? `${base} ${JSON.stringify(data, null, 0)}` : base;
}

export function getErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    if ('message' in error && typeof (error as Record<string, unknown>).message === 'string') {
      return (error as Record<string, unknown>).message as string;
    }
    try { return JSON.stringify(error); } catch { return fallback; }
  }
  return fallback;
}

export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) return error.stack;
  return undefined;
}

export const logger = {
  setLevel(level: LogLevel): void {
    currentLevel = level;
  },

  debug(message: string, data?: unknown): void {
    if (!shouldLog('debug')) return;
    console.debug(formatMessage('debug', message, data));
  },

  info(message: string, data?: unknown): void {
    if (!shouldLog('info')) return;
    console.info(formatMessage('info', message, data));
  },

  warn(message: string, data?: unknown): void {
    if (!shouldLog('warn')) return;
    console.warn(formatMessage('warn', message, data));
  },

  error(message: string, error?: unknown): void {
    if (!shouldLog('error')) return;
    console.error(formatMessage('error', message, error), error);
  },
};
