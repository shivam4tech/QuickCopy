import type { AnalyzerInput } from './router/ImageAnalyzer';

/**
 * Decode a data URL into raw RGBA pixels. Works across contexts:
 *  - DOM contexts (content script, offscreen document, Firefox event page)
 *  - Worker contexts without a DOM (MV3 service worker) via createImageBitmap
 *    + OffscreenCanvas.
 * Returns null when no decoding strategy is available so callers can degrade
 * gracefully (route as text / fall back to Tesseract).
 */
export async function decodeDataUrl(dataUrl: string): Promise<AnalyzerInput | null> {
  try {
    const doc = (globalThis as unknown as { document?: Document }).document;
    if (doc) {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const canvas = doc.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return { width: canvas.width, height: canvas.height, data: imageData.data };
    }
  } catch {
    // fall through to worker strategies
  }

  try {
    const blob = await dataUrlToBlob(dataUrl);
    const win = globalThis as unknown as {
      createImageBitmap?: (blob: Blob) => Promise<ImageBitmap>;
      OffscreenCanvas?: new (w: number, h: number) => OffscreenCanvas;
    };
    if (typeof win.createImageBitmap === 'function' && typeof win.OffscreenCanvas === 'function') {
      const bitmap = await win.createImageBitmap(blob);
      try {
        const canvas = new win.OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(bitmap, 0, 0);
        const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
        return { width: bitmap.width, height: bitmap.height, data: imageData.data };
      } finally {
        bitmap.close?.();
      }
    }
  } catch {
    return null;
  }

  return null;
}

/** Convert a data URL (base64) to a Blob without fetch(). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, payload] = dataUrl.split(',');
  const mime = /^data:([^;]+);/i.exec(head ?? '')?.[1] ?? 'application/octet-stream';
  const binary = atob(payload ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
