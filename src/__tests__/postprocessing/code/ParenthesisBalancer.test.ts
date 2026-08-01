import { describe, it, expect } from 'vitest';
import { ParenthesisBalancer } from '../../../services/postprocessing/code/ParenthesisBalancer';

const balancer = new ParenthesisBalancer();

describe('ParenthesisBalancer', () => {
  it('appends a missing closing paren on the last line', () => {
    expect(balancer.repair('return calc(a, b')).toBe('return calc(a, b)');
  });

  it('appends missing closers when multiple are open', () => {
    expect(balancer.repair('return foo(bar(baz')).toBe('return foo(bar(baz))');
  });

  it('does not touch continuation lines ending in an operator', () => {
    expect(balancer.repair('return a &&\n  foo(x')).toBe('return a &&\n  foo(x)');
  });

  it('does not touch lines ending with an open paren', () => {
    expect(balancer.repair('foo(\n  x')).toBe('foo(\n  x');
  });

  it('ignores parens inside strings', () => {
    expect(balancer.repair('print("(not code")')).toBe('print("(not code")');
  });

  it('appends a single missing bracket on the last line', () => {
    expect(balancer.repair('x = arr[0')).toBe('x = arr[0]');
  });

  it('leaves balanced code untouched', () => {
    expect(balancer.repair('return calc(a, b);')).toBe('return calc(a, b);');
  });

  it('ignores balanced brackets but open paren', () => {
    expect(balancer.repair('x = y[0] + foo(a')).toBe('x = y[0] + foo(a)');
  });
});
