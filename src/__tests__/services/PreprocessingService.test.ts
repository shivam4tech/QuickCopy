import { describe, expect, it } from 'vitest';
import { preprocessingService } from '@/services/PreprocessingService';

function makeImage(width: number, height: number, fill: (x: number, y: number) => [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { width, height, data } as ImageData;
}

/** 64×64 with a 17px-tall horizontal text stripe in the middle. */
function stripeImage(textColor: [number, number, number], bgColor: [number, number, number]): ImageData {
  return makeImage(64, 64, (_, y) => (y >= 24 && y <= 40 ? textColor : bgColor));
}

function pixel(imageData: ImageData, x: number, y: number): [number, number, number] {
  const i = (y * imageData.width + x) * 4;
  return [imageData.data[i]!, imageData.data[i + 1]!, imageData.data[i + 2]!];
}

describe('PreprocessingService colored-foreground binarizer', () => {
  it('hasColoredForeground detects saturated dark backgrounds', () => {
    const whiteOnRed = stripeImage([255, 255, 255], [255, 0, 0]);
    expect(preprocessingService.hasColoredForeground(whiteOnRed.data, 64 * 64)).toBe(true);
  });

  it('does not treat plain grayscale content as colored', () => {
    const blackOnWhite = stripeImage([0, 0, 0], [255, 255, 255]);
    expect(preprocessingService.hasColoredForeground(blackOnWhite.data, 64 * 64)).toBe(false);
  });

  it('binarizes white text on a red background into black text on white', () => {
    const result = preprocessingService.toGrayscale(stripeImage([255, 255, 255], [255, 0, 0]));
    expect(pixel(result, 32, 32)).toEqual([0, 0, 0]); // text stripe center → black
    expect(pixel(result, 32, 4)).toEqual([255, 255, 255]); // background → white
  });

  it('keeps dark text on a red background readable (existing behavior)', () => {
    const result = preprocessingService.toGrayscale(stripeImage([0, 0, 0], [255, 0, 0]));
    expect(pixel(result, 32, 32)).toEqual([0, 0, 0]); // text stripe center → black
    expect(pixel(result, 32, 4)).toEqual([255, 255, 255]); // background → white
  });

  it('handles light text on other saturated dark backgrounds', () => {
    const result = preprocessingService.toGrayscale(stripeImage([255, 255, 255], [0, 0, 128]));
    expect(pixel(result, 32, 32)).toEqual([0, 0, 0]); // text stripe center → black
    expect(pixel(result, 32, 4)).toEqual([255, 255, 255]); // background → white
  });
});