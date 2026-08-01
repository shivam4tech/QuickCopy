import { describe, it, expect } from 'vitest';
import { LineReconstructor } from '../../../services/postprocessing/code/LineReconstructor';

const recon = new LineReconstructor();

describe('LineReconstructor', () => {
  it('preserves compact single-line statements', () => {
    const input = 'public void Foo() { int x = 1; int y = 2; }';
    expect(recon.reconstruct(input, 'csharp')).toBe(input);
  });

  it('preserves compact if/else blocks', () => {
    const input = 'if (a) { b(); } else { c(); }';
    expect(recon.reconstruct(input, 'javascript')).toBe(input);
  });

  it('splits merged switch case blocks', () => {
    const input = 'switch (x) { case 1: a(); break; case 2: b(); break; default: c(); }';
    expect(recon.reconstruct(input, 'csharp')).toBe(
      'switch (x) {\ncase 1:\na();\nbreak;\ncase 2:\nb();\nbreak;\ndefault:\nc();\n}'
    );
  });

  it('does not split template literal expressions', () => {
    const input = 'const tpl = `${name}!`; foo();';
    expect(recon.reconstruct(input, 'javascript')).toBe(input);
  });

  it('does not split ternary colons', () => {
    const input = 'const x = a ? b : c; foo();';
    expect(recon.reconstruct(input, 'javascript')).toBe(input);
  });

  it('does not split object literals onto their own lines', () => {
    const input = 'const obj = { a: 1, b: 2 }; foo();';
    expect(recon.reconstruct(input, 'javascript')).toBe(input);
  });

  it('does not split inside strings', () => {
    const input = 'const s = "a;b;c"; foo();';
    expect(recon.reconstruct(input, 'javascript')).toBe(input);
  });

  it('does not split for-loop semicolons inside parens', () => {
    const input = 'for (i = 0; i < n; i++) { x(); }';
    expect(recon.reconstruct(input, 'javascript')).toBe(input);
  });

  it('splits python merged lines', () => {
    const input = 'a = 1; b = 2';
    expect(recon.reconstruct(input, 'python')).toBe('a = 1;\nb = 2');
  });

  it('de-indents already-formatted lines (indentation is rebuilt later)', () => {
    const input = 'function foo() {\n  return 1;\n}';
    expect(recon.reconstruct(input, 'javascript')).toBe('function foo() {\nreturn 1;\n}');
  });

  it('keeps comment content intact', () => {
    const input = '// note: a; b; c\nfoo();';
    expect(recon.reconstruct(input, 'javascript')).toBe('// note: a; b; c\nfoo();');
  });

  it('preserves blank lines', () => {
    const input = 'a();\n\nb();';
    expect(recon.reconstruct(input, 'javascript')).toBe('a();\n\nb();');
  });
});
