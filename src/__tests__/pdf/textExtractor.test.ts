import { describe, it, expect } from 'vitest';
import { itemBBox, extractTextInRegion } from '../../pdf/textExtractor';
import type { PdfTextItem } from '../../pdf/textExtractor';
import type { PageRegion } from '../../pdf/regionMapper';

function item(str: string, x: number, y: number, width: number, height = 10, hasEOL?: boolean): PdfTextItem {
  return { str, transform: [1, 0, 0, -1, x, y], width, height, hasEOL };
}

const fullRegion: PageRegion = { x0: 0, y0: 0, x1: 1000, y1: 1000 };

describe('itemBBox', () => {
  it('computes the bbox of an upright item', () => {
    const box = itemBBox(item('hello', 10, 100, 40));
    expect(box).toEqual({ x0: 10, y0: 90, x1: 50, y1: 100 });
  });

  it('computes the bbox of a rotated item (90 degrees)', () => {
    // transform: rotate 90° → x' = -y, y' = x
    const rotated: PdfTextItem = { str: 'rot', transform: [0, 1, -1, 0, 50, 50], width: 30, height: 10 };
    const box = itemBBox(rotated);
    expect(box.x0).toBeCloseTo(40);
    expect(box.y0).toBeCloseTo(50);
    expect(box.x1).toBeCloseTo(50);
    expect(box.y1).toBeCloseTo(80);
  });
});

describe('extractTextInRegion', () => {
  it('returns empty string when nothing covers the region', () => {
    const text = extractTextInRegion(
      { items: [item('hello', 500, 500, 40)] },
      { x0: 0, y0: 0, x1: 100, y1: 100 },
    );
    expect(text).toBe('');
  });

  it('returns empty string when the region is text-free (scanned page)', () => {
    const text = extractTextInRegion({ items: [] }, fullRegion);
    expect(text).toBe('');
  });

  it('extracts a single line of words in reading order', () => {
    const text = extractTextInRegion(
      {
        items: [
          item('the', 100, 200, 20),
          item('quick', 125, 200, 30),
          item('brown', 160, 200, 30),
        ],
      },
      fullRegion,
    );
    expect(text).toBe('the quick brown');
  });

  it('preserves paragraph breaks by vertical gap', () => {
    const text = extractTextInRegion(
      {
        items: [
          item('first', 100, 100, 30),
          item('second', 100, 300, 40),
        ],
      },
      fullRegion,
    );
    expect(text).toBe('first\n\nsecond');
  });

  it('joins close lines with a single newline', () => {
    const text = extractTextInRegion(
      {
        items: [
          item('line1', 100, 100, 30),
          item('line2', 100, 115, 30),
        ],
      },
      fullRegion,
    );
    expect(text).toBe('line1\nline2');
  });

  it('splits multi-column layouts by horizontal gap', () => {
    const text = extractTextInRegion(
      {
        items: [
          // Column 1
          item('alpha', 100, 100, 40),
          item('beta', 100, 115, 30),
          // Column 2 (gap >> word width)
          item('gamma', 500, 100, 40),
          item('delta', 500, 115, 35),
        ],
      },
      fullRegion,
    );
    expect(text).toBe('alpha\ngamma\nbeta\ndelta');
  });

  it('uses hasEOL to force a break for same-height items', () => {
    const text = extractTextInRegion(
      {
        items: [
          item('head', 100, 100, 30, 10, true),
          item('foot', 100, 100, 30),
        ],
      },
      fullRegion,
    );
    expect(text).toBe('head\nfoot');
  });

  it('only includes items whose center lies in the region', () => {
    const region: PageRegion = { x0: 100, y0: 100, x1: 300, y1: 200 };
    const text = extractTextInRegion(
      {
        items: [
          item('inside', 150, 150, 40),
          item('outside', 400, 150, 40),
        ],
      },
      region,
    );
    expect(text).toBe('inside');
  });

  it('skips marked-content items without text', () => {
    const text = extractTextInRegion(
      {
        items: [
          { type: 'beginMarkedContent' } as unknown as PdfTextItem,
          item('real', 100, 100, 30),
        ],
      },
      fullRegion,
    );
    expect(text).toBe('real');
  });

  it('trims trailing whitespace', () => {
    const text = extractTextInRegion(
      { items: [item('word', 100, 100, 30)] },
      fullRegion,
    );
    expect(text.endsWith('\n')).toBe(false);
    expect(text).toBe('word');
  });
});
