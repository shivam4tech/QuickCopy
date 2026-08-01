import { describe, it, expect } from 'vitest';
import { IndentationEngine } from '../../../services/postprocessing/code/IndentationEngine';

const engine = new IndentationEngine();

describe('IndentationEngine', () => {
  it('indents C-like braces', () => {
    const levels = engine.computeLevels(
      ['if (a) {', 'b();', '} else {', 'c();', '}'],
      'javascript'
    );
    expect(levels).toEqual([0, 1, 0, 1, 0]);
  });

  it('handles nested blocks', () => {
    const levels = engine.computeLevels(
      ['function foo() {', 'if (x) {', 'y();', '}', '}'],
      'javascript'
    );
    expect(levels).toEqual([0, 1, 2, 1, 0]);
  });

  it('aligns closing braces with opening blocks', () => {
    const levels = engine.computeLevels(
      ['void Run() {', 'int x = 1;', 'if (x > 0) {', 'x++;', '}', 'return;', '}'],
      'csharp'
    );
    expect(levels).toEqual([0, 1, 1, 2, 1, 1, 0]);
  });

  it('handles switch case indentation', () => {
    const levels = engine.computeLevels(
      ['switch (x) {', 'case 1:', 'break;', 'case 2:', 'break;', 'default:', 'break;', '}'],
      'csharp'
    );
    expect(levels).toEqual([0, 1, 2, 1, 2, 1, 2, 0]);
  });

  it('handles brace on same line as close (in-place object)', () => {
    const levels = engine.computeLevels(
      ['const obj = { a: 1 };', 'foo();'],
      'javascript'
    );
    expect(levels).toEqual([0, 0]);
  });

  it('indents python blocks on colons', () => {
    const levels = engine.computeLevels(
      ['def foo():', 'x = 1', 'if x:', 'y = 2', 'else:', 'z = 3'],
      'python'
    );
    expect(levels).toEqual([0, 1, 1, 2, 1, 2]);
  });

  it('keeps python else at the same level as its block', () => {
    const levels = engine.computeLevels(
      ['if a:', 'x()', 'else:', 'y()'],
      'python'
    );
    expect(levels).toEqual([0, 1, 0, 1]);
  });

  it('handles python try/except/finally', () => {
    const levels = engine.computeLevels(
      ['def f():', 'try:', 'g()', 'except:', 'h()', 'finally:', 'i()'],
      'python'
    );
    expect(levels).toEqual([0, 1, 2, 1, 2, 1, 2]);
  });

  it('marks blank lines as -1', () => {
    const levels = engine.computeLevels(
      ['if (a) {', '', 'b();', '}'],
      'javascript'
    );
    expect(levels).toEqual([0, -1, 1, 0]);
  });
});
