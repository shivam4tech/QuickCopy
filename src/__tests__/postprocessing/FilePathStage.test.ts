import { describe, it, expect } from 'vitest';
import { FilePathStage } from '../../services/postprocessing/stages/FilePathStage';
import { createTestContext } from './helpers';

const stage = new FilePathStage();

describe('FilePathStage', () => {
  it('fixes drive letter colon-space-backslash', () => {
    const result = stage.process(createTestContext('C: \\Users\\test'));
    expect(result.text).toBe('C:\\Users\\test');
  });

  it('fixes unix root path with space', () => {
    const result = stage.process(createTestContext('/ usr / local'));
    expect(result.text).toBe('/usr/local');
  });

  it('fixes relative path dot-slash', () => {
    const result = stage.process(createTestContext('. /src/index.ts'));
    expect(result.text).toBe('./src/index.ts');
  });

  it('fixes parent path dot-dot-slash', () => {
    const result = stage.process(createTestContext('.. /src/index.ts'));
    expect(result.text).toBe('../src/index.ts');
  });

  it('fixes home directory tilde-slash', () => {
    const result = stage.process(createTestContext('~ /projects'));
    expect(result.text).toBe('~/projects');
  });

  it('fixes unix path segment split', () => {
    const result = stage.process(createTestContext('/home /user /docs'));
    expect(result.text).toBe('/home/user/docs');
  });

  it('handles empty text', () => {
    const result = stage.process(createTestContext(''));
    expect(result.text).toBe('');
  });
});
