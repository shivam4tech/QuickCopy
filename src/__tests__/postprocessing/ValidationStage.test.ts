import { describe, it, expect } from 'vitest';
import { ValidationStage } from '../../services/postprocessing/stages/ValidationStage';
import { createTestContext } from './helpers';

const stage = new ValidationStage();

describe('ValidationStage', () => {
  it('adds trailing newline', () => {
    const result = stage.process(createTestContext('hello'));
    expect(result.text).toBe('hello\n');
  });

  it('trims trailing whitespace', () => {
    const result = stage.process(createTestContext('hello   \n'));
    expect(result.text).toBe('hello\n');
  });

  it('calculates quality score', () => {
    const result = stage.process(createTestContext('good text\n'));
    expect(result.qualityScore).not.toBeNull();
    expect(result.qualityScore!.overall).toBeGreaterThan(0);
    expect(result.qualityScore!.averageConfidence).toBe(85);
  });

  it('penalizes unknown symbols', () => {
    const ctx = createTestContext('hello\u0001world\n');
    ctx.confidence = 90;
    const result = stage.process(ctx);
    expect(result.qualityScore!.unknownSymbols).toBeGreaterThan(0);
  });

  it('reports repair count', () => {
    const ctx = createTestContext('good text\n');
    ctx.repairCount = 5;
    const result = stage.process(ctx);
    expect(result.qualityScore!.repairCount).toBe(5);
  });

  it('handles empty text', () => {
    const result = stage.process(createTestContext(''));
    expect(result.text).toBe('');
  });
});
