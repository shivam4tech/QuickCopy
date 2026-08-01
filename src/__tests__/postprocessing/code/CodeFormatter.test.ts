import { describe, it, expect } from 'vitest';
import { CodeFormatter } from '../../../services/postprocessing/code/CodeFormatter';
import type { FormattableBlock } from '../../../services/postprocessing/code/types';

const formatter = new CodeFormatter();

function block(text: string, indentChars: number, cw = 10): FormattableBlock {
  return {
    text,
    bbox: { x: 100 + indentChars * cw, y: 0, width: text.length * cw, height: 20 },
  };
}

describe('CodeFormatter', () => {
  it('leaves plain prose untouched', () => {
    const input = 'The quick brown fox jumps over the lazy dog.';
    const result = formatter.format(input);
    expect(result.changed).toBe(false);
    expect(result.text).toBe(input);
  });

  it('formats flattened C# code', () => {
    const input = 'using System;\nclass Program {\nstatic void Main() {\nConsole.WriteLine("hi");\n}\n}\n';
    const result = formatter.format(input);
    expect(result.changed).toBe(true);
    expect(result.text).toBe(
      'using System;\nclass Program {\n    static void Main() {\n        Console.WriteLine("hi");\n    }\n}\n'
    );
  });

  it('preserves compact single-line code', () => {
    const input = 'if (a) { b(); } else { c(); }';
    const result = formatter.format(input);
    expect(result.text).toBe(input);
  });

  it('strips OCR noise: stray punctuation lines and tokens glued to a brace', () => {
    const input = [
      'class Program { D',
      'static void Main() {',
      'x();',
      '}',
      '.',
    ].join('\n');
    const result = formatter.format(input);
    expect(result.text).toBe('class Program {\n    static void Main() {\n        x();\n    }');
  });

  it('keeps comment content even when it contains a brace', () => {
    const input = '// note: try { foo } here\nx();';
    const result = formatter.format(input);
    expect(result.text).toBe(input);
  });

  it('preserves OCR indentation for Python when no geometry is available', () => {
    const input = 'def foo():\nprint("a")\nif x:\nprint("b")\nelse:\nprint("c")\n';
    const result = formatter.format(input);
    expect(result.text).toBe(input);
  });

  it('preserves top-level statement lines without re-indenting', () => {
    const input = 'function add(a, b) { return a + b; }\nconst r = add(1, 2); console.log(r);';
    const result = formatter.format(input);
    expect(result.text).toBe(input);
  });

  it('formats switch/case structure', () => {
    const input = 'switch (x) { case 1: a(); break; default: b(); }';
    const result = formatter.format(input);
    expect(result.text).toBe(
      'switch (x) {\n    case 1:\n        a();\n        break;\n    default:\n        b();\n}'
    );
  });

  it('preserves a 2-space VS Code indent from geometry', () => {
    const input = 'function greet(name) {\nif (name) {\nconsole.log("hi", name);\n}\nreturn "ok";\n}';
    const blocks = [
      block('function greet(name) {', 0),
      block('if (name) {', 2),
      block('console.log("hi", name);', 4),
      block('}', 2),
      block('return "ok";', 2),
      block('}', 0),
    ];
    const result = formatter.format(input, blocks);
    expect(result.text).toBe(
      'function greet(name) {\n  if (name) {\n    console.log("hi", name);\n  }\n  return "ok";\n}'
    );
  });

  it('recovers 4-space Python indentation from geometry', () => {
    const input = 'def main():\nprint("start")\nif ok:\nprint("done")';
    const blocks = [
      block('def main():', 0),
      block('print("start")', 4),
      block('if ok:', 4),
      block('print("done")', 8),
    ];
    const result = formatter.format(input, blocks);
    expect(result.text).toBe(
      'def main():\n    print("start")\n    if ok:\n        print("done")'
    );
  });

  it('applies geometry even when OCR text lost all indentation', () => {
    const input = 'void Run() {\nif (ready) {\nstart();\n}\nstop();\n}';
    const blocks = [
      block('void Run() {', 0),
      block('if (ready) {', 2),
      block('start();', 4),
      block('}', 2),
      block('stop();', 2),
      block('}', 0),
    ];
    const result = formatter.format(input, blocks);
    expect(result.text).toBe(
      'void Run() {\n  if (ready) {\n    start();\n  }\n  stop();\n}'
    );
  });

  it('preserves already well-formatted code', () => {
    const input = 'function foo() {\n    return 1;\n}\n';
    const result = formatter.format(input);
    expect(result.text).toBe(input);
  });

  it('preserves compact function bodies and blank lines', () => {
    const input = 'void A() { x(); }\n\nvoid B() { y(); }';
    const result = formatter.format(input);
    expect(result.text).toBe(input);
  });

  it('returns truncated, low-confidence code untouched (confidence gate)', () => {
    const input = 'static int Foo() {\n    return calc(a, b';
    const result = formatter.format(input);
    expect(result.changed).toBe(false);
    expect(result.text).toBe(input);
  });

  it('keeps parens balanced on confidently-detected code', () => {
    const input = 'using System;\nclass Program {\n    static int Foo() {\n        Console.WriteLine("hi");\n        return a;\n    }\n}\n';
    const result = formatter.format(input);
    expect(result.text).toBe(
      'using System;\nclass Program {\n    static int Foo() {\n        Console.WriteLine("hi");\n        return a;\n    }\n}\n'
    );
  });

  it('does not format plain text with a code-like fragment', () => {
    const input = 'Please call us (it is important) to continue.';
    const result = formatter.format(input);
    expect(result.changed).toBe(false);
  });
});
