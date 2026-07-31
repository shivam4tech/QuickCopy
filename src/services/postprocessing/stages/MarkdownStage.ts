import type { PostProcessingContext, PostProcessingStage } from '../types';

export class MarkdownStage implements PostProcessingStage {
  readonly name = 'markdown';

  process(ctx: PostProcessingContext): PostProcessingContext {
    if (ctx.detectedContentType !== 'markdown') {
      return ctx;
    }

    let text = ctx.text;

    text = text.replace(/^(#{1,6})\s*/gm, (_m: string, hashes: string) => `${hashes} `);

    text = text.replace(/```\s*(\w+)\s*/g, '```$1\n');
    text = text.replace(/```$/gm, (m) => m);

    text = text.replace(/`([^`]+)`/g, (m) => m);

    text = text.replace(/^(\s*)[-*+]\s*/gm, '$1- ');
    text = text.replace(/^(\s*)\d+\.\s*/gm, (m) => {
      const indent = m.match(/^\s*/)?.[0] ?? '';
      return `${indent}1. `;
    });

    text = text.replace(/\[([^\]]+)\]\s*\(([^)]+)\)/g, '[$1]($2)');

    text = text.replace(/^(\s*)>\s*/gm, '$1> ');

    return { ...ctx, text };
  }
}
