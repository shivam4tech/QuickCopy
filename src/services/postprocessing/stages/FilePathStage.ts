import type { PostProcessingContext, PostProcessingStage } from '../types';

type PatternReplacer = string | ((substring: string, ...args: string[]) => string);

const PATH_PATTERNS: [RegExp, PatternReplacer][] = [
  [/\b([A-Za-z]):\s*(\\|\/)/g, '$1:$2'],
  [/(^|\s)\/\s*([a-zA-Z0-9_-]+)\s+\/\s*([a-zA-Z0-9_-]+)/g, (_m: string, pre: string, a: string, b: string) => `${pre}/${a}/${b}`],
  [/(^|\s)\/\s*([a-zA-Z0-9_-]+)/g, (_m: string, pre: string, a: string) => `${pre}/${a}`],
  [/(^|\s)\.\s*\/\s*(\w)/g, '$1./$2'],
  [/(^|\s)\.\.\s*\/\s*(\w)/g, '$1../$2'],
  [/(^|\s)~\s*\/(\w)/g, '$1~/$2'],
  [/(\/[a-zA-Z0-9_-]+)\s+\/([a-zA-Z0-9_-]+)/g, '$1/$2'],
  [/(\\[a-zA-Z0-9_-]+)\s+\\([a-zA-Z0-9_-]+)/g, '$1\\$2'],
];

export class FilePathStage implements PostProcessingStage {
  readonly name = 'file-path';

  process(ctx: PostProcessingContext): PostProcessingContext {
    let text = ctx.text;

    for (const [pattern, replacement] of PATH_PATTERNS) {
      text = text.replace(pattern, replacement as string);
    }

    return { ...ctx, text };
  }
}
