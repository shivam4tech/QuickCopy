import { describe, it, expect } from 'vitest';
import { scoreOcrQuality, indentLevelsInText, distinctXLevels, meanConfidence } from '../../../../services/ocr/quality/QualityScorer';

function block(text: string, confidence: number, x?: number, width?: number, height = 18) {
  return {
    text,
    confidence,
    bbox: x !== undefined ? { x, y: 0, width: width ?? 100, height } : null,
  };
}

describe('scoreOcrQuality', () => {
  it('accepts a clean, confident, well-formed result', () => {
    const blocks = [
      block('class Program {', 95, 0),
      block('  static void Main() {', 94, 20),
      block('    x();', 96, 40),
      block('  }', 97, 20),
      block('}', 96, 0),
    ];
    const r = scoreOcrQuality({ text: 'class Program {\n  static void Main() {\n    x();\n  }\n}\n', confidence: 95, blocks });
    expect(r.retry).toBe(false);
    expect(r.overall).toBeGreaterThanOrEqual(80);
    expect(r.flags).toHaveLength(0);
  });

  it('does NOT retry on slightly-low confidence alone', () => {
    const blocks = [block('Some paragraph text that is fine.', 52, 0)];
    const r = scoreOcrQuality({ text: 'Some paragraph text that is fine.\nAnother line here.\nAnd one more.', confidence: 52, blocks });
    expect(r.flags).toContain('low-confidence');
    expect(r.retry).toBe(false);
  });

  it('retries when multiple signals indicate failure', () => {
    const blocks = [
      block('class Program {', 48, 0),
      block('static void Main( {', 50, 20),
      block('x()', 46, 40),
      block('}{', 45, 20),
    ];
    const r = scoreOcrQuality({
      text: 'class Program {\nstatic void Main( {\nx()\n}{\n',
      confidence: 47,
      blocks,
    });
    expect(r.retry).toBe(true);
    expect(r.retryReason).toBeTruthy();
  });

  it('flags merged lines from geometry', () => {
    const r = scoreOcrQuality({
      text: 'class Program {\n  x();\n}\n',
      confidence: 90,
      blocks: [
        // two OCR lines collapsed into one block => merged
        block('class Program {\n  x();', 90, 0, 100, 18),
        block('}', 91, 0, 10, 18),
      ],
    });
    expect(r.flags).toContain('merged-lines');
  });

  it('flags lost indentation when text has more levels than geometry', () => {
    const r = scoreOcrQuality({
      text: 'a\n    b\n        c\n    d\n',
      confidence: 90,
      blocks: [block('a', 90, 0, 10), block('b', 90, 0, 10), block('c', 90, 0, 10), block('d', 90, 0, 10)],
    });
    expect(r.flags).toContain('lost-indentation');
  });
});

describe('helpers', () => {
  it('indentLevelsInText counts distinct leading-whitespace levels', () => {
    expect(indentLevelsInText('a\n    b\n        c\n')).toBe(3);
    expect(indentLevelsInText('plain\nplain2\n')).toBe(1);
  });

  it('distinctXLevels buckets bbox.x values with tolerance', () => {
    const blocks = [block('a', 90, 0), block('b', 90, 2), block('c', 90, 41)];
    expect(distinctXLevels(blocks)).toBe(2);
  });

  it('meanConfidence falls back when blocks are empty', () => {
    expect(meanConfidence([], 42)).toBe(42);
    expect(meanConfidence([block('a', 80, 0), block('b', 60, 0)], 0)).toBe(70);
  });
});
