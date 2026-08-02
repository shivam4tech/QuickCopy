/**
 * EmojiCatalog renders every candidate emoji with the browser's own emoji font
 * and pre-computes normalized match features.
 *
 * This only runs in DOM contexts (content script). In non-DOM contexts
 * (service worker, tests) `ensureBuilt()` returns null and the recognizer
 * degrades to "no emojis detected".
 */

import { COMMON_EMOJI_CANDIDATES, COUNTRY_FLAG_CODES, flagFromCode } from './emojiSet';
import { extractThumbnail, THUMB_SIZE } from './geometry';
import type { EmojiMatchEntry } from './match';
import { buildEmojiFeatureFromRgb } from './match';

const RENDER_SIZE = 64;
const EMOJI_FONT = '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", "Twemoji Mozilla", sans-serif';

interface Candidate {
  emoji: string;
  label?: string;
}

function hasDocument(): boolean {
  try {
    return typeof document !== 'undefined' && typeof document.createElement === 'function';
  } catch {
    return false;
  }
}

/** Tight bounding box of the glyph pixels in a rendered RGBA buffer. */
function glyphBounds(
  rgba: Uint8ClampedArray,
): { minX: number; minY: number; maxX: number; maxY: number; found: boolean } {
  let minX = RENDER_SIZE;
  let minY = RENDER_SIZE;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < RENDER_SIZE; y++) {
    const row = y * RENDER_SIZE * 4;
    for (let x = 0; x < RENDER_SIZE; x++) {
      const o = row + x * 4;
      if (rgba[o + 3]! < 40) continue;
      const r = rgba[o]!;
      const g = rgba[o + 1]!;
      const b = rgba[o + 2]!;
      const max = r > g ? (r > b ? r : b) : g > b ? g : b;
      const min = r < g ? (r < b ? r : b) : g < b ? g : b;
      const grayDist = Math.abs(r - 128) + Math.abs(g - 128) + Math.abs(b - 128);
      if (max - min > 20 || grayDist > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY, found: maxX >= 0 };
}

function renderThumb(canvas: HTMLCanvasElement, emoji: string): Float32Array | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, RENDER_SIZE, RENDER_SIZE);
  ctx.font = `${RENDER_SIZE * 0.82}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, RENDER_SIZE / 2, RENDER_SIZE / 2 + RENDER_SIZE * 0.05);
  const img = ctx.getImageData(0, 0, RENDER_SIZE, RENDER_SIZE);
  const b = glyphBounds(img.data);
  if (!b.found) return null;
  const comp = {
    x: b.minX,
    y: b.minY,
    width: b.maxX - b.minX + 1,
    height: b.maxY - b.minY + 1,
    pixelCount: 1,
  };
  return extractThumbnail(img.data, RENDER_SIZE, RENDER_SIZE, comp, THUMB_SIZE).rgb;
}
export class EmojiCatalog {
  private entries: EmojiMatchEntry[] | null = null;
  private buildFailed = false;
  private building: Promise<EmojiMatchEntry[] | null> | null = null;

  get built(): boolean {
    return this.entries !== null;
  }

  ensureBuilt(): Promise<EmojiMatchEntry[] | null> {
    if (this.entries) return Promise.resolve(this.entries);
    if (this.buildFailed) return Promise.resolve(null);
    if (this.building) return this.building;
    this.building = this.build();
    return this.building;
  }

  /** Drop the cached catalog (e.g. after fonts change). */
  reset(): void {
    this.entries = null;
    this.buildFailed = false;
    this.building = null;
  }

  private candidates(): Candidate[] {
    const common = COMMON_EMOJI_CANDIDATES.map((e) => ({ emoji: e }));
    const flags = COUNTRY_FLAG_CODES.map((code) => ({
      emoji: flagFromCode(code),
      label: `${code} flag`,
    }));
    return [...common, ...flags];
  }

  private async build(): Promise<EmojiMatchEntry[] | null> {
    if (!hasDocument()) return null;
    try {
      await this.loadEmojiFont();
      const canvas = document.createElement('canvas');
      canvas.width = RENDER_SIZE;
      canvas.height = RENDER_SIZE;
      const entries: EmojiMatchEntry[] = [];
      const candidates = this.candidates();
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i]!;
        const rgb = renderThumb(canvas, candidate.emoji);
        if (!rgb) continue;
        const feature = buildEmojiFeatureFromRgb(rgb);
        entries.push({ emoji: candidate.emoji, label: candidate.label, ...feature });
        // yield periodically so a big catalog build never stalls the page
        if (i % 64 === 63) await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (entries.length === 0) {
        this.buildFailed = true;
        return null;
      }
      this.entries = entries;
      return this.entries;
    } catch {
      this.buildFailed = true;
      return null;
    }
  }

  private async loadEmojiFont(): Promise<void> {
    try {
      const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
      if (fonts?.load) {
        await Promise.all([
          fonts.load('32px "Noto Color Emoji"', '😀'),
          fonts.load('32px "Apple Color Emoji"', '😀'),
          fonts.load('32px "Segoe UI Emoji"', '😀'),
        ]).catch(() => undefined);
      }
    } catch {
      // font loading is best-effort; canvas falls back to the system font
    }
  }
}
