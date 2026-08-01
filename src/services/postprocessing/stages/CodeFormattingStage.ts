import type { PostProcessingContext, PostProcessingStage } from '../types';
import { codeFormatter } from '../code/CodeFormatter';
import type { FormattableBlock } from '../code/types';

export class CodeFormattingStage implements PostProcessingStage {
  readonly name = 'code-format';

  process(ctx: PostProcessingContext): PostProcessingContext {
    if (!ctx.settings.programmingCleanup) return ctx;
    if (ctx.detectedContentType !== 'code') return ctx;
    if (!ctx.text || ctx.text.trim().length < 3) return ctx;

    const blocks: FormattableBlock[] = (ctx.blocks ?? []).map((b) => ({
      text: b.text,
      bbox: b.bbox,
    }));

    const result = codeFormatter.format(ctx.text, blocks);
    if (!result.changed) return ctx;

    return {
      ...ctx,
      text: result.text,
      repairCount: ctx.repairCount + result.lineChanges,
    };
  }
}
