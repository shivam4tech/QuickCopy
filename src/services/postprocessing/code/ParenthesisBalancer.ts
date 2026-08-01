export class ParenthesisBalancer {
  repair(text: string): string {
    if (!text || !text.trim()) return text;

    const lines = text.split('\n');
    let lastIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i]!.trim()) {
        lastIdx = i;
        break;
      }
    }
    if (lastIdx === -1) return text;

    let paren = 0;
    let bracket = 0;
    let parenAtLastStart = 0;
    let bracketAtLastStart = 0;
    let inString: string | null = null;
    let escaped = false;
    let inBlockComment = false;

    for (let li = 0; li <= lastIdx; li++) {
      const line = lines[li]!;
      if (li === lastIdx) {
        parenAtLastStart = paren;
        bracketAtLastStart = bracket;
      }
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]!;
        if (inBlockComment) {
          if (ch === '*' && line[i + 1] === '/') {
            inBlockComment = false;
            i++;
          }
          continue;
        }
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
        if (ch === '/' && line[i + 1] === '/') break;
        if (ch === '/' && line[i + 1] === '*') {
          inBlockComment = true;
          i++;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') {
          inString = ch;
          continue;
        }
        if (ch === '(') paren++;
        else if (ch === ')') paren = Math.max(0, paren - 1);
        else if (ch === '[') bracket++;
        else if (ch === ']') bracket = Math.max(0, bracket - 1);
      }
    }

    const netParen = paren - parenAtLastStart;
    const netBracket = bracket - bracketAtLastStart;

    const lastLine = lines[lastIdx]!.trim();
    const lastCh = lastLine[lastLine.length - 1] ?? '';
    const continuation =
      lastCh === '(' || lastCh === ',' || lastCh === '[' || lastCh === '{' ||
      lastCh === ':' || lastCh === '.' ||
      /[=+\-*/%&|<>]/.test(lastCh) ||
      lastLine.endsWith('&&') || lastLine.endsWith('||') ||
      lastLine.endsWith('->') || lastLine.endsWith('=>');

    if (netParen > 0 && netParen <= 3 && !continuation) {
      lines[lastIdx] = lines[lastIdx]! + ')'.repeat(netParen);
    } else if (netParen === 0 && netBracket === 1 && !continuation) {
      lines[lastIdx] = lines[lastIdx]! + ']';
    }

    return lines.join('\n');
  }
}

export const parenthesisBalancer = new ParenthesisBalancer();
