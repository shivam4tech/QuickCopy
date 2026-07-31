import { describe, it, expect } from 'vitest';
import { UrlEmailStage } from '../../services/postprocessing/stages/UrlEmailStage';
import { createTestContext } from './helpers';

const stage = new UrlEmailStage();

describe('UrlEmailStage', () => {
  it('fixes https with space after colon', () => {
    const result = stage.process(createTestContext('https: //example.com'));
    expect(result.text).toBe('https://example.com');
  });

  it('fixes www with space after dot', () => {
    const result = stage.process(createTestContext('www. example.com'));
    expect(result.text).toBe('www.example.com');
  });

  it('fixes domain dot-space', () => {
    const result = stage.process(createTestContext('example. com'));
    expect(result.text).toBe('example.com');
  });

  it('fixes email @ with space', () => {
    const result = stage.process(createTestContext('user@ example.com'));
    expect(result.text).toBe('user@example.com');
  });

  it('fixes email dot-space in local part', () => {
    const result = stage.process(createTestContext('first. last@example.com'));
    expect(result.text).toBe('first.last@example.com');
  });

  it('handles empty text', () => {
    const result = stage.process(createTestContext(''));
    expect(result.text).toBe('');
  });
});
