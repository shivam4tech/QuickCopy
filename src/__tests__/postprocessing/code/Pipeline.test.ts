import { describe, it, expect } from 'vitest';
import { Pipeline, createContext } from '../../../services/postprocessing/Pipeline';
import type { PostProcessingSettings } from '../../../services/postprocessing/types';

const settings: PostProcessingSettings = {
  enabled: true,
  smartCleanup: true,
  programmingCleanup: true,
  markdownCleanup: true,
  terminalCleanup: true,
  debugMode: false,
  confidenceThreshold: 60,
};

describe('Pipeline with CodeFormattingStage', () => {
  it('preserves compact code through the full pipeline', () => {
    const pipeline = new Pipeline(settings);
    const ctx = createContext(
      'function add(a, b) { return a + b; }\nconst r = add(1, 2); console.log(r);',
      85,
      [],
      settings,
    );
    const result = pipeline.process(ctx);
    expect(result.text).toBe(
      'function add(a, b) { return a + b; }\nconst r = add(1, 2); console.log(r);\n'
    );
  });

  it('leaves prose untouched through the full pipeline', () => {
    const pipeline = new Pipeline(settings);
    const text = 'The quick brown fox jumps over the lazy dog.';
    const ctx = createContext(text, 90, [], settings);
    const result = pipeline.process(ctx);
    expect(result.text).toBe(text + '\n');
  });

  it('skips formatting when programmingCleanup is disabled', () => {
    const pipeline = new Pipeline({ ...settings, programmingCleanup: false });
    const ctx = createContext(
      'function add(a, b) { return a + b; }\nconst r = add(1, 2); console.log(r);',
      85,
      [],
      settings,
    );
    const result = pipeline.process(ctx);
    expect(result.text).not.toContain('function add(a, b) {\n    return a + b;');
  });
});
