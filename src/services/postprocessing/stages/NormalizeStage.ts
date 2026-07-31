import type { PostProcessingContext, PostProcessingStage } from '../types';

export class NormalizeStage implements PostProcessingStage {
  readonly name = 'normalize';

  process(ctx: PostProcessingContext): PostProcessingContext {
    let text = ctx.text;

    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\r/g, '\n');
    text = text.replace(/\0/g, '');
    text = text.replace(/\uFEFF/g, '');
    text = text.replace(/\u2018|\u2019/g, "'");
    text = text.replace(/\u201C|\u201D/g, '"');
    text = text.replace(/\u2013|\u2014/g, '-');

    return { ...ctx, text };
  }
}
