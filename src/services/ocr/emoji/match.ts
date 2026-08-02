/**
 * Matching logic: shape overlap (IoU) + color-histogram similarity between a
 * captured glyph and pre-rendered emoji candidates.
 *
 * Why not normalized cross-correlation on pixels? NCC is extremely sensitive to
 * sub-pixel alignment and to which pixels the mask admitted, so real captures
 * (different backgrounds, antialiasing, blue/red glyphs) scored ~0.4-0.6 and
 * every detection looked "weak". Instead we compare:
 *   - shape: IoU of the binary glyph masks (tolerant to color/lighting),
 *   - color: cosine distance between RGB color histograms (the discriminative
 *     signal for blue vs red vs green, and for multi-color flags).
 * Both features are computed from a tight, glyph-centered crop so catalog and
 * captured sides use the same mask rule and geometry.
 */

import type { Thumbnail } from './geometry';
import { glyphMaskFromThumb, tightCropThumb } from './geometry';

/** Precomputed features for one catalog emoji (or one captured blob). */
export interface EmojiFeature {
  /** 32x32 tight-cropped glyph mask (1 = glyph pixel). */
  shapeMask: Uint8Array;
  /** 32x32 tight-cropped RGB of the glyph + thin background margin. */
  rgb: Float32Array;
  /** Normalized RGB color histogram (HIST_BINS^3). */
  hist: Float32Array;
}

export interface EmojiMatchEntry extends EmojiFeature {
  emoji: string;
  label?: string;
}

export interface EmojiMatch {
  emoji: string;
  label?: string;
  /** Combined score in [0, 1]. */
  score: number;
  /** Shape IoU in [0, 1]. */
  shapeScore: number;
  /** Color-histogram cosine in [0, 1]. */
  colorScore: number;
  /** Mapped 0..100 confidence. */
  confidence: number;
}

const BINS = 6;
export const HIST_BINS = BINS;
const HIST_LEN = BINS * BINS * BINS;
const SHAPE_WEIGHT = 0.4;
const COLOR_WEIGHT = 0.6;

/**
 * Build the match features for a thumbnail. Both sides (catalog and captured)
 * call exactly this, guaranteeing consistent mask/geometry.
 */
export function buildEmojiFeature(thumb: Thumbnail): EmojiFeature {
  return buildEmojiFeatureFromRgb(thumb.rgb);
}

export function buildEmojiFeatureFromRgb(rgb: Float32Array): EmojiFeature {
  const mask = glyphMaskFromThumb(rgb);
  const cropped = tightCropThumb(rgb, 32, 0.1, mask);
  const shapeMask = cropped.mask;
  const hist = colorHistogram(cropped.rgb, cropped.mask);
  return { shapeMask, rgb: cropped.rgb, hist };
}

/**
 * RGB color histogram with soft binning (distance-weighted corners) so small
 * hue/brightness shifts don't scatter mass across bins. Only glyph-mask pixels
 * are counted — the background is never part of the color signature.
 */
