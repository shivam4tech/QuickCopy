import type { PostProcessingContext, PostProcessingStage } from '../types';

const UNKNOWN_SYMBOL_RE = /[^\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2700}-\u{27BF}\x20-\x7E\x0A\x0D\u00A0-\u024F\u0400-\u04FF\u2000-\u206F\u2E00-\u2E7F\u3000-\u303F\uFF00-\uFFEF\u2010-\u2027\u2030-\u205E\u2100-\u214F\u2150-\u218F\u2190-\u21FF\u2200-\u22FF\u2300-\u23FF\u2400-\u243F\u2440-\u245F\u2500-\u257F\u2580-\u259F\u25A0-\u25FF\u2600-\u26FF\u27C0-\u27EF\u27F0-\u27FF\u2800-\u28FF\u2900-\u297F\u2980-\u29FF\u2A00-\u2AFF\u2B00-\u2BFF\u2E80-\u2EFF\u2F00-\u2FDF\u2FF0-\u2FFF\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3130-\u318F\u3190-\u319F\u31C0-\u31EF\u31F0-\u31FF\u3200-\u32FF\u3300-\u33FF\u3400-\u4DBF\u4DC0-\u4DFF\u4E00-\u9FFF\uA000-\uA4CF\uA490-\uA4CF\uAC00-\uD7AF\uF900-\uFAFF\uFE30-\uFE4F\uFE50-\uFE6F\uFF01-\uFF60\uFFE0-\uFFE6]/gu;

export class ValidationStage implements PostProcessingStage {
  readonly name = 'validation';

  process(ctx: PostProcessingContext): PostProcessingContext {
    let text = ctx.text;

    text = text.trimEnd();
    if (text.length > 0 && !text.endsWith('\n')) {
      text += '\n';
    }

    const unknownSymbols = (text.match(UNKNOWN_SYMBOL_RE) ?? []).length;
    const suspiciousSpacing = this.countSuspiciousSpacing(text);
    const brokenPunctuation = this.countBrokenPunctuation(text);

    return {
      ...ctx,
      text,
      qualityScore: {
        overall: this.calculateOverall(ctx, unknownSymbols, suspiciousSpacing, brokenPunctuation),
        averageConfidence: ctx.confidence,
        repairCount: ctx.repairCount,
        unknownSymbols,
        suspiciousSpacing,
        brokenPunctuation,
      },
    };
  }

  private countSuspiciousSpacing(text: string): number {
    let count = 0;
    count += (text.match(/[a-z]\s{3,}[a-z]/gi) ?? []).length;
    count += (text.match(/[.!?]\s{2,}[a-z]/gi) ?? []).length;
    return count;
  }

  private countBrokenPunctuation(text: string): number {
    let count = 0;
    count += (text.match(/\(\s+[^)]/g) ?? []).length;
    count += (text.match(/[^(]\s+\)/g) ?? []).length;
    count += (text.match(/\[\s+[^\]]/g) ?? []).length;
    count += (text.match(/[^\[]\s+\]/g) ?? []).length;
    count += (text.match(/{\s+[^}]/g) ?? []).length;
    count += (text.match(/[^{]\s+}/g) ?? []).length;
    return count;
  }

  private calculateOverall(ctx: PostProcessingContext, _unknownSymbols: number, _suspiciousSpacing: number, _brokenPunctuation: number): number {
    const confidenceScore = ctx.confidence;
    const repairBonus = Math.min(ctx.repairCount * 3, 15);
    const unknownPenalty = _unknownSymbols > 0 ? Math.min(_unknownSymbols * 5, 20) : 0;
    const spacingPenalty = _suspiciousSpacing > 0 ? Math.min(_suspiciousSpacing * 3, 10) : 0;
    const punctPenalty = _brokenPunctuation > 0 ? Math.min(_brokenPunctuation * 2, 10) : 0;
    const score = confidenceScore + repairBonus - unknownPenalty - spacingPenalty - punctPenalty;
    return Math.max(0, Math.min(100, Math.round(score)));
  }
}
