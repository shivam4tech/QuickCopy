import { describe, it, expect } from 'vitest';
import { WhitespaceNormalizer } from '../../../services/postprocessing/code/WhitespaceNormalizer';

const normalizer = new WhitespaceNormalizer();

describe('WhitespaceNormalizer', () => {
  it('trims trailing whitespace and preserves empty lines', () => {
    const input = 'line1  \nline2\t\n\n\nline3\n';
    expect(normalizer.normalize(input)).toBe('line1\nline2\n\nline3\n');
  });

  it('drops leading blank lines', () => {
    expect(normalizer.normalize('\n\ncontent')).toBe('content');
  });

  it('detects 4-space indentation from nested lines', () => {
    const lines = ['def foo():', '    x = 1', '    return x'];
    const style = normalizer.detectIndentStyle(lines);
    expect(style.unit).toBe(4);
    expect(style.useTabs).toBe(false);
  });

  it('detects 2-space indentation from flat bodies', () => {
    const lines = ['if (a) {', '  x();', '  y();', '}'];
    const style = normalizer.detectIndentStyle(lines);
    expect(style.unit).toBe(2);
  });

  it('detects tab indentation', () => {
    const lines = ['if (a) {', '\t\tx();', '\ty();', '}'];
    const style = normalizer.detectIndentStyle(lines);
    expect(style.useTabs).toBe(true);
  });

  it('falls back to 4 when no indentation is present', () => {
    const style = normalizer.detectIndentStyle(['a();', 'b();']);
    expect(style.unit).toBe(4);
  });
});
