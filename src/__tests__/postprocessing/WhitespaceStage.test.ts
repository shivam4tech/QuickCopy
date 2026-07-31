import { describe, it, expect } from 'vitest';
import { WhitespaceStage } from '../../services/postprocessing/stages/WhitespaceStage';
import { createTestContext } from './helpers';

const stage = new WhitespaceStage();

describe('WhitespaceStage', () => {
  it('removes trailing whitespace', () => {
    const result = stage.process(createTestContext('hello   \nworld\t  \nfoo'));
    expect(result.text).toBe('hello\nworld\nfoo');
  });

  it('collapses 3+ blank lines to 2', () => {
    const result = stage.process(createTestContext('a\n\n\n\n\nb'));
    expect(result.text).toBe('a\n\nb');
  });

  it('removes leading blank lines', () => {
    const result = stage.process(createTestContext('\n\n\ncontent'));
    expect(result.text).toBe('content');
  });

  it('preserves indentation', () => {
    const result = stage.process(createTestContext('def foo():\n    return 1\n'));
    expect(result.text).toBe('def foo():\n    return 1\n');
  });

  it('does not collapse indentation spaces', () => {
    const result = stage.process(createTestContext('  function() {\n    return x;\n  }'));
    expect(result.text).toBe('  function() {\n    return x;\n  }');
  });

  it('collapses double spaces in running text', () => {
    const result = stage.process(createTestContext('hello  world  foo  bar'));
    expect(result.text).toBe('hello world foo bar');
  });

  it('handles empty text', () => {
    const result = stage.process(createTestContext(''));
    expect(result.text).toBe('');
  });
});
