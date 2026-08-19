import type { CaptureResult, Region } from '@type/index';
import { eventBus } from '@utils/eventBus';
import { browserMessaging } from '@compat/messaging';
import { getCaptureViewportSize } from '@utils/viewport';

interface CaptureResponse {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

function isExtensionContextValid(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

export class CaptureService {
  private static instance: CaptureService;
  private _disposed = false;

  private constructor() {}

  static getInstance(): CaptureService {
    if (!CaptureService.instance) {
      CaptureService.instance = new CaptureService();
    }
    return CaptureService.instance;
  }

  dispose(): void {
    this._disposed = true;
  }

  async captureRegion(region: Region): Promise<CaptureResult> {
    if (!isExtensionContextValid()) {
      throw new Error('[Ekadanta] Extension context invalidated');
    }
    if (this._disposed) {
      throw new Error('[Ekadanta] CaptureService disposed');
    }

    const startTime = performance.now();
    eventBus.emit('status:update', { status: 'busy', message: 'Capturing region...' });
    console.log(`[Ekadanta] [1/10] CTRL detected ✓`);
    console.log(`[Ekadanta] [2/10] Selection completed ✓`, { width: region.width, height: region.height });

    this.validateRegion(region);
    console.log(`[Ekadanta] [3/10] Capture requested`, { region });

    const viewportScreenshot = await this.captureViewportScreenshot();

    console.log(`[Ekadanta] [3.5/10] Cropping to region...`);
    const captured = await this.cropImage(viewportScreenshot, region);

    const elapsed = Math.round(performance.now() - startTime);
    console.log(`[Ekadanta] [4/10] Image captured ✓`, {
      width: captured.width,
      height: captured.height,
      executionTimeMs: elapsed,
    });

    if (captured.width < 2 || captured.height < 2) {
      eventBus.emit('capture:failed', new Error(`Captured image too small: ${captured.width}x${captured.height}`));
      throw new Error(`[Ekadanta] Captured image too small: ${captured.width}x${captured.height}`);
    }

    const result: CaptureResult = {
      dataUrl: captured.dataUrl,
      region,
      timestamp: Date.now(),
    };

    eventBus.emit('capture:completed', result);
    return result;
  }

  private async captureViewportScreenshot(): Promise<string> {
    const resp = await browserMessaging.sendMessage<CaptureResponse>({
      type: 'capture:viewport',
      source: 'content',
      target: 'background',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    });
    if (resp?.dataUrl) return resp.dataUrl;
    throw new Error(resp?.error ?? 'No screenshot data received');
  }

  private cropImage(dataUrl: string, region: Region): Promise<{ dataUrl: string; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        reject(new Error('Image crop timed out after 15000ms'));
      }, 15000);

      img.onload = () => {
        if (timedOut) return;
        clearTimeout(timer);
        const viewport = getCaptureViewportSize();
        const scaleX = img.naturalWidth / viewport.width;
        const scaleY = img.naturalHeight / viewport.height;

        const cropX = region.x;
        const cropY = region.y;
        const cropWidth = region.width;
        const cropHeight = region.height;

        const c = document.createElement('canvas');
        c.width = Math.round(cropWidth * scaleX);
        c.height = Math.round(cropHeight * scaleY);
        const ctx = c.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas 2d context'));
          return;
        }
        ctx.drawImage(img,
          cropX * scaleX, cropY * scaleY,
          cropWidth * scaleX, cropHeight * scaleY,
          0, 0, c.width, c.height
        );
        resolve({ dataUrl: c.toDataURL('image/png'), width: c.width, height: c.height });
      };
      img.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Failed to load screenshot image'));
      };
      img.src = dataUrl;
    });
  }

  private validateRegion(region: Region): void {
    if (!region || typeof region.x !== 'number' || typeof region.y !== 'number' ||
        typeof region.width !== 'number' || typeof region.height !== 'number') {
      throw new Error(`[Ekadanta] Invalid region: ${JSON.stringify(region)}`);
    }
    if (region.width < 1 || region.height < 1) {
      throw new Error(`[Ekadanta] Region too small: ${region.width}x${region.height}`);
    }
    if (region.x < 0 || region.y < 0) {
      throw new Error(`[Ekadanta] Region has negative coordinates: ${region.x},${region.y}`);
    }
  }

  async captureViewport(): Promise<CaptureResult> {
    const viewport = getCaptureViewportSize();
    const region: Region = { x: 0, y: 0, width: viewport.width, height: viewport.height };
    return this.captureRegion(region);
  }

  async captureElement(elementSelector: string): Promise<CaptureResult> {
    const el = document.querySelector(elementSelector);
    if (!el) throw new Error(`Element not found: ${elementSelector}`);

    const rect = el.getBoundingClientRect();
    const region: Region = {
      x: Math.max(0, rect.left),
      y: Math.max(0, rect.top),
      width: rect.width,
      height: rect.height,
    };

    return this.captureRegion(region);
  }
}

export const captureService = CaptureService.getInstance();
