/**
 * Pure pixel geometry for the emoji recognizer: color mask, connected
 * components, component filtering and (DOM-free) thumbnail extraction.
 *
 * Everything here operates on raw RGBA arrays so it is unit-testable in Node
 * without a canvas.
 */

import type { AnalyzerInput } from '../router/ImageAnalyzer';

export const THUMB_SIZE = 32;

/** A connected blob of "emoji-colored" pixels. */
export interface Component {
  x: number;
  y: number;
  width: number;
  height: number;
  pixelCount: number;
}

export interface ComponentFilterOptions {
  minPixels?: number;
  minSize?: number;
  maxSize?: number;
}

/**
 * Mark pixels that are plausibly part of an emoji glyph: saturated enough to be
 * colorful (text is usually near-monochrome), and neither near-black nor
 * near-white (page background / paper).
 *
 * The threshold is deliberately low so blue/red/deep colored glyph pixels are
 * never dropped — the matcher discriminates by color histogram and shape
 * rather than by how "pure" a color the mask admitted.
 */
export function buildEmojiMask(input: AnalyzerInput): Uint8Array {
  const { width, height, data } = input;
  const n = width * height;
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (data[o + 3]! < 128) continue; // transparent
    const r = data[o]!;
    const g = data[o + 1]!;
    const b = data[o + 2]!;
    mask[i] = isEmojiColorPixel(r, g, b) ? 1 : 0;
  }
  return mask;
}

/** Isolated helper so the mask rule is exactly one place (used in tests). */
/** Isolated helper so the mask rule is exactly one place (used in tests). */
export function isEmojiColorPixel(r: number, g: number, b: number): boolean {
  const max = r > g ? (r > b ? r : b) : g > b ? g : b;
  const min = r < g ? (r < b ? r : b) : g < b ? g : b;
  const sat = max - min;
  if (sat < 16) return false; // near-monochrome (text, grayscale background)
  return max >= 30 && min <= 245; // neither near-black nor near-white
}

/**
 * Re-derive the glyph mask from a (already composited) RGB thumbnail using the
 * exact same rule as `buildEmojiMask`. This is what makes catalog glyphs and
 * captured blobs comparable: both are reduced to "glyph pixels vs background"
 * with one consistent rule, so their bounding boxes and shapes line up.
 */
export function glyphMaskFromThumb(rgb: Float32Array): Uint8Array {
  const n = rgb.length / 3;
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    mask[i] = isEmojiColorPixel(rgb[o]!, rgb[o + 1]!, rgb[o + 2]!) ? 1 : 0;
  }
  return mask;
}

/** 8-connected components of a binary mask. */
export function connectedComponents(mask: Uint8Array, width: number, height: number): Component[] {
  const visited = new Uint8Array(width * height);
  const comps: Component[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start]! || visited[start]!) continue;
    const stack: number[] = [start];
    visited[start] = 1;
    let minX = start % width;
    let maxX = minX;
    let minY = (start / width) | 0;
    let maxY = minY;
    let count = 0;
      while (stack.length > 0) {
      const p = stack.pop() as number;
      count++;
      const px = p % width;
      const py = (p / width) | 0;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
      const x0 = px > 0 ? px - 1 : 0;
      const x1 = px < width - 1 ? px + 1 : width - 1;
      const y0 = py > 0 ? py - 1 : 0;
      const y1 = py < height - 1 ? py + 1 : height - 1;
      for (let yy = y0; yy <= y1; yy++) {
        const rowBase = yy * width;
        for (let xx = x0; xx <= x1; xx++) {
          const q = rowBase + xx;
          if (mask[q]! && !visited[q]!) {
            visited[q] = 1;
            stack.push(q);
          }
        }
      }
    }
    comps.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, pixelCount: count });
  }
  return comps;
}

/**
 * Keep components that look like an emoji-sized glyph: large enough to be a
 * real glyph, roughly square, and dense enough to not be scattered noise.
 */
export function filterEmojiComponents(
  comps: Component[],
  options: ComponentFilterOptions = {},
): Component[] {
  const minPixels = options.minPixels ?? 12;
  const minSize = options.minSize ?? 8;
  const maxSize = options.maxSize ?? 180;
  return comps.filter((c) => {
    if (c.pixelCount < minPixels) return false;
    if (c.width < minSize || c.height < minSize) return false;
    if (c.width > maxSize || c.height > maxSize) return false;
    const aspect = c.width / c.height;
    if (aspect < 0.5 || aspect > 2.4) return false;
    const density = c.pixelCount / (c.width * c.height);
    if (density < 0.05) return false;
    return true;
  });
}

/** A square RGB thumbnail, composited onto a mid-gray background. */
export interface Thumbnail {
  rgb: Float32Array; // THUMB_SIZE*THUMB_SIZE*3 (r,g,b interleaved)
}

