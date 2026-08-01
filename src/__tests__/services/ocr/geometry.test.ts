import { describe, it, expect } from 'vitest';
import { flattenTesseractBlocks } from '../../../services/ocr/geometry';

describe('flattenTesseractBlocks', () => {
  it('flattens nested blocks -> paragraphs -> lines with per-line bboxes', () => {
    // Shape captured from real tesseract.js v7 output (data.blocks is the
    // native nested Tesseract JSON; line.text carries a trailing newline).
    const input = [
      {
        text: 'class Program {\nstatic void Main() {\nx();\n}\n}\n',
        confidence: 90,
        blocktype: 1,
        bbox: { x0: 100, y0: 0, x1: 300, y1: 100 },
        paragraphs: [
          {
            text: 'class Program {\nstatic void Main() {\nx();\n}\n}\n',
            confidence: 90,
            is_ltr: 1,
            bbox: { x0: 100, y0: 0, x1: 300, y1: 100 },
            lines: [
              { text: 'class Program {\n', confidence: 92, bbox: { x0: 100, y0: 0, x1: 230, y1: 18 } },
              { text: 'static void Main() {\n', confidence: 91, bbox: { x0: 140, y0: 20, x1: 290, y1: 38 } },
              { text: 'x();\n', confidence: 95, bbox: { x0: 180, y0: 40, x1: 240, y1: 58 } },
              { text: '}\n', confidence: 96, bbox: { x0: 140, y0: 60, x1: 155, y1: 78 } },
              { text: '}\n', confidence: 97, bbox: { x0: 100, y0: 80, x1: 115, y1: 98 } },
            ],
          },
        ],
      },
    ];

    const result = flattenTesseractBlocks(input);
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({
      text: 'class Program {',
      confidence: 92,
      bbox: { x: 100, y: 0, width: 130, height: 18 },
    });
    expect(result[1]).toEqual({
      text: 'static void Main() {',
      confidence: 91,
      bbox: { x: 140, y: 20, width: 150, height: 18 },
    });
    expect(result[2]).toEqual({
      text: 'x();',
      confidence: 95,
      bbox: { x: 180, y: 40, width: 60, height: 18 },
    });
    expect(result[3]!.bbox.x).toBe(140);
    expect(result[4]!.bbox.x).toBe(100);
  });

  it('falls back to block-level entries when a block has no paragraphs', () => {
    const result = flattenTesseractBlocks([
      { text: 'hello world', confidence: 80, bbox: { x0: 10, y0: 5, x1: 210, y1: 25 } },
    ]);
    expect(result).toEqual([
      { text: 'hello world', confidence: 80, bbox: { x: 10, y: 5, width: 200, height: 20 } },
    ]);
  });

  it('returns an empty array for null/undefined/empty input', () => {
    expect(flattenTesseractBlocks(null)).toEqual([]);
    expect(flattenTesseractBlocks(undefined)).toEqual([]);
    expect(flattenTesseractBlocks([])).toEqual([]);
  });

  it('skips malformed entries', () => {
    const result = flattenTesseractBlocks([
      null,
      'garbage',
      { paragraphs: [{ lines: [{ text: 'ok()', confidence: 90, bbox: { x0: 0, y0: 0, x1: 40, y1: 20 } }] }] },
      { text: 'no-bbox' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.text).toBe('ok()');
  });
});
