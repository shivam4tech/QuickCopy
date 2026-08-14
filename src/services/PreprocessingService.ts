import { logger } from '@utils/logger';

export interface PreprocessedImage {
  dataUrl: string;
  width: number;
  height: number;
}

export class PreprocessingService {
  private static instance: PreprocessingService;

  private constructor() {}

  static getInstance(): PreprocessingService {
    if (!PreprocessingService.instance) {
      PreprocessingService.instance = new PreprocessingService();
    }
    return PreprocessingService.instance;
  }

  async preprocess(dataUrl: string, scale = 2): Promise<PreprocessedImage> {
    const img = await this.loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.filter = 'none';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const grayData = this.toGrayscale(imageData);
    ctx.putImageData(grayData, 0, 0);

    const result: PreprocessedImage = {
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
    };

    logger.debug('Preprocessing done', { origSize: `${img.width}x${img.height}`, scaledSize: `${canvas.width}x${canvas.height}` });

    return result;
  }

  private loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  toGrayscale(imageData: ImageData): ImageData {
    const data = imageData.data;
    const pixelCount = data.length / 4;

    if (this.hasColoredForeground(data, pixelCount)) {
      return this.processColoredForeground(imageData, pixelCount);
    }

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    return imageData;
  }

  hasColoredForeground(data: Uint8ClampedArray, pixelCount: number): boolean {
    const coloredTarget = Math.max(1, Math.floor(pixelCount * 0.001));
    const darkTarget = Math.floor(pixelCount * 0.6);
    let colored = 0;
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (luma < 110) dark++;
      if (max > 60 && (max - min) / max > 0.3 && luma < 128) {
        colored++;
        if (colored >= coloredTarget && dark >= darkTarget) return true;
      }
    }
    return colored >= coloredTarget && dark >= darkTarget;
  }

  processColoredForeground(imageData: ImageData, pixelCount: number): ImageData {
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    const radius = 8;
    const k = 0.2;
    const range = 128;

    // Two candidate grayscale channels:
    //  A) colored-fill — separates DARK text on saturated backgrounds
    //     (red bg → 255, dark text → ~0).
    //  B) min channel — separates LIGHT text on saturated backgrounds
    //     (white text → 255, red bg → 0).
    // The channel with the larger spread wins; the other collapses the text
    // into the background (white-on-red with A, dark-on-red with B).
    const chanA = new Float32Array(pixelCount);
    const chanB = new Float32Array(pixelCount);
    let meanA = 0;
    let meanB = 0;
    for (let p = 0, i = 0; p < pixelCount; p++, i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const blue = data[i + 2]!;
      const max = Math.max(r, g, blue);
      const min = Math.min(r, g, blue);
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * blue;
      const sat = max > 0 ? (max - min) / max : 0;
      chanA[p] = luma + sat * (max - luma);
      chanB[p] = min;
      meanA += chanA[p]!;
      meanB += chanB[p]!;
    }
    meanA /= pixelCount;
    meanB /= pixelCount;

    let varA = 0;
    let varB = 0;
    for (let p = 0; p < pixelCount; p++) {
      const da = chanA[p]! - meanA;
      const db = chanB[p]! - meanB;
      varA += da * da;
      varB += db * db;
    }

    const useA = varA >= varB;
    const gray = useA ? chanA : chanB;
    const lightOnDark = (useA ? meanA : meanB) < 128;
    const norm = new Float32Array(pixelCount);
    for (let p = 0; p < pixelCount; p++) {
      norm[p] = lightOnDark ? 255 - gray[p]! : gray[p]!;
    }

    const mean = this.boxBlur(norm, w, h, radius);
    const squared = new Float32Array(pixelCount);
    for (let p = 0; p < pixelCount; p++) {
      squared[p] = norm[p]! * norm[p]!;
    }
    const meanSquared = this.boxBlur(squared, w, h, radius);

    for (let p = 0, i = 0; p < pixelCount; p++, i += 4) {
      const m = mean[p]!;
      const ms = meanSquared[p]!;
      const std = Math.sqrt(Math.max(0, ms - m * m));
      const threshold = m * (1 + k * (std / range - 1));
      const out = norm[p]! > threshold ? 255 : 0;
      data[i] = out;
      data[i + 1] = out;
      data[i + 2] = out;
    }
    return imageData;
  }

  private boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
    const pw = w + radius * 2;
    const ph = h + radius * 2;
    const padded = new Float32Array(pw * ph);
    for (let y = 0; y < ph; y++) {
      const sy = Math.max(0, Math.min(h - 1, y - radius));
      const row = y * pw;
      const srow = sy * w;
      for (let x = 0; x < pw; x++) {
        const sx = Math.max(0, Math.min(w - 1, x - radius));
        padded[row + x] = src[srow + sx]!;
      }
    }

    const tmp = new Float32Array(pw * ph);
    const out = new Float32Array(pw * ph);
    const diameter = radius * 2 + 1;
    const scale = 1 / diameter;

    for (let y = 0; y < ph; y++) {
      const row = y * pw;
      let sum = 0;
      for (let x = -radius; x <= radius; x++) {
        sum += padded[row + x + radius]!;
      }
      tmp[row + radius] = sum * scale;
      for (let x = radius + 1; x < pw - radius; x++) {
        sum += padded[row + x + radius]! - padded[row + x - radius - 1]!;
        tmp[row + x] = sum * scale;
      }
    }

    for (let x = 0; x < pw; x++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++) {
        sum += tmp[(y + radius) * pw + x]!;
      }
      out[radius * pw + x] = sum * scale;
      for (let y = radius + 1; y < ph - radius; y++) {
        sum += tmp[(y + radius) * pw + x]! - tmp[(y - radius - 1) * pw + x]!;
        out[y * pw + x] = sum * scale;
      }
    }

    const result = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      const orow = (y + radius) * pw + radius;
      for (let x = 0; x < w; x++) {
        result[row + x] = out[orow + x]!;
      }
    }
    return result;
  }
}

export const preprocessingService = PreprocessingService.getInstance();
