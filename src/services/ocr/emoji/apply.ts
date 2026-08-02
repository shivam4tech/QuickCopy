/**
 * Splice recognized emojis into an OcrResult at their on-screen position.
 *
 * Each emoji is anchored to the OCR block whose vertical band overlaps it most,
 * then inserted at a character offset proportional to the emoji's horizontal
 * position within that block's bbox. Both the full text and the anchor block's
 * text are updated so downstream consumers (sidebar, postprocessing) agree.
 */

import type { OcrResult, OcrBlock } from '@type/index';
import type { EmojiDetection } from './EmojiService';

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function verticalOverlap(a: { y: number; height: number }, b: { y: number; height: number }): number {
  const aBottom = a.y + a.height;
  const bBottom = b.y + b.height;
  return Math.max(0, Math.min(aBottom, bBottom) - Math.max(a.y, b.y));
}

/** Character offset (into a block's text) for an emoji based on its x position. */
function offsetInBlock(emoji: EmojiDetection, block: OcrBlock): number {
  const bw = Math.max(block.bbox.width, 1);
  const frac = clamp((emoji.x + emoji.width / 2 - block.bbox.x) / bw, 0, 1);
  return Math.round(frac * block.text.length);
}

export function applyEmojiDetections(result: OcrResult, emojis: EmojiDetection[]): OcrResult {
  if (emojis.length === 0) return result;
  const blocks = result.blocks ?? [];

  // Anchor each emoji to the block with the most vertical overlap.
  const anchors = new Map<number, EmojiDetection[]>();
  for (const emoji of emojis) {
    let bestIdx = -1;
    let bestOverlap = 0;
    for (let i = 0; i < blocks.length; i++) {
      const overlap = verticalOverlap(emoji, blocks[i]!.bbox);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      const list = anchors.get(bestIdx) ?? [];
      list.push(emoji);
      anchors.set(bestIdx, list);
    }
  }
  if (anchors.size === 0) return result;

  // Locate each block in the full text (blocks are in reading order) and
  // compute insertion offsets.
  let text = result.text;
  const inserts: { offset: number; emoji: string }[] = [];
  let cursor = 0;
  blocks.forEach((block, i) => {
    const emos = anchors.get(i);
    const needle = (block.text ?? '').trim();
    let start = needle.length >= 1 ? text.indexOf(needle, cursor) : -1;
    if (start < 0) start = cursor;
    const end = start + Math.max(needle.length, 1);
    cursor = Math.max(cursor, end);
    if (!emos || emos.length === 0) return;
    const sorted = [...emos].sort((a, b) => a.x - b.x);
    for (const emoji of sorted) {
      const inner = clamp(offsetInBlock(emoji, block), 0, Math.max(needle.length, 0));
      inserts.push({ offset: clamp(start + inner, start, end), emoji: emoji.text });
    }
  });

  if (inserts.length > 0) {
    inserts.sort((a, b) => b.offset - a.offset);
    for (const ins of inserts) {
      text = text.slice(0, ins.offset) + ins.emoji + text.slice(ins.offset);
    }
  }

  const newBlocks: OcrBlock[] = blocks.map((block, i) => {
    const emos = anchors.get(i);
    if (!emos || emos.length === 0) return block;
    let bt = block.text ?? '';
    const sorted = [...emos].sort((a, b) => a.x - b.x);
    for (const emoji of sorted) {
      const idx = clamp(offsetInBlock(emoji, block), 0, bt.length);
      bt = bt.slice(0, idx) + emoji.text + bt.slice(idx);
    }
    return { ...block, text: bt };
  });

  return { ...result, text, blocks: newBlocks };
}
