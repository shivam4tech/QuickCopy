import { describe, it, expect } from 'vitest';
import { applyAppendNewline } from '../../services/ClipboardService';

describe('applyAppendNewline', () => {
  describe('append = true', () => {
    it('adds a newline to plain text', () => {
      expect(applyAppendNewline('hello', true)).toBe('hello\n');
    });

    it('keeps an existing single newline', () => {
      expect(applyAppendNewline('hello\n', true)).toBe('hello\n');
    });

    it('collapses multiple trailing newlines to exactly one', () => {
      expect(applyAppendNewline('hello\n\n\n', true)).toBe('hello\n');
    });

    it('strips trailing spaces/tabs before the newline', () => {
      expect(applyAppendNewline('hello   ', true)).toBe('hello\n');
      expect(applyAppendNewline('hello \t\n', true)).toBe('hello\n');
    });

    it('preserves internal newlines', () => {
      expect(applyAppendNewline('a\nb\n', true)).toBe('a\nb\n');
    });

    it('leaves empty text alone', () => {
      expect(applyAppendNewline('', true)).toBe('');
      expect(applyAppendNewline('   \n', true)).toBe('');
    });
  });

  describe('append = false', () => {
    it('copies plain text verbatim', () => {
      expect(applyAppendNewline('hello', false)).toBe('hello');
    });

    it('strips a trailing newline', () => {
      expect(applyAppendNewline('hello\n', false)).toBe('hello');
    });

    it('strips trailing whitespace', () => {
      expect(applyAppendNewline('hello  \n\t', false)).toBe('hello');
    });

    it('preserves internal newlines', () => {
      expect(applyAppendNewline('a\nb\n', false)).toBe('a\nb');
    });

    it('leaves empty text alone', () => {
      expect(applyAppendNewline('', false)).toBe('');
      expect(applyAppendNewline(' \t', false)).toBe('');
    });
  });
});
