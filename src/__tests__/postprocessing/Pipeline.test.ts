import { describe, it, expect } from 'vitest';
import { Pipeline, createContext } from '../../services/postprocessing/Pipeline';
import type { PostProcessingSettings } from '../../services/postprocessing/types';

const SETTINGS: PostProcessingSettings = {
  enabled: true,
  smartCleanup: true,
  programmingCleanup: true,
  markdownCleanup: true,
  terminalCleanup: true,
  debugMode: false,
  confidenceThreshold: 60,
};

describe('Pipeline', () => {
  it('processes text through all stages', () => {
    const pipeline = new Pipeline(SETTINGS);
    const ctx = createContext('hello  world\n', 85, [], SETTINGS);
    const result = pipeline.process(ctx);
    expect(result.text).toBe('hello world\n');
    expect(result.repairCount).toBe(0);
  });

  it('handles code with multiple issues', () => {
    const pipeline = new Pipeline(SETTINGS);
    const code = 'function hello() {\n    console . log("world")\n    retur n 1;\n}\n';
    const ctx = createContext(code, 92, [], SETTINGS);
    const result = pipeline.process(ctx);
    expect(result.text).not.toContain('console . log');
    expect(result.text).not.toContain('retur n');
    expect(result.repairCount).toBeGreaterThan(0);
  });

  it('normalizes line endings then cleans whitespace', () => {
    const pipeline = new Pipeline(SETTINGS);
    const ctx = createContext('line1\r\nline2  \n\n\nline3\n', 90, [], SETTINGS);
    const result = pipeline.process(ctx);
    expect(result.text).toBe('line1\nline2\n\nline3\n');
  });

  it('fixes URL and then validates', () => {
    const pipeline = new Pipeline(SETTINGS);
    const ctx = createContext('Visit https: //example.com\n', 85, [], SETTINGS);
    const result = pipeline.process(ctx);
    expect(result.text).toContain('https://');
    expect(result.qualityScore).not.toBeNull();
  });

  it('debug mode records stage info', () => {
    const debugSettings = { ...SETTINGS, debugMode: true };
    const pipeline = new Pipeline(debugSettings);
    const ctx = createContext('hello\n', 90, [], debugSettings);
    const result = pipeline.process(ctx);
    expect(result.debugInfo.length).toBeGreaterThan(0);
  });
});
