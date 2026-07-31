import type { PostProcessingContext, PostProcessingStage } from '../types';

export class TerminalStage implements PostProcessingStage {
  readonly name = 'terminal';

  process(ctx: PostProcessingContext): PostProcessingContext {
    if (ctx.detectedContentType !== 'terminal' && ctx.detectedContentType !== 'stacktrace' && ctx.detectedContentType !== 'log') {
      return ctx;
    }

    let text = ctx.text;

    text = text.replace(/^(\$)\s*/gm, '$1 ');
    text = text.replace(/^(>)\s*/gm, '$1 ');

    text = text.replace(/(\$\s*\S+)\s+\n(\S)/g, '$1 $2');
    text = text.replace(/(>\s*\S+)\s+\n(\S)/g, '$1 $2');

    text = text.replace(/^\[\d+:\d+:\d+\]/gm, (m) => m);

    text = text.replace(/^[A-Z]+:\s+/gm, (m) => m);

    return { ...ctx, text };
  }
}
