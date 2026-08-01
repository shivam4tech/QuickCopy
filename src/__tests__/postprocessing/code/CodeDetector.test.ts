import { describe, it, expect } from 'vitest';
import { CodeDetector } from '../../../services/postprocessing/code/CodeDetector';

const detector = new CodeDetector();

describe('CodeDetector', () => {
  it('detects C# code', () => {
    const input = 'using System;\nnamespace App {\n  public class Program {\n    static void Main() {\n      Console.WriteLine("hi");\n    }\n  }\n}\n';
    const result = detector.detect(input);
    expect(result.isCode).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(70);
  });

  it('detects Python code', () => {
    const result = detector.detect('def foo():\n    return 1\n');
    expect(result.isCode).toBe(true);
  });

  it('detects JavaScript code', () => {
    const result = detector.detect('function add(a, b) {\n  return a + b;\n}\n');
    expect(result.isCode).toBe(true);
  });

  it('detects single-line statement code', () => {
    const result = detector.detect('if (x) { y(); }');
    expect(result.isCode).toBe(true);
  });

  it('rejects plain prose', () => {
    const result = detector.detect('The quick brown fox jumps over the lazy dog.');
    expect(result.isCode).toBe(false);
  });

  it('rejects casual text with a few punctuation marks', () => {
    const result = detector.detect('Hello, how are you today? I hope it is fine.');
    expect(result.isCode).toBe(false);
  });

  it('rejects empty input', () => {
    expect(detector.detect('').isCode).toBe(false);
    expect(detector.detect('   ').isCode).toBe(false);
  });
});
