import { describe, it, expect } from 'vitest';
import { LineRecoveryStage } from '../../services/postprocessing/stages/LineRecoveryStage';
import { createTestContext } from './helpers';

const stage = new LineRecoveryStage();

describe('LineRecoveryStage', () => {
  it('recovers console.log split across lines', () => {
    const result = stage.process(createTestContext('console.\nlog("hello")'));
    expect(result.text).toContain('console.log');
  });

  it('recovers method calls split after dot', () => {
    const result = stage.process(createTestContext('foo.\nbar()'));
    expect(result.text).toContain('foo.bar()');
  });

  it('recovers import from split', () => {
    const result = stage.process(createTestContext('import React\nfrom "react"'));
    expect(result.text).toContain('from "react"');
  });

  it('recovers export default split', () => {
    const result = stage.process(createTestContext('export\ndefault function App()'));
    expect(result.text).toContain('export default');
  });

  it('recovers const declaration split', () => {
    const result = stage.process(createTestContext('const\nx = 42'));
    expect(result.text).toContain('const x');
  });

  it('recovers arrow function split', () => {
    const result = stage.process(createTestContext('x\n=> x + 1'));
    expect(result.text).toContain('x =>');
  });

  it('recovers operator split', () => {
    const result = stage.process(createTestContext('x\n== 10'));
    expect(result.text).toContain('x ==');
  });

  it('preserves intentional line breaks', () => {
    const input = 'function foo() {\n  return 1;\n}';
    const result = stage.process(createTestContext(input));
    expect(result.text).toBe(input);
  });

  it('does not merge separate code statements', () => {
    const input =
      'function add(a, b) { return a + b; }\nconst r = add(1, 2); console.log(r);';
    const result = stage.process(createTestContext(input));
    expect(result.text).toBe(input);
  });

  it('does not merge statements ending in semicolons', () => {
    const input = 'x = 1;\nfoo();';
    const result = stage.process(createTestContext(input));
    expect(result.text).toBe(input);
  });

  it('handles empty text', () => {
    const result = stage.process(createTestContext(''));
    expect(result.text).toBe('');
  });
});
