import { describe, it, expect } from 'vitest';
import { applyEmojiDetections } from '../../../../services/ocr/emoji/apply';
import type { EmojiDetection } from '../../../../services/ocr/emoji/EmojiService';
import type { OcrResult } from '@type/index';

function makeResult(): OcrResult {
  return {
    text: 'hello world\nnext line\n',
    confidence: 90,
    language: 'eng',
    duration: 100,
    blocks: [
      { text: 'hello world', confidence: 92, bbox: { x: 10, y: 0, width: 120, height: 20 } },
      { text: 'next line', confidence: 91, bbox: { x: 10, y: 25, width: 100, height: 20 } },
    ],
  };
}

function makeEmoji(x: number, y: number, text = '❤️', width = 16, height = 16): EmojiDetection {
  return { text, x, y, width, height, confidence: 80, score: 0.9 };
}

describe('applyEmojiDetections', () => {
  it('inserts an emoji inline at its horizontal position within the anchored block', () => {
    // emoji sits over the middle of the first block ("hello world")
    const result = applyEmojiDetections(makeResult(), [makeEmoji(10 + 60, 5, '❤️')]);
    expect(result.text).toContain('❤️');
    // anchored into "hello world" at ~50% of its length
    expect(result.text).toBe('hello ❤️world\nnext line\n');
    // anchor block updated too
    expect(result.blocks[0]!.text).toContain('❤️');
    expect(result.blocks[1]!.text).toBe('next line');
  });

  it('inserts multiple emojis left-to-right within a block', () => {
    const result = applyEmojiDetections(
      makeResult(),
      [makeEmoji(10 + 100, 5, '🍕'), makeEmoji(10 + 10, 5, '😀')],
    );
    expect(result.text).toBe('he😀llo worl🍕d\nnext line\n');
  });

  it('ignores emojis that overlap no block', () => {
    const original = makeResult();
    const result = applyEmojiDetections(original, [makeEmoji(200, 200, '🎉')]);
    expect(result.text).toBe(original.text);
  });

  it('returns the result unchanged when there are no emojis', () => {
    const original = makeResult();
    expect(applyEmojiDetections(original, [])).toBe(original);
  });

  it('handles an empty text gracefully', () => {
    const empty: OcrResult = { text: '', confidence: 0, language: 'eng', duration: 0, blocks: [] };
    const result = applyEmojiDetections(empty, [makeEmoji(10, 10, '👍')]);
    expect(result.text).toBe('');
  });
});
