import type { CodeLanguage } from './types';

type BlockKind = 'brace' | 'case' | 'python' | 'python-case';

export class IndentationEngine {
  computeLevels(lines: string[], language: CodeLanguage): number[] {
    const isPython = language === 'python';
    const stack: BlockKind[] = [];
    const levels: number[] = [];

    for (const raw of lines) {
      const line = raw.trim();
      if (line === '') {
        levels.push(-1);
        continue;
      }

      if (isPython) {
        let level = stack.length;
        if (/^(elif|else|except|finally)\b/.test(line)) {
          if (stack.length > 0 && stack[stack.length - 1] === 'python') stack.pop();
          level = stack.length;
        }
        if (/^case\b/.test(line)) {
          if (stack.length > 0 && stack[stack.length - 1] === 'python-case') stack.pop();
          level = stack.length;
        }
        levels.push(level);
        if (this.isPythonBlockHeader(line)) {
          stack.push(/^case\b/.test(line) ? 'python-case' : 'python');
        }
        continue;
      }

      const tokens = this.braceTokens(line);
      let leadingCloses = 0;
      for (const t of tokens) {
        if (t === -1) leadingCloses++;
        else break;
      }

      for (let k = 0; k < leadingCloses; k++) {
        if (stack.length > 0 && stack[stack.length - 1] === 'case') stack.pop();
        if (stack.length > 0) stack.pop();
      }

      if (this.isCaseLine(line)) {
        if (stack.length > 0 && stack[stack.length - 1] === 'case') stack.pop();
        const level = stack.length;
        levels.push(level);
        stack.push('case');
        continue;
      }

      const level = stack.length;
      levels.push(level);

      for (let k = leadingCloses; k < tokens.length; k++) {
        const t = tokens[k]!;
        if (t === 1) {
          stack.push('brace');
        } else if (stack.length > 0) {
          if (stack[stack.length - 1] === 'case') stack.pop();
          if (stack.length > 0) stack.pop();
        }
      }
    }

    return levels;
  }

  private isCaseLine(line: string): boolean {
    return /^(case\b|default\s*:)/.test(line);
  }

  private isPythonBlockHeader(line: string): boolean {
    if (/^(def|class|async def)\b/.test(line)) return true;
    return /^(if|elif|else|for|while|try|except|finally|with|match|case)\b.*:$/.test(line);
  }

  private braceTokens(line: string): number[] {
    const tokens: number[] = [];
    let paren = 0;
    let bracket = 0;
    let inString: string | null = null;
    let escaped = false;
    let i = 0;
    const n = line.length;

    while (i < n) {
      const ch = line[i]!;
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === inString) {
          inString = null;
        }
        i++;
        continue;
      }
      if (ch === '/' && line[i + 1] === '/') break;
      if (ch === '/' && line[i + 1] === '*') {
        const end = line.indexOf('*/', i + 2);
        i = end === -1 ? n : end + 1;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        inString = ch;
        i++;
        continue;
      }
      if (ch === '(') paren++;
      else if (ch === ')') paren = Math.max(0, paren - 1);
      else if (ch === '[') bracket++;
      else if (ch === ']') bracket = Math.max(0, bracket - 1);
      else if (ch === '{' && paren === 0 && bracket === 0) tokens.push(1);
      else if (ch === '}' && paren === 0 && bracket === 0) tokens.push(-1);
      i++;
    }

    return tokens;
  }
}

export const indentationEngine = new IndentationEngine();
