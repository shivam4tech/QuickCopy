import { describe, it, expect } from 'vitest';
import { LanguageDetector } from '../../../services/postprocessing/code/LanguageDetector';

const detector = new LanguageDetector();

describe('LanguageDetector', () => {
  it('detects Python', () => {
    expect(detector.detect('def foo():\n    print("hi")\n    return True\n')).toBe('python');
  });

  it('detects C#', () => {
    expect(detector.detect('using System;\nnamespace App {\nclass P {\nstatic void Main() {\nConsole.WriteLine("x");\n}\n}\n}\n')).toBe('csharp');
  });

  it('detects C# class + static void Main without public', () => {
    expect(
      detector.detect(
        'class Program {\nstatic void Main(string[] args) {\nConsole.ReadKey();\n}\n}\n'
      )
    ).toBe('csharp');
  });

  it('does not mistake a brace-style class for Python', () => {
    expect(
      detector.detect(
        'class Program {\nstatic void Main() {\nint x = 1;\n}\n}\n'
      )
    ).not.toBe('python');
  });

  it('detects Java', () => {
    expect(detector.detect('public class App {\n  public static void main(String[] args) {\n    System.out.println("x");\n  }\n}\n')).toBe('java');
  });

  it('detects Rust', () => {
    expect(detector.detect('fn main() {\n    let x = 42;\n    println!("{}", x);\n}\n')).toBe('rust');
  });

  it('detects Go', () => {
    expect(detector.detect('func main() {\n    fmt.Println("hi")\n}\n')).toBe('go');
  });

  it('detects TypeScript', () => {
    expect(detector.detect('const x: number = 1;\ninterface Foo {\n  bar: string;\n}\n')).toBe('typescript');
  });

  it('returns unknown for plain text', () => {
    expect(detector.detect('The quick brown fox jumps over the lazy dog.')).toBe('unknown');
  });
});
