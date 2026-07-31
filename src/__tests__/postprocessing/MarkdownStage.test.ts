import { describe, it, expect } from 'vitest';
import { MarkdownStage } from '../../services/postprocessing/stages/MarkdownStage';
import { createTestContext } from './helpers';

const stage = new MarkdownStage();

describe('MarkdownStage', () => {
  it('fixes header formatting', () => {
    const result = stage.process(createTestContext('#Title\n##Subtitle', 'markdown'));
    expect(result.text).toBe('# Title\n## Subtitle');
  });

  it('preserves code fences', () => {
    const result = stage.process(createTestContext('```typescript\nconst x = 1;\n```', 'markdown'));
    expect(result.text).toContain('```typescript\n');
  });

  it('fixes list item markers', () => {
    const result = stage.process(createTestContext('-item 1\n*item 2', 'markdown'));
    expect(result.text).toBe('- item 1\n- item 2');
  });

  it('fixes numbered list spacing', () => {
    const result = stage.process(createTestContext('1.First\n2.Second', 'markdown'));
    expect(result.text).toBe('1. First\n1. Second');
  });

  it('fixes link formatting', () => {
    const result = stage.process(createTestContext('[text] (url)', 'markdown'));
    expect(result.text).toBe('[text](url)');
  });

  it('does not process plaintext', () => {
    const result = stage.process(createTestContext('#Not a header', 'plaintext'));
    expect(result.text).toBe('#Not a header');
  });

  it('handles empty text', () => {
    const result = stage.process(createTestContext('', 'markdown'));
    expect(result.text).toBe('');
  });
});