/**
 * Extract a square, gray-composited thumbnail around a component using pure
 * box-averaging downscale. Works without a DOM.
 */
export function extractThumbnail(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  comp: Component,
  size = THUMB_SIZE,
): Thumbnail {
  const rgb = new Float32Array(size * size * 3);

  const cx = comp.x + comp.width / 2;
  const cy = comp.y + comp.height / 2;
  let side = Math.max(comp.width, comp.height) * 1.3;
  side = Math.max(side, 6);
  const half = side / 2;
  const sx = Math.max(0, Math.floor(cx - half));
  const sy = Math.max(0, Math.floor(cy - half));
  const rw = Math.min(Math.ceil(cx + half), imageWidth) - sx;
  const rh = Math.min(Math.ceil(cy + half), imageHeight) - sy;
  if (rw < 1 || rh < 1) {
    for (let i = 0; i < rgb.length; i += 3) {
      rgb[i] = 128;
      rgb[i + 1] = 128;
      rgb[i + 2] = 128;
    }
    return { rgb };
  }

  for (let ty = 0; ty < size; ty++) {
    const yStart = Math.floor((ty * rh) / size);
    const yEnd = Math.max(yStart + 1, Math.floor(((ty + 1) * rh) / size));
    for (let tx = 0; tx < size; tx++) {
      const xStart = Math.floor((tx * rw) / size);
      const xEnd = Math.max(xStart + 1, Math.floor(((tx + 1) * rw) / size));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let y = yStart; y < yEnd; y++) {
        const row = (sy + y) * imageWidth;
        for (let x = xStart; x < xEnd; x++) {
          const o = (row + sx + x) * 4;
          const a = data[o + 3]! / 255;
          r += data[o]! * a + 128 * (1 - a);
          g += data[o + 1]! * a + 128 * (1 - a);
          b += data[o + 2]! * a + 128 * (1 - a);
          n++;
        }
      }
      const o = (ty * size + tx) * 3;
      if (n > 0) {
        rgb[o] = r / n;
        rgb[o + 1] = g / n;
        rgb[o + 2] = b / n;
      } else {
        rgb[o] = 128;
        rgb[o + 1] = 128;
        rgb[o + 2] = 128;
      }
    }
  }

  return { rgb };
}

/**
 * Tight crop of a thumbnail around its glyph mask, resampled to `size` with a
 * small background margin. Catalog glyphs and captured blobs both pass through
 * here, so whatever their source scale, they end up glyph-centered with the
 * same fill fraction and comparable shapes.
 */
export function tightCropThumb(
  rgb: Float32Array,
  size = THUMB_SIZE,
  margin = 0.1,
  mask?: Uint8Array,
): { rgb: Float32Array; mask: Uint8Array; bounds: { x0: number; y0: number; x1: number; y1: number } } {
  const srcSize = Math.round(Math.sqrt(rgb.length / 3));
  const glyphMask = mask ?? glyphMaskFromThumb(rgb);
  const out = new Float32Array(size * size * 3);
  const outMask = new Uint8Array(size * size);

  let minX = srcSize;
  let minY = srcSize;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < srcSize; y++) {
    for (let x = 0; x < srcSize; x++) {
      if (glyphMask[y * srcSize + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { rgb: out, mask: outMask, bounds: { x0: 0, y0: 0, x1: 0, y1: 0 } };

  const gw = maxX - minX + 1;
  const gh = maxY - minY + 1;
  const padX = Math.max(1, Math.round(gw * margin));
  const padY = Math.max(1, Math.round(gh * margin));
  const x0 = Math.max(0, minX - padX);
  const y0 = Math.max(0, minY - padY);
  const x1 = Math.min(srcSize, maxX + 1 + padX);
  const y1 = Math.min(srcSize, maxY + 1 + padY);
  const cw = Math.max(1, x1 - x0);
  const ch = Math.max(1, y1 - y0);

  for (let ty = 0; ty < size; ty++) {
    const sy = Math.min(ch - 1, Math.floor((ty * ch) / size));
    for (let tx = 0; tx < size; tx++) {
      const sx = Math.min(cw - 1, Math.floor((tx * cw) / size));
      const si = (y0 + sy) * srcSize + (x0 + sx);
      const oi = ty * size + tx;
      const sr = si * 3;
      const or = oi * 3;
      out[or] = rgb[sr]!;
      out[or + 1] = rgb[sr + 1]!;
      out[or + 2] = rgb[sr + 2]!;
      outMask[oi] = glyphMask[si]!;
    }
  }

  return { rgb: out, mask: outMask, bounds: { x0, y0, x1, y1 } };
}