export function colorHistogram(rgb: Float32Array, mask: Uint8Array): Float32Array {
  const hist = new Float32Array(HIST_LEN);
  const n = rgb.length / 3;
  let glyphPixels = 0;
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    glyphPixels++;
    const o = i * 3;
    const r = rgb[o]! / 255;
    const g = rgb[o + 1]! / 255;
    const b = rgb[o + 2]! / 255;
    const bin = (v: number): [number, number] => {
      const scaled = v * BINS;
      const lo = Math.floor(scaled);
      if (lo >= BINS) return [BINS - 1, 0];
      return [lo, scaled - lo];
    };
    const [bri, fr] = bin(r);
    const [bgi, fg] = bin(g);
    const [bbi, fb] = bin(b);
    const idx = (bi: number, gi: number, ri: number) => (bi * BINS + gi) * BINS + ri;
    const w = (fr: number, fg: number, fb: number) => (1 - fr) * (1 - fg) * (1 - fb);
    const bump = (bi: number, gi: number, ri: number, amount: number) => {
      hist[idx(bi, gi, ri)] = hist[idx(bi, gi, ri)]! + amount;
    };
    bump(bri, bgi, bbi, w(fr, fg, fb));
    if (fr > 0) bump(bri + 1, bgi, bbi, fr * (1 - fg) * (1 - fb));
    if (fg > 0) bump(bri, bgi + 1, bbi, (1 - fr) * fg * (1 - fb));
    if (fb > 0) bump(bri, bgi, bbi + 1, (1 - fr) * (1 - fg) * fb);
    if (fr > 0 && fg > 0) bump(bri + 1, bgi + 1, bbi, fr * fg * (1 - fb));
    if (fr > 0 && fb > 0) bump(bri + 1, bgi, bbi + 1, fr * (1 - fg) * fb);
    if (fg > 0 && fb > 0) bump(bri, bgi + 1, bbi + 1, (1 - fr) * fg * fb);
    if (fr > 0 && fg > 0 && fb > 0) bump(bri + 1, bgi + 1, bbi + 1, fr * fg * fb);
  }
  if (glyphPixels === 0) return hist;
  const inv = 1 / glyphPixels;
  for (let i = 0; i < HIST_LEN; i++) hist[i] = hist[i]! * inv;
  return hist;
}

/** IoU of two binary glyph masks. Empty-vs-empty is treated as 1 (no shape info). */
export function maskIoU(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) return 0;
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ? 1 : 0;
    const bv = b[i] ? 1 : 0;
    inter += av & bv;
    union += av | bv;
  }
  if (union === 0) return 1;
  return inter / union;
}

/** Cosine similarity between two normalized histograms. */
export function histCosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom < 1e-9) return 0;
  return Math.min(1, Math.max(0, dot / denom));
}

function shiftMask(mask: Uint8Array, w: number, h: number, dx: number, dy: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= h) continue;
    for (let x = 0; x < w; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= w) continue;
      out[ty * w + tx] = mask[y * w + x]!;
    }
  }
  return out;
}

/**
 * Shape similarity with ±1px alignment search: the captured mask is shifted a
 * hair in each direction and the best IoU is kept, absorbing tiny centering
 * differences between the two tight crops.
 */
export function shapeSimilarity(query: Uint8Array, candidate: Uint8Array): number {
  const size = Math.round(Math.sqrt(query.length));
  let best = maskIoU(query, candidate);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const shifted = shiftMask(query, size, size, dx, dy);
      const iou = maskIoU(shifted, candidate);
      if (iou > best) best = iou;
    }
  }
  return best;
}

export interface BestMatchResult {
  match: EmojiMatch | null;
  ranked: EmojiMatch[];
}

/**
 * Rank all catalog entries against a query feature. Returns the best match
 * (or null below `minScore`) and the full top-5 ranking.
 */
export function bestEmojiMatch(
  query: EmojiFeature,
  entries: EmojiMatchEntry[],
  minScore = 0.55,
): BestMatchResult {
  const ranked: EmojiMatch[] = [];
  for (const e of entries) {
    const shapeScore = shapeSimilarity(query.shapeMask, e.shapeMask);
    const colorScore = histCosine(query.hist, e.hist);
    const score = clamp(SHAPE_WEIGHT * shapeScore + COLOR_WEIGHT * colorScore, 0, 1);
    ranked.push({ emoji: e.emoji, label: e.label, score, shapeScore, colorScore, confidence: 0 });
  }
  ranked.sort((a, b) => b.score - a.score);

  const top = ranked.slice(0, 5);
  for (const m of top) m.confidence = confidenceFromScore(m.score);

  const best = ranked[0];
  if (!best || best.score < minScore) return { match: null, ranked: top };
  return { match: best, ranked: top };
}

/** Map a combined score to a 0..100 confidence: score>=0.9 -> 100, ~0.55 -> ~20. */
export function confidenceFromScore(score: number): number {
  return Math.round(clamp(((score - 0.5) / 0.4) * 100, 0, 100));
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
