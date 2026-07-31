import type { PostProcessingContext, PostProcessingStage } from '../types';

const URL_PATTERNS: [RegExp, string][] = [
  [/\b(https?):\s*\/\s*\//g, '$1://'],
  [/\b(https?):\/\/\s+/g, '$1://'],
  [/\b(https?):\s*\/(\w)/g, '$1://$2'],
  [/\b(www\.)\s+/g, '$1'],
  [/\b(\w+)\.\s+(com|org|net|io|dev|app|gov|edu)\b/g, '$1.$2'],
  [/\b(\w+)@\s+(\w+)/g, '$1@$2'],
  [/\b(\w+)\.\s+(\w+)\s*@/g, '$1.$2@'],
];

export class UrlEmailStage implements PostProcessingStage {
  readonly name = 'url-email';

  process(ctx: PostProcessingContext): PostProcessingContext {
    let text = ctx.text;

    for (const [pattern, replacement] of URL_PATTERNS) {
      text = text.replace(pattern, replacement);
    }

    return { ...ctx, text };
  }
}
