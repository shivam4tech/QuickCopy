import { describe, it, expect } from 'vitest';
import {
  buildEmojiMask,
  connectedComponents,
  filterEmojiComponents,
  extractThumbnail,
} from '../../../../services/ocr/emoji/geometry';

function makeImage(width: number, height: number, fill: [number, number, number] = [255, 255, 255]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fill[0];
    data[i * 4 + 1] = fill[1];
    data[i * 4 + 2] = fill[2];
    data[i * 4 + 3] = 255;
  }
  return data;
}

function setPixel(data: Uint8ClampedArray, width: number, x: number, y: number, rgb: [number, number, number]) {
  const o = (y * width + x) * 4;
  data[o] = rgb[0];
  data[o + 1] = rgb[1];
  data[o + 2] = rgb[2];
  data[o + 3] = 255;
}

describe('buildEmojiMask', () => {
  it('marks saturated colored pixels and skips monochrome text/background', () => {
    const w = 40;
    const h = 20;
    const data = makeImage(w, h, [255, 255, 255]);
    setPixel(data, w, 2, 2, [255, 0, 0]); // red
    setPixel(data, w, 4, 2, [0, 0, 0]); // black text
    setPixel(data, w, 6, 2, [128, 128, 128]); // gray text
    setPixel(data, w, 8, 2, [255, 255, 255]); // white bg

    const mask = buildEmojiMask({ width: w, height: h, data });
    expect(mask[2 + 2 * w]).toBe(1);
    expect(mask[4 + 2 * w]).toBe(0);
    expect(mask[6 + 2 * w]).toBe(0);
    expect(mask[8 + 2 * w]).toBe(0);
  });

  it('skips transparent pixels', () => {
    const w = 4;
    const h = 4;
    const data = new Uint8ClampedArray(w * h * 4).fill(0);
    const mask = buildEmojiMask({ width: w, height: h, data });
    expect(Array.from(mask).every((v) => v === 0)).toBe(true);
  });
});

describe('connectedComponents', () => {
  it('finds separate blobs with correct bounds', () => {
    const w = 50;
    const h = 30;
    const data = makeImage(w, h, [255, 255, 255]);
    for (let y = 5; y < 15; y++) for (let x = 5; x < 15; x++) setPixel(data, w, x, y, [255, 0, 0]);
    for (let y = 20; y < 26; y++) for (let x = 30; x < 38; x++) setPixel(data, w, x, y, [0, 128, 255]);

    const mask = buildEmojiMask({ width: w, height: h, data });
    const comps = connectedComponents(mask, w, h);
    expect(comps).toHaveLength(2);
    const sorted = [...comps].sort((a, b) => a.x - b.x);
    expect(sorted[0]).toMatchObject({ x: 5, y: 5, width: 10, height: 10, pixelCount: 100 });
    expect(sorted[1]).toMatchObject({ x: 30, y: 20, width: 8, height: 6, pixelCount: 48 });
  });

  it('treats diagonal neighbors as connected (8-connectivity)', () => {
    const w = 4;
    const h = 4;
    const data = makeImage(w, h, [255, 255, 255]);
    setPixel(data, w, 1, 1, [255, 0, 0]);
    setPixel(data, w, 2, 2, [255, 0, 0]);
    const mask = buildEmojiMask({ width: w, height: h, data });
    expect(connectedComponents(mask, w, h)).toHaveLength(1);
  });
});

describe('filterEmojiComponents', () => {
  it('rejects too-small, too-sparse, and non-square components', () => {
    const comps = [
      { x: 0, y: 0, width: 3, height: 3, pixelCount: 9 }, // too small
      { x: 0, y: 0, width: 20, height: 20, pixelCount: 10 }, // too sparse
      { x: 0, y: 0, width: 100, height: 4, pixelCount: 100 }, // wrong aspect
      { x: 0, y: 0, width: 16, height: 16, pixelCount: 128 }, // keep
    ];
    const kept = filterEmojiComponents(comps);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ width: 16, height: 16 });
  });
});

describe('extractThumbnail', () => {
  it('downscales a blob to a fixed square thumb preserving color', () => {
    const w = 40;
    const h = 40;
    const data = makeImage(w, h, [255, 255, 255]);
    for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) setPixel(data, w, x, y, [255, 0, 0]);

    const thumb = extractThumbnail(data, w, h, { x: 10, y: 10, width: 20, height: 20, pixelCount: 400 });
    expect(thumb.rgb.length).toBe(32 * 32 * 3);
    // center pixel should be dominated by red
    const center = (16 * 32 + 16) * 3;
    expect(thumb.rgb[center]!).toBeGreaterThan(thumb.rgb[center + 2]!);
    // corner should be background (white)
    expect(thumb.rgb[0]!).toBeGreaterThan(200);
  });

  it('composites transparent pixels onto mid-gray', () => {
    const w = 32;
    const h = 32;
    const data = new Uint8ClampedArray(w * h * 4); // fully transparent
    const thumb = extractThumbnail(data, w, h, { x: 8, y: 8, width: 16, height: 16, pixelCount: 10 });
    for (let i = 0; i < thumb.rgb.length; i += 3) {
      expect(thumb.rgb[i]).toBeCloseTo(128, 5);
      expect(thumb.rgb[i + 1]).toBeCloseTo(128, 5);
    }
  });
});
