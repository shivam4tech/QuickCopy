import { describe, it, expect } from 'vitest';
import { ContentDetector } from '../../services/postprocessing/ContentDetector';

const detector = new ContentDetector();

describe('ContentDetector', () => {
  describe('detectContentType', () => {
    it('detects code', () => {
      const result = detector.detectContentType('function hello() {\n  return 1;\n}');
      expect(result).toBe('code');
    });

    it('detects terminal output', () => {
      const result = detector.detectContentType('$ npm run build\n> building...\n');
      expect(result).toBe('terminal');
    });

    it('detects markdown', () => {
      const result = detector.detectContentType('# Title\n\n## Subtitle\n\n- item 1\n- item 2');
      expect(result).toBe('markdown');
    });

    it('detects JSON', () => {
      const result = detector.detectContentType('{\n  "name": "test",\n  "version": "1.0.0"\n}');
      expect(result).toBe('json');
    });

    it('detects stacktrace', () => {
      const result = detector.detectContentType('Error: something broke\n  at Object.<anonymous> (/src/index.ts:10:5)');
      expect(result).toBe('stacktrace');
    });

    it('detects log output', () => {
      const result = detector.detectContentType('2024-01-15T10:30:00 [INFO] Server started');
      expect(result).toBe('log');
    });

    it('returns plaintext for casual text', () => {
      const result = detector.detectContentType('Hello, how are you today?');
      expect(result).toBe('plaintext');
    });

    it('detects yaml by --- header', () => {
      const result = detector.detectContentType('---\nname: test\nversion: 1.0\n');
      expect(result).toBe('yaml');
    });
  });

  describe('detectLanguage', () => {
    it('detects Python', () => {
      const result = detector.detectLanguage('def hello():\n    print("world")\n    return True');
      expect(result).toBe('python');
    });

    it('detects TypeScript', () => {
      const result = detector.detectLanguage('const x: number = 42;\ninterface Foo {\n  bar: string;\n}');
      expect(result).toBe('typescript');
    });

    it('detects Rust', () => {
      const result = detector.detectLanguage('fn main() {\n    let x = 42;\n    println!("{}", x);\n}');
      expect(result).toBe('rust');
    });

    it('detects Go', () => {
      const result = detector.detectLanguage('func main() {\n    fmt.Println("hello")\n}');
      expect(result).toBe('go');
    });

    it('detects SQL', () => {
      const result = detector.detectLanguage('SELECT * FROM users WHERE id = 1');
      expect(result).toBe('sql');
    });

    it('detects shell', () => {
      const result = detector.detectLanguage('$ sudo apt install nodejs');
      expect(result).toBe('shell');
    });

    it('returns unknown for plain text', () => {
      const result = detector.detectLanguage('The quick brown fox jumps over the lazy dog.');
      expect(result).toBe('unknown');
    });
  });
});
