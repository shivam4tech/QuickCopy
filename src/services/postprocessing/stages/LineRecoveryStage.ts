import type { PostProcessingContext, PostProcessingStage } from '../types';

type PatternReplacer = string | ((substring: string, ...args: string[]) => string);

const SPLIT_PATTERNS: [RegExp, string][] = [
  [/(\w)\.\s*\n\s*(\w+)\s*\(/g, '$1.$2('],
  [/(\w+)\s*\n\s*\.\s*(\w+)\s*\(/g, '$1.$2('],
  [/(\w+)\s*\n\s*=>/g, '$1 =>'],
  [/(\w+)\s*\n\s*([:;,\-+*/=])/g, '$1 $2'],
  [/([:;,\-+*/=])\s*\n\s*(\w)/g, '$1 $2'],
  [/(import\s+\w+)\s*\n\s*(from)/g, '$1 $2'],
  [/(from\s+\S+)\s*\n\s*(import)/g, '$1 $2'],
  [/(export\s+)\s*\n\s*(default|const|let|var|function|class|interface|type)/g, '$1$2'],
  [/^(const|let|var)\s+\n\s*(\w+)/gm, '$1 $2'],
  [/^(function|def)\s+\n\s*(\w+)/gm, '$1 $2'],
  [/(\w)\s*\n\s*(==|!=|<=|>=|&&|\|\|)/g, '$1 $2'],
  [/(==|!=|<=|>=|&&|\|\|)\s*\n\s*(\w)/g, '$1 $2'],
  [/^(\s+)(\w)\s*\n\s*\1\.(\w+)/gm, '$1$2.$3'],
];

const SHORT_LINE_PATTERNS: [RegExp, PatternReplacer][] = [
  [/^(\s{0,4})(docker)\s*$/im, (_m: string, indent: string, word: string) => `${indent}${word}`],
  [/^(\s{0,4})(compose)\s*$/im, (_m: string, indent: string, word: string) => `${indent}${word}`],
  [/^(\s{0,4})(git)\s*$/im, (_m: string, indent: string, word: string) => `${indent}${word}`],
  [/^(\s{0,4})(npm)\s*$/im, (_m: string, indent: string, word: string) => `${indent}${word}`],
  [/^(\s{0,4})(yarn)\s*$/im, (_m: string, indent: string, word: string) => `${indent}${word}`],
  [/^(\s{0,4})(sudo)\s*$/im, (_m: string, indent: string, word: string) => `${indent}${word}`],
  [/^(\s{0,4})(apt|brew|pip)\s*$/im, (_m: string, indent: string, word: string) => `${indent}${word}`],
  [/^(\s{0,4})(ssh|curl|wget)\s*$/im, (_m: string, indent: string, word: string) => `${indent}${word}`],
  [/^(\s{0,4})(npx)\s*$/im, (_m: string, indent: string, word: string) => `${indent}${word}`],
  [/^(\s{0,4})(cargo)\s*$/im, (_m: string, indent: string, word: string) => `${indent}${word}`],
  [/^(\s{0,4})(go)\s*$/im, (_m: string, indent: string, word: string) => `${indent}${word}`],
];

function isLikelyMerged(line: string, nextLine: string): boolean {
  if (!nextLine) return false;

  const joined = line + nextLine;

  if (/\.\w+\(/.test(joined.slice(Math.max(0, line.length - 20)))) return true;
  if (/^[a-z]\s+[a-z]/i.test(line) && /^[a-z]/i.test(nextLine)) return false;

  if (line.endsWith('.') && /^[a-z]/.test(nextLine)) {
    if (nextLine.length > 3 && nextLine[0] === nextLine[0]!.toLowerCase()) return true;
  }

  return false;
}

function isLikelySplit(line: string, nextLine: string): boolean {
  if (!nextLine) return false;
  if (/^[{(\[]/.test(nextLine)) return true;
  if (/[,;:]\s*$/.test(line) && /^[a-z]/i.test(nextLine)) return true;
  if (line.endsWith('->') || line.endsWith('=>')) return true;
  if (/^(from|import|export|return)\s*$/i.test(line.trim())) return true;
  if (/^(const|let|var|function|def|class)\s*$/i.test(line.trim())) return true;
  if (/==|!=|<=|>=|&&|\|\|/.test(line) && !line.endsWith(')') && !line.endsWith('}')) return false;
  return false;
}

export class LineRecoveryStage implements PostProcessingStage {
  readonly name = 'line-recovery';

  process(ctx: PostProcessingContext): PostProcessingContext {
    let text = ctx.text;

    for (const [pattern, replacement] of SPLIT_PATTERNS) {
      text = text.replace(pattern, replacement as string);
    }

    const lines = text.split('\n');
    const result: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i]!;
      const nextLine = lines[i + 1];

      if (nextLine !== undefined && isLikelyMerged(line, nextLine)) {
        const joined = line + ' ' + nextLine;
        result.push(joined);
        i += 2;
      } else if (nextLine !== undefined && isLikelySplit(line, nextLine)) {
        const joined = line + ' ' + nextLine;
        result.push(joined);
        i += 2;
      } else {
        result.push(line);
        i++;
      }
    }

    text = result.join('\n');

    for (const [pattern, replacement] of SHORT_LINE_PATTERNS) {
      text = text.replace(pattern, replacement as string);
    }

    return { ...ctx, text };
  }
}
