import { describe, it, expect } from 'vitest';
import { detectEmojisInImage } from '../../../../services/ocr/emoji/EmojiService';
import { extractThumbnail } from '../../../../services/ocr/emoji/geometry';
import { buildEmojiFeature } from '../../../../services/ocr/emoji/match';
import type { EmojiMatchEntry } from '../../../../services/ocr/emoji/match';

const W = 96;
const H = 48;

interface Blob {
  x: number;
  y: number;
  w: number;
  h: number;
  rgb: [number, number, number];
}

function buildImage(bg: [number, number, number], blobs: Blob[]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    data[i * 4] = bg[0];
    data[i * 4 + 1] = bg[1];
    data[i * 4 + 2] = bg[2];
    data[i * 4 + 3] = 255;
  }
  for (const b of blobs) {
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        const o = (y * W + x) * 4;
        data[o] = b.rgb[0];
        data[o + 1] = b.rgb[1];
        data[o + 2] = b.rgb[2];
        data[o + 3] = 255;
      }
    }
  }
  return data;
}

/** Build a catalog entry the same way EmojiCatalog does (glyph on mid-gray). */
function entryFromBlob(emoji: string, bg: [number, number, number], blob: Blob): EmojiMatchEntry {
  const data = buildImage(bg, [blob]);
  const comp = { x: blob.x, y: blob.y, width: blob.w, height: blob.h, pixelCount: blob.w * blob.h };
  const rgb = extractThumbnail(data, W, H, comp, 32).rgb;
  return { emoji, ...buildEmojiFeature({ rgb }) };
}

const RED = { x: 30, y: 16, w: 16, h: 16, rgb: [255, 0, 0] as [number, number, number] };

describe('detectEmojisInImage', () => {
  it('finds a colored blob and classifies it against the catalog', () => {
    const image = buildImage([255, 255, 255], [RED]);
    const catalog = [entryFromBlob('❤️', [128, 128, 128], RED)];

    const detections = detectEmojisInImage({ width: W, height: H, data: image }, catalog);
    expect(detections).toHaveLength(1);
    expect(detections[0]!.text).toBe('❤️');
    expect(detections[0]!.score).toBeGreaterThan(0.9);
    expect(detections[0]!.x).toBe(RED.x);
    expect(detections[0]!.y).toBe(RED.y);
  });

  it('works on a dark background too', () => {
    const image = buildImage([20, 20, 20], [RED]);
    const catalog = [entryFromBlob('❤️', [128, 128, 128], RED)];

    const detections = detectEmojisInImage({ width: W, height: H, data: image }, catalog);
    expect(detections).toHaveLength(1);
    expect(detections[0]!.text).toBe('❤️');
  });

  it('returns nothing when the blob is not in the catalog', () => {
    const image = buildImage([255, 255, 255], [RED]);
    const green = { x: 30, y: 16, w: 16, h: 16, rgb: [0, 255, 0] as [number, number, number] };
    const catalog = [entryFromBlob('💚', [128, 128, 128], green)];

    const detections = detectEmojisInImage({ width: W, height: H, data: image }, catalog);
    expect(detections).toHaveLength(0);
  });

  it('ignores monochrome text regions', () => {
    // black text blob — same size/shape as the emoji but not colorful
    const text = { x: 30, y: 16, w: 16, h: 16, rgb: [0, 0, 0] as [number, number, number] };
    const image = buildImage([255, 255, 255], [text]);
    const catalog = [entryFromBlob('❤️', [128, 128, 128], RED)];

    const detections = detectEmojisInImage({ width: W, height: H, data: image }, catalog);
    expect(detections).toHaveLength(0);
  });

  it('sorts multiple detections in reading order', () => {
    const blobA = { x: 10, y: 8, w: 16, h: 16, rgb: [255, 0, 0] as [number, number, number] };
    const blobB = { x: 60, y: 8, w: 16, h: 16, rgb: [0, 0, 255] as [number, number, number] };
    const image = buildImage([255, 255, 255], [blobA, blobB]);
    const catalog = [
      entryFromBlob('❤️', [128, 128, 128], blobA),
      entryFromBlob('💙', [128, 128, 128], blobB),
    ];

    const detections = detectEmojisInImage({ width: W, height: H, data: image }, catalog);
    expect(detections).toHaveLength(2);
    expect(detections[0]!.text).toBe('❤️');
    expect(detections[1]!.text).toBe('💙');
  });
});
