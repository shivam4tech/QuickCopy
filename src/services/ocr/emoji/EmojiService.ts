/**
 * Emoji recognition service.
 *
 * Pipeline (best-effort; silently degrades when the DOM/emoji fonts are
 * unavailable):
 *   1. Build/lazily load the rendered emoji catalog (once, cached).
 *   2. Decode the captured data URL to RGBA pixels.
 *   3. Find emoji-sized colorful blobs (mask -> connected components).
 *   4. Normalized cross-correlation match each blob against the catalog.
 *
 * All detections are in the coordinate space of the captured image, matching
 * `OcrResult.blocks[].bbox`, so they can be spliced into the OCR text.
 */

import { decodeDataUrl } from '../image';
import { EmojiCatalog } from './EmojiCatalog';
import {
  buildEmojiMask,
  connectedComponents,
  extractThumbnail,
  filterEmojiComponents,
} from './geometry';
import type { EmojiMatchEntry } from './match';
import { bestEmojiMatch, buildEmojiFeature } from './match';

export interface EmojiDetection {
  text: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0..100 */
  confidence: number;
  /** Combined match score (shape IoU + color histogram) in [0, 1]. */
  score: number;
}

export interface EmojiDetectOptions {
  minScore?: number;
  minSize?: number;
  maxSize?: number;
  minPixels?: number;
}

export function detectEmojisInImage(
  input: { width: number; height: number; data: Uint8ClampedArray },
  entries: EmojiMatchEntry[],
  options: EmojiDetectOptions = {},
): EmojiDetection[] {
  const minScore = options.minScore ?? 0.55;
  const mask = buildEmojiMask(input);
  const comps = connectedComponents(mask, input.width, input.height);
  const filtered = filterEmojiComponents(comps, options);

  const detections: EmojiDetection[] = [];
  for (const comp of filtered) {
    const thumb = extractThumbnail(input.data, input.width, input.height, comp);
    const query = buildEmojiFeature(thumb);
    const { match } = bestEmojiMatch(query, entries, minScore);
    if (!match) continue;
    detections.push({
      text: match.emoji,
      label: match.label,
      x: comp.x,
      y: comp.y,
      width: comp.width,
      height: comp.height,
      confidence: match.confidence,
      score: match.score,
    });
  }

  detections.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  return detections;
}

export class EmojiService {
  private readonly catalog = new EmojiCatalog();

  get catalogReady(): boolean {
    return this.catalog.built;
  }

  /** Detect emojis in a captured data URL. Returns [] on any failure. */
  async detect(dataUrl: string, options?: EmojiDetectOptions): Promise<EmojiDetection[]> {
    const entries = await this.catalog.ensureBuilt();
    if (!entries) return [];
    const rgba = await decodeDataUrl(dataUrl);
    if (!rgba) return [];
    return detectEmojisInImage(rgba, entries, options);
  }

  reset(): void {
    this.catalog.reset();
  }
}

export const emojiService = new EmojiService();
