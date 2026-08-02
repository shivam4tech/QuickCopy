import { describe, it, expect } from 'vitest';
import {
  buildEmojiFeature,
  colorHistogram,
  confidenceFromScore,
  histCosine,
  maskIoU,
  shapeSimilarity,
  bestEmojiMatch,
} from '../../../../services/ocr/emoji/match';
import type { EmojiMatchEntry } from '../../../../services/ocr/emoji/match';
import { glyphMaskFromThumb } from '../../../../services/ocr/emoji/geometry';

/** Build a 32x32 thumb with a centered square glyph on a background. */
function makeThumb(bg: [number, number, number], glyph: [number, number, number], glyphFraction = 0.6): Float32Array {
  const size = 32;
  const rgb = new Float32Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 3;
      const half = (size * glyphFraction) / 2;
      const inGlyph = Math.abs(x - (size - 1) / 2) < half && Math.abs(y - (size - 1) / 2) < half;
      rgb[o] = inGlyph ? glyph[0] : bg[0];
      rgb[o + 1] = inGlyph ? glyph[1] : bg[1];
      rgb[o + 2] = inGlyph ? glyph[2] : bg[2];
    }
  }
  return rgb;
}

function entry(emoji: string, rgb: Float32Array): EmojiMatchEntry {
  return { emoji, ...buildEmojiFeature({ rgb }) };
}

function makeCircleThumb(bg: [number, number, number], glyph: [number, number, number], radiusFraction = 0.3): Float32Array {
  const size = 32;
  const rgb = new Float32Array(size * size * 3);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const r = size * radiusFraction;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 3;
      const dx = x - cx;
      const dy = y - cy;
      const inGlyph = dx * dx + dy * dy <= r * r;
      rgb[o] = inGlyph ? glyph[0] : bg[0];
      rgb[o + 1] = inGlyph ? glyph[1] : bg[1];
      rgb[o + 2] = inGlyph ? glyph[2] : bg[2];
    }
  }
  return rgb;
}

function makeDiamondThumb(bg: [number, number, number], glyph: [number, number, number]): Float32Array {
  const size = 32;
  const rgb = new Float32Array(size * size * 3);
  const half = 10;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 3;
      const dx = x - (size - 1) / 2;
      const dy = y - (size - 1) / 2;
      const inGlyph = Math.abs(dx) + Math.abs(dy) <= half;
      rgb[o] = inGlyph ? glyph[0] : bg[0];
      rgb[o + 1] = inGlyph ? glyph[1] : bg[1];
      rgb[o + 2] = inGlyph ? glyph[2] : bg[2];
    }
  }
  return rgb;
}

describe('colorHistogram', () => {
  it('builds a normalized histogram from glyph pixels only', () => {
    const rgb = makeThumb([255, 255, 255], [255, 0, 0]);
    const mask = glyphMaskFromThumb(rgb);
    expect(Array.from(mask).some((v) => v === 1)).toBe(true);
    const hist = colorHistogram(rgb, mask);
    const sum = hist.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});

describe('maskIoU / shapeSimilarity', () => {
  it('scores identical masks ~1 and disjoint masks ~0', () => {
    const a = new Uint8Array(16 * 16);
    const b = new Uint8Array(16 * 16);
    for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) a[y * 16 + x] = 1;
    for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) b[y * 16 + x] = 1;
    expect(maskIoU(a, b)).toBe(1);

    const c = new Uint8Array(16 * 16);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) c[y * 16 + x] = 1;
    expect(maskIoU(a, c)).toBe(0);
  });

  it('is tolerant to a 1px misalignment', () => {
    const a = new Uint8Array(32 * 32);
    const b = new Uint8Array(32 * 32);
    for (let y = 8; y < 24; y++) for (let x = 8; x < 24; x++) a[y * 32 + x] = 1;
    for (let y = 9; y < 25; y++) for (let x = 9; x < 25; x++) b[y * 32 + x] = 1;
    expect(shapeSimilarity(a, b)).toBeGreaterThan(0.8);
  });
});

