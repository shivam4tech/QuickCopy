import type { PostProcessingContext, PostProcessingStage } from '../types';

export class WhitespaceStage implements PostProcessingStage {
  readonly name = 'whitespace';

  process(ctx: PostProcessingContext): PostProcessingContext {
    let text = ctx.text;

    text = text.replace(/[ \t]+$/gm, '');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/^\n+/, '');
    text = text.replace(/\n+$/, '\n');

    text = text.replace(/ {2,}/g, (match, offset) => {
      const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
      const beforeOffset = offset - lineStart;
      if (beforeOffset > 0 && /^[ \t]*$/.test(text.slice(lineStart, offset + match.length))) {
        return match;
      }
      const isIndentation = /^[ \t]*$/.test(text.slice(lineStart, offset));
      if (isIndentation) return match;
      return ' ';
    });

    text = text.replace(/\t+/, (match) => match);

    return { ...ctx, text };
  }
}
