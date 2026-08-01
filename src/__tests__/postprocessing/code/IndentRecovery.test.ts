import { describe, it, expect } from 'vitest';
import { IndentRecovery } from '../../../services/postprocessing/code/IndentRecovery';
import type { FormattableBlock } from '../../../services/postprocessing/code/types';

const recovery = new IndentRecovery();

function block(text: string, indentChars: number, cw = 10): FormattableBlock {
  const visible = text.length;
  return {
    text,
    bbox: { x: 100 + indentChars * cw, y: 0, width: visible * cw, height: 20 },
  };
}

describe('IndentRecovery', () => {
  it('recovers a 2-space indent from x-offsets', () => {
    const lines = [
      'function greet(name) {',
      'if (name) {',
      'console.log("hi", name);',
      '}',
      'return "ok";',
      '}',
    ];
    const blocks = [
      block('function greet(name) {', 0),
      block('if (name) {', 2),
      block('console.log("hi", name);', 4),
      block('}', 2),
      block('return "ok";', 2),
      block('}', 0),
    ];
    const result = recovery.recover(lines, blocks);
    expect(result.confident).toBe(true);
    expect(result.unit).toBe(2);
    expect(result.byLine.get(0)).toBe(0);
    expect(result.byLine.get(1)).toBe(1);
    expect(result.byLine.get(2)).toBe(2);
    expect(result.byLine.get(3)).toBe(1);
    expect(result.byLine.get(5)).toBe(0);
  });

  it('recovers a 4-space Python indent', () => {
    const lines = ['def main():', 'print("start")', 'if ok:', 'print("done")'];
    const blocks = [
      block('def main():', 0),
      block('print("start")', 4),
      block('if ok:', 4),
      block('print("done")', 8),
    ];
    const result = recovery.recover(lines, blocks);
    expect(result.confident).toBe(true);
    expect(result.unit).toBe(4);
    expect(result.byLine.get(1)).toBe(1);
    expect(result.byLine.get(3)).toBe(2);
  });

  it('is not confident when too few blocks are present', () => {
    const lines = ['a();', 'b();', 'c();'];
    const result = recovery.recover(lines, [block('a();', 0), block('b();', 0)]);
    expect(result.confident).toBe(false);
  });

  it('returns an empty map when blocks are missing', () => {
    const result = recovery.recover(['a();'], []);
    expect(result.confident).toBe(false);
    expect(result.byLine.size).toBe(0);
  });

  it('handles tab-like indents as a multiple of the unit', () => {
    const lines = ['if (a) {', 'x();', 'y();', '}'];
    const blocks = [
      block('if (a) {', 0),
      block('x();', 4),
      block('y();', 4),
      block('}', 0),
    ];
    const result = recovery.recover(lines, blocks);
    expect(result.confident).toBe(true);
    expect(result.unit).toBe(4);
    expect(result.byLine.get(0)).toBe(0);
    expect(result.byLine.get(1)).toBe(1);
    expect(result.byLine.get(2)).toBe(1);
    expect(result.byLine.get(3)).toBe(0);
  });

  it('recovers indentation across blank lines and deep nesting', () => {
    const lines = [
      'function process(items) {',
      '',
      'const out = [];',
      '',
      'for (const item of items) {',
      'console.log("handling", item);',
      'out.push(process(item));',
      '}',
      '',
      'return out;',
      '}',
    ];
    const blocks = [
      block('function process(items) {', 0, 10),
      block('const out = [];', 2, 10),
      block('for (const item of items) {', 2, 10),
      block('console.log("handling", item);', 4, 10),
      block('out.push(process(item));', 4, 10),
      block('}', 2, 10),
      block('return out;', 2, 10),
      block('}', 0, 10),
    ];
    const result = recovery.recover(lines, blocks);
    expect(result.confident).toBe(true);
    expect(result.unit).toBe(2);
    expect(result.byLine.get(0)).toBe(0);
    expect(result.byLine.get(2)).toBe(1);
    expect(result.byLine.get(4)).toBe(1);
    expect(result.byLine.get(5)).toBe(2);
    expect(result.byLine.get(6)).toBe(2);
    expect(result.byLine.get(7)).toBe(1);
    expect(result.byLine.get(9)).toBe(1);
    expect(result.byLine.get(10)).toBe(0);
  });

  it('ignores stray left-aligned blocks when finding the base column', () => {
    const lines = ['function a() {', 'x();', '}'];
    const blocks = [
      block('function a() {', 0),
      block('x();', 2),
      block('}', 0),
    ];
    const result = recovery.recover(lines, blocks);
    expect(result.confident).toBe(true);
    expect(result.unit).toBe(2);
    expect(result.byLine.get(0)).toBe(0);
    expect(result.byLine.get(1)).toBe(1);
    expect(result.byLine.get(2)).toBe(0);
  });

  it('recovers the unit via level spacing when char-width noise collapses the gcd', () => {
    const lines = ['void A() {', 'x();', 'y();', 'z();', '}'];
    // Char width ~11.9 instead of 10 makes the 4/8-space offsets round to
    // [3, 7]; gcd is 1 but the spacing between levels is still 4.
    const cw = 11.9;
    const mk = (t: string, cols: number): FormattableBlock => ({
      text: t,
      bbox: { x: 100 + cols * 10, y: 0, width: t.replace(/\s/g, '').length * cw, height: 20 },
    });
    const blocks = [
      mk('void A() {', 0),
      mk('x();', 4),
      mk('y();', 8),
      mk('z();', 8),
      mk('}', 0),
    ];
    const result = recovery.recover(lines, blocks);
    expect(result.confident).toBe(true);
    expect(result.unit).toBe(4);
    expect(result.byLine.get(1)).toBe(1);
    expect(result.byLine.get(2)).toBe(2);
    expect(result.byLine.get(3)).toBe(2);
  });
});
