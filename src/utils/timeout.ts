export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[Ekadanta] Timeout: ${label} exceeded ${ms}ms`)), ms)
    ),
  ]);
}

export async function timeoutCapture(promise: Promise<unknown>): Promise<unknown> {
  return withTimeout(promise, 15000, 'Capture');
}

export async function timeoutOCR(promise: Promise<unknown>): Promise<unknown> {
  return withTimeout(promise, 5000, 'OCR');
}

export async function timeoutClipboard(promise: Promise<unknown>): Promise<unknown> {
  return withTimeout(promise, 5000, 'Clipboard');
}
