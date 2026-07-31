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

  private toGrayscale(imageData: ImageData): ImageData {
    const data = imageData.data;
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
}

export const preprocessingService = PreprocessingService.getInstance();
