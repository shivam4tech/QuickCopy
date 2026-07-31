import { describe, it, expect } from 'vitest';
import { TerminalStage } from '../../services/postprocessing/stages/TerminalStage';
import { createTestContext } from './helpers';

const stage = new TerminalStage();

describe('TerminalStage', () => {
  it('normalizes dollar prompt', () => {
    const result = stage.process(createTestContext('$npm install', 'terminal'));
    expect(result.text).toBe('$ npm install');
  });

  it('preserves already-spaced prompt', () => {
    const result = stage.process(createTestContext('$ npm install', 'terminal'));
    expect(result.text).toBe('$ npm install');
  });

  it('does not process plaintext', () => {
    const result = stage.process(createTestContext('$test', 'plaintext'));
    expect(result.text).toBe('$test');
  });

  it('processes stacktrace type', () => {
    const result = stage.process(createTestContext('$ npm test', 'stacktrace'));
    expect(result.text).toBe('$ npm test');
  });

  it('processes log type', () => {
    const result = stage.process(createTestContext('$ deploy', 'log'));
    expect(result.text).toBe('$ deploy');
  });

  it('handles empty text', () => {
    const result = stage.process(createTestContext('', 'terminal'));
    expect(result.text).toBe('');
  });
});
