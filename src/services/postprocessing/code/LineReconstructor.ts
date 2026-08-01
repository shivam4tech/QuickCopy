import type { CodeLanguage } from './types';

interface ReconstructState {
  braceKinds: ('block' | 'object' | 'case')[];
  inBlockComment: boolean;
}

export interface ReconstructResult {
  lines: string[];
  lineOf: number[];
  lead: string[];
}

/**
 * Preserves OCR line structure (editors render one statement per line and
 * Tesseract keeps line breaks), and only repairs the cases where OCR glues
 * clearly-separate constructs together:
 *   - `switch` case/default headers (always on their own line in editors)
 *   - statements within a case body (split on `;`)
 *   - Python `elif`/`else`/`except`/`finally` and `;` separators
 * Compact single-line code like `while (x) { count++; }` is left untouched.
 */
export class LineReconstructor {
  reconstruct(text: string, language: CodeLanguage): string {
    const result = this.reconstructLines(text.split('\n'), language);
    return result.lines.join('\n');
  }

  reconstructLines(inputLines: string[], language: CodeLanguage): ReconstructResult {
    const isPython = language === 'python';
    const state: ReconstructState = { braceKinds: [], inBlockComment: false };
    const lines: string[] = [];
    const lineOf: number[] = [];
    const lead: string[] = [];

    for (let idx = 0; idx < inputLines.length; idx++) {
      const raw = inputLines[idx]!;
      const leading = (raw.match(/^[ \t]+/)?.[0] ?? '');
      const line = raw.trim();
      if (line === '') {
        lines.push('');
        lineOf.push(idx);
        lead.push('');
        continue;
      }
      if (state.inBlockComment) {
        const endIdx = line.indexOf('*/');
        if (endIdx === -1) {
          lines.push(line);
          lineOf.push(idx);
          lead.push(leading);
          continue;
        }
        state.inBlockComment = false;
        lines.push(line);
        lineOf.push(idx);
        lead.push(leading);
        continue;
      }
      const pieces = this.splitLine(line, isPython, state);
      for (const p of pieces) {
        lines.push(p);
        lineOf.push(idx);
        lead.push(leading);
      }
    }

    return { lines, lineOf, lead };
  }

  private splitLine(line: string, isPython: boolean, state: ReconstructState): string[] {
    const pieces: string[] = [];
    let segStart = 0;
    let paren = 0;
    let bracket = 0;
    let inString: string | null = null;
    let escaped = false;
    const n = line.length;

    const push = (end: number): void => {
      const seg = line.slice(segStart, end).trim();
      if (seg) pieces.push(seg);
      segStart = end;
    };

    const insideBlock = (): boolean => state.braceKinds.includes('block');

    for (let i = 0; i < n; i++) {
      const ch = line[i]!;

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === inString) {
          inString = null;
        }
        continue;
      }

      if (ch === '/' && line[i + 1] === '/') {
        break;
      }
      if (ch === '/' && line[i + 1] === '*') {
        const end = line.indexOf('*/', i + 2);
        if (end === -1) {
          state.inBlockComment = true;
          break;
        }
        i = end + 1;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        inString = ch;
        continue;
      }

      if (isPython) {
        if (ch === ';' && paren === 0) {
          const rest = line.slice(i + 1).trim();
          if (rest) push(i + 1);
          continue;
        }
        if (paren === 0) {
          const word = this.wordAt(line, i);
          if (word === 'elif' || word === 'else' || word === 'except' || word === 'finally') {
            push(i);
            continue;
          }
        }
        continue;
      }

      if (ch === '(') {
        paren++;
        continue;
      }
      if (ch === ')') {
        paren = Math.max(0, paren - 1);
        continue;
      }
      if (ch === '[') {
        bracket++;
        continue;
      }
      if (ch === ']') {
        bracket = Math.max(0, bracket - 1);
        continue;
      }
      if (ch === '{') {
        state.braceKinds.push(this.braceKindAt(line, i));
        continue;
      }
      if (ch === '}') {
        state.braceKinds.pop();
        continue;
      }

      // Split on semicolons ONLY inside a switch-case body — a reliable sign
      // OCR glued statements that were on separate lines.
      if (ch === ';' && paren === 0 && bracket === 0 && state.braceKinds[state.braceKinds.length - 1] === 'case') {
        const rest = line.slice(i + 1).trim();
        if (rest) push(i + 1);
        continue;
      }

      if (ch === ':' && paren === 0 && bracket === 0 && insideBlock()) {
        const header = line.slice(segStart, i).trim();
        if (header && (/^case\b.*$/.test(header) || header === 'default')) {
          if (state.braceKinds[state.braceKinds.length - 1] === 'case') state.braceKinds.pop();
          state.braceKinds.push('case');
          const rest = line.slice(i + 1).trim();
          if (rest) push(i + 1);
          continue;
        }
      }

      if (paren === 0 && bracket === 0 && insideBlock()) {
        const word = this.wordAt(line, i);
        if (word === 'case' || word === 'default') {
          push(i);
          continue;
        }
      }
    }

    const tail = line.slice(segStart).trim();
    if (tail) pieces.push(tail);

    return pieces;
  }

  private braceKindAt(line: string, i: number): 'block' | 'object' {
    const prev = this.prevSignificant(line, i);
    if (
      prev === '=' || prev === '(' || prev === '[' || prev === ',' || prev === ':' ||
      prev === '?' || prev === '+' || prev === '-' || prev === '*' || prev === '/' ||
      prev === '%' || prev === '&' || prev === '|' || prev === '>' || prev === '<' ||
      prev === '!' || prev === '~' || prev === '$' || prev === 'return'
    ) {
      return 'object';
    }
    return 'block';
  }

  private wordAt(line: string, i: number): string {
    const ch = line[i];
    if (!ch || !/[A-Za-z_]/.test(ch)) return '';
    if (i > 0 && /[A-Za-z0-9_]/.test(line[i - 1]!)) return '';
    return /^[A-Za-z_]\w*/.exec(line.slice(i))?.[0] ?? '';
  }

  private prevSignificant(line: string, i: number): string {
    for (let j = i - 1; j >= 0; j--) {
      const c = line[j]!;
      if (c !== ' ' && c !== '\t') return c;
    }
    return '\0';
  }
}

export const lineReconstructor = new LineReconstructor();
