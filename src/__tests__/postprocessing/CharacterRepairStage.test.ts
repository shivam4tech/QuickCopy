import { describe, it, expect } from 'vitest';
import { CharacterRepairStage } from '../../services/postprocessing/stages/CharacterRepairStage';
import { createTestContext } from './helpers';

const stage = new CharacterRepairStage();

describe('CharacterRepairStage', () => {
  it('fixes O to 0 in hex values', () => {
    const result = stage.process(createTestContext('0xFF', 'code'));
    expect(result.text).toBe('0xFF');
    const result2 = stage.process(createTestContext('0xFO', 'code'));
    expect(result2.text).toBe('0xF0');
    const result3 = stage.process(createTestContext('0x1A', 'code'));
    expect(result3.text).toBe('0x1A');
  });

  it('fixes HTTP 200 status code', () => {
    const result = stage.process(createTestContext('20O OK', 'code'));
    expect(result.text).toBe('200 OK');
  });

  it('fixes HTTP 404 status code', () => {
    const result = stage.process(createTestContext('4O4 Not Found', 'code'));
    expect(result.text).toBe('404 Not Found');
  });

  it('fixes HTTP 500 status code', () => {
    const result = stage.process(createTestContext('5O0 Server Error', 'code'));
    expect(result.text).toBe('500 Server Error');
  });

  it('fixes O to 0 in numbers', () => {
    const result = stage.process(createTestContext('value is 1O23', 'code'));
    expect(result.text).toBe('value is 1023');
  });

  it('fixes URL colon-space-slash', () => {
    const result = stage.process(createTestContext('https: //example.com'));
    expect(result.text).toBe('https://example.com');
  });

  it('fixes email @ with spaces', () => {
    const result = stage.process(createTestContext('mail @ example.com'));
    expect(result.text).toBe('mail@example.com');
  });

  it('fixes arrow equals', () => {
    const result = stage.process(createTestContext('const add = (a, b) = > a + b', 'code'));
    expect(result.text).toBe('const add = (a, b) => a + b');
  });

  it('fixes console. method spacing', () => {
    const result = stage.process(createTestContext('console . log', 'code'));
    expect(result.text).toBe('console.log');
  });

  it('fixes not-equal spacing', () => {
    const result = stage.process(createTestContext('x ! = y', 'code'));
    expect(result.text).toBe('x != y');
  });

  it('fixes strict-equal spacing', () => {
    const result = stage.process(createTestContext('x = = = y', 'code'));
    expect(result.text).toBe('x === y');
  });

  it('fixes less-equal spacing', () => {
    const result = stage.process(createTestContext('x < = 10', 'code'));
    expect(result.text).toBe('x <= 10');
  });

  it('fixes greater-equal spacing', () => {
    const result = stage.process(createTestContext('x > = 10', 'code'));
    expect(result.text).toBe('x >= 10');
  });

  it('fixes AND operator spacing', () => {
    const result = stage.process(createTestContext('x & & y', 'code'));
    expect(result.text).toBe('x && y');
  });

  it('does not repair in plaintext context', () => {
    const result = stage.process(createTestContext('= > plaintext arrow', 'plaintext'));
    expect(result.text).toBe('= > plaintext arrow');
  });

  it('handles empty text', () => {
    const result = stage.process(createTestContext(''));
    expect(result.text).toBe('');
  });
});
