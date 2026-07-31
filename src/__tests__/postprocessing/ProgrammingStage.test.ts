import { describe, it, expect } from 'vitest';
import { ProgrammingStage } from '../../services/postprocessing/stages/ProgrammingStage';
import { createTestContext } from './helpers';

const stage = new ProgrammingStage();

describe('ProgrammingStage', () => {
  it('fixes while keyword', () => {
    const result = stage.process(createTestContext('whiIe (true) {', 'code'));
    expect(result.text).toBe('while (true) {');
  });

  it('fixes switch keyword', () => {
    const result = stage.process(createTestContext('swit ch (x) {', 'code'));
    expect(result.text).toBe('switch (x) {');
  });

  it('fixes continue keyword', () => {
    const result = stage.process(createTestContext('cont inue;', 'code'));
    expect(result.text).toBe('continue;');
  });

  it('fixes break keyword', () => {
    const result = stage.process(createTestContext('bre ak;', 'code'));
    expect(result.text).toBe('break;');
  });

  it('fixes private keyword', () => {
    const result = stage.process(createTestContext('priv ate void', 'code'));
    expect(result.text).toBe('private void');
  });

  it('fixes public keyword', () => {
    const result = stage.process(createTestContext('publ ic class', 'code'));
    expect(result.text).toBe('public class');
  });

  it('fixes null keyword', () => {
    const result = stage.process(createTestContext('return nuIl;', 'code'));
    expect(result.text).toBe('return null;');
  });

  it('fixes true keyword', () => {
    const result = stage.process(createTestContext('return tr ue;', 'code'));
    expect(result.text).toBe('return true;');
  });

  it('does not process plaintext', () => {
    const result = stage.process(createTestContext('whiIe (true)', 'plaintext'));
    expect(result.text).toBe('whiIe (true)');
  });

  it('handles empty text', () => {
    const result = stage.process(createTestContext('', 'code'));
    expect(result.text).toBe('');
  });
});