describe('histCosine', () => {
  it('is ~1 for identical and low for different colors', () => {
    const h1 = colorHistogram(makeThumb([255, 255, 255], [0, 0, 255]), glyphMaskFromThumb(makeThumb([255, 255, 255], [0, 0, 255])));
    const h2 = colorHistogram(makeThumb([255, 255, 255], [0, 0, 255]), glyphMaskFromThumb(makeThumb([255, 255, 255], [0, 0, 255])));
    const h3 = colorHistogram(makeThumb([255, 255, 255], [255, 0, 0]), glyphMaskFromThumb(makeThumb([255, 255, 255], [255, 0, 0])));
    expect(histCosine(h1, h2)).toBeGreaterThan(0.99);
    expect(histCosine(h1, h3)).toBeLessThan(0.3);
  });
});

describe('bestEmojiMatch', () => {
  it('matches an identical glyph strongly regardless of background color', () => {
    const catalog = entry('❤️', makeThumb([128, 128, 128], [255, 0, 0]));
    const query = buildEmojiFeature({ rgb: makeThumb([255, 255, 255], [255, 0, 0]) });
    const { match } = bestEmojiMatch(query, [catalog], 0.55);
    expect(match).not.toBeNull();
    expect(match!.emoji).toBe('❤️');
    expect(match!.score).toBeGreaterThan(0.9);
    expect(match!.confidence).toBeGreaterThan(80);
  });

  it('rejects a glyph that is not in the catalog', () => {
    const catalog = entry('❤️', makeThumb([128, 128, 128], [255, 0, 0]));
    const query = buildEmojiFeature({ rgb: makeThumb([255, 255, 255], [0, 255, 0]) }); // green square
    const { match } = bestEmojiMatch(query, [catalog], 0.55);
    expect(match).toBeNull();
  });

  it('picks the best candidate from several (blue/red discrimination)', () => {
    const red = entry('❤️', makeThumb([128, 128, 128], [255, 0, 0]));
    const blue = entry('💙', makeThumb([128, 128, 128], [0, 0, 255]));
    const green = entry('💚', makeThumb([128, 128, 128], [0, 255, 0]));
    const query = buildEmojiFeature({ rgb: makeThumb([10, 10, 10], [0, 0, 255]) }); // blue glyph on dark bg
    const { match, ranked } = bestEmojiMatch(query, [red, blue, green], 0.55);
    expect(match).not.toBeNull();
    expect(match!.emoji).toBe('💙');
    expect(ranked[0]!.emoji).toBe('💙');
  });

  it('uses shape to separate same-color glyphs', () => {
    const circle = entry('🔴', makeCircleThumb([128, 128, 128], [255, 0, 0]));
    const diamond = entry('🔶', makeDiamondThumb([128, 128, 128], [255, 0, 0]));
    const query = buildEmojiFeature({ rgb: makeCircleThumb([255, 255, 255], [255, 0, 0]) });
    const { match } = bestEmojiMatch(query, [diamond, circle], 0.55);
    expect(match).not.toBeNull();
    expect(match!.emoji).toBe('🔴');
  });

  it('returns null for an empty catalog', () => {
    const query = buildEmojiFeature({ rgb: makeThumb([255, 255, 255], [255, 0, 0]) });
    const { match } = bestEmojiMatch(query, [], 0.55);
    expect(match).toBeNull();
  });
});

describe('confidenceFromScore', () => {
  it('maps score to a 0..100 confidence', () => {
    expect(confidenceFromScore(0.9)).toBe(100);
    expect(confidenceFromScore(0.7)).toBe(50);
    expect(confidenceFromScore(0.55)).toBe(13);
    expect(confidenceFromScore(0.1)).toBe(0);
  });
});
