import type { CodeLanguage } from './types';

export class PunctuationCorrector {
  correct(text: string, language: CodeLanguage): string {
    if (!text) return text;
    if (language === 'python') return text;

    return this.replaceOutsideStrings(text, (code) =>
      code.replace(/\b(\w+)\s+II\s+(\w+)\b/g, '$1 || $2')
    );
  }

  private replaceOutsideStrings(text: string, fn: (segment: string) => string): string {
    let result = '';
    let buf = '';
    let inString: string | null = null;
    let escaped = false;

    const flush = (): void => {
      if (buf) {
        result += fn(buf);
        buf = '';
      }
    };

    for (const ch of text) {
      if (inString) {
        result += ch;
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === inString) {
          inString = null;
        }
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        flush();
        result += ch;
        inString = ch;
        continue;
      }
      buf += ch;
    }
    flush();

    return result;
  }
}

export const punctuationCorrector = new PunctuationCorrector();
