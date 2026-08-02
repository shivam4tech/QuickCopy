import { describe, it, expect } from 'vitest';
import { braceRecovery } from '../../../../services/postprocessing/code/BraceRecovery';
import type { FormattableBlock } from '../../../../services/postprocessing/code/types';

const LINE_H = 28;

function block(text: string, x: number, y: number, width: number, height = LINE_H): FormattableBlock {
  return { text, bbox: { x, y, width, height } };
}

function row(y: number): number {
  return y * LINE_H;
}

describe('BraceRecovery', () => {
  it('splits a header whose standalone `{` was merged onto it (tall detection box)', () => {
    const text = [
      'object data = "Hello";',
      'if (data is string message) {',
      '    Console.WriteLine(message);',
      '}',
    ].join('\n');
    const blocks: FormattableBlock[] = [
      block('object data = "Hello";', 0, row(0), 400),
      // merged two rows => ~2x line height, text ends with `{`
      block('if (data is string message) {', 0, row(1), 500, LINE_H * 2),
      block('    Console.WriteLine(message);', 60, row(2), 500),
      block('}', 0, row(3), 30),
    ];
    const { text: out, changed } = braceRecovery.recover(text, blocks);
    expect(changed).toBe(true);
    expect(out).toContain('if (data is string message)');
    expect(out).toContain('{');
    const lines = out.split('\n');
    expect(lines[1]).toBe('if (data is string message)');
    expect(lines[2]).toBe('{');
  });

  it('recovers a lone `{` misread as `4` below a header at the same left margin', () => {
    const text = [
      'switch (data)',
      '4',
      'case int number: Console.WriteLine(n);',
      '    break;',
      '}',
    ].join('\n');
    const blocks: FormattableBlock[] = [
      block('switch (data)', 0, row(0), 300),
      block('4', 0, row(1), 24), // narrow single glyph at column 0
      block('case int number: Console.WriteLine(n);', 0, row(2), 700),
      block('    break;', 60, row(3), 180),
      block('}', 0, row(4), 30),
    ];
    const { text: out, changed } = braceRecovery.recover(text, blocks);
    expect(changed).toBe(true);
    const lines = out.split('\n');
    expect(lines[1]).toBe('{');
  });

  it('does NOT touch a K&R brace that shares the header line (normal height)', () => {
    const text = 'if (x) {\n    y();\n}';
    const blocks: FormattableBlock[] = [
      block('if (x) {', 0, row(0), 300, LINE_H),
      block('    y();', 60, row(1), 180),
      block('}', 0, row(2), 30),
    ];
    const { text: out, changed } = braceRecovery.recover(text, blocks);
    expect(changed).toBe(false);
    expect(out).toBe(text);
  });

  it('leaves a real standalone `{` line alone', () => {
    const text = 'if (x)\n{\n    y();\n}';
    const blocks: FormattableBlock[] = [
      block('if (x)', 0, row(0), 200),
      block('{', 0, row(1), 24),
      block('    y();', 60, row(2), 180),
      block('}', 0, row(3), 30),
    ];
    const { text: out, changed } = braceRecovery.recover(text, blocks);
    expect(changed).toBe(false);
    expect(out).toBe(text);
  });

  it('does NOT convert a suspicious glyph when it is not below a header', () => {
    const text = ['const int answer = 42;', '4', 'return;'].join('\n');
    const blocks: FormattableBlock[] = [
      block('const int answer = 42;', 0, row(0), 400),
      block('4', 0, row(1), 24),
      block('return;', 0, row(2), 160),
    ];
    const { text: out, changed } = braceRecovery.recover(text, blocks);
    expect(changed).toBe(false);
    expect(out).toBe(text);
  });

  it('does NOT convert a suspicious glyph at a different left margin', () => {
    const text = ['switch (x)', '    4', 'case 1: break;'].join('\n');
    const blocks: FormattableBlock[] = [
      block('switch (x)', 0, row(0), 240),
      block('4', 60, row(1), 24), // indented, not aligned with header
      block('case 1: break;', 0, row(2), 260),
    ];
    const { text: out, changed } = braceRecovery.recover(text, blocks);
    expect(changed).toBe(false);
    expect(out).toBe(text);
  });

  it('returns unchanged when geometry is missing', () => {
    const text = 'if (x)\n4\n{';
    const { text: out, changed } = braceRecovery.recover(text, []);
    expect(changed).toBe(false);
    expect(out).toBe(text);
  });
});
