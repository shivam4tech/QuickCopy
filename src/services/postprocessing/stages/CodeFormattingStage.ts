import type { PostProcessingContext, PostProcessingStage } from '../types';
import { codeFormatter } from '../code/CodeFormatter';
import { braceRecovery } from '../code/BraceRecovery';
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

    const recovered = braceRecovery.recover(ctx.text, blocks);
    const result = codeFormatter.format(recovered.text, blocks);
    if (!result.changed && !recovered.changed) return ctx;

    const lineChanges = result.lineChanges + (recovered.changed ? 1 : 0);

    return {
      ...ctx,
      text: result.text,
      repairCount: ctx.repairCount + lineChanges,
    };
  }
}
