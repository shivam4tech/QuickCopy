import { describe, it, expect } from 'vitest';
import { NormalizeStage } from '../../services/postprocessing/stages/NormalizeStage';
import { createTestContext } from './helpers';

const stage = new NormalizeStage();

describe('NormalizeStage', () => {
  it('converts CRLF to LF', () => {
    const result = stage.process(createTestContext('line1\r\nline2\r\nline3'));
    expect(result.text).toBe('line1\nline2\nline3');
  });

  it('converts CR to LF', () => {
    const result = stage.process(createTestContext('line1\ritem2'));
    expect(result.text).toBe('line1\nitem2');
  });

  it('removes null bytes', () => {
    const result = stage.process(createTestContext('hello\0world'));
    expect(result.text).toBe('helloworld');
  });

  it('removes BOM', () => {
    const result = stage.process(createTestContext('\uFEFFcontent'));
    expect(result.text).toBe('content');
  });

  it('normalizes curly quotes to straight', () => {
    const result = stage.process(createTestContext('\u2018hello\u2019 \u201Cworld\u201D'));
    expect(result.text).toBe("'hello' \"world\"");
  });

  it('normalizes dashes', () => {
    const result = stage.process(createTestContext('\u2013 \u2014'));
    expect(result.text).toBe('- -');
  });

  it('handles empty text', () => {
    const result = stage.process(createTestContext(''));
    expect(result.text).toBe('');
  });

  it('preserves already-normal text', () => {
    const result = stage.process(createTestContext('Hello World\nThis is fine.'));
    expect(result.text).toBe('Hello World\nThis is fine.');
  });
});
