import type { PostProcessingContext, PostProcessingStage, ContentType } from '../types';

const CODE_TYPES: ContentType[] = ['code', 'json', 'yaml', 'xml', 'html', 'sql', 'config'];

const KEYWORD_FIXES: [RegExp, string][] = [
  [/\bwhiIe\b/g, 'while'],
  [/\bswit ch\b/g, 'switch'],
  [/\bswitdh\b/g, 'switch'],
  [/\bcont inue\b/g, 'continue'],
  [/\bbre ak\b/g, 'break'],
  [/\bdefauIt\b/g, 'default'],
  [/\bpr0tected\b/g, 'protected'],
  [/\bpriv ate\b/g, 'private'],
  [/\bpubl ic\b/g, 'public'],
  [/\bstat ic\b/g, 'static'],
  [/\bvoi d\b/g, 'void'],
  [/\bnuIl\b/g, 'null'],
  [/\bundef ined\b/g, 'undefined'],
  [/\bnuIl\b/g, 'null'],
  [/\btr ue\b/g, 'true'],
  [/\bfa lse\b/g, 'false'],
  [/\bnaN\b/g, 'NaN'],
  [/\bunde fined\b/g, 'undefined'],
];

export class ProgrammingStage implements PostProcessingStage {
  readonly name = 'programming';

  process(ctx: PostProcessingContext): PostProcessingContext {
    if (!CODE_TYPES.includes(ctx.detectedContentType)) {
      return ctx;
    }

    let text = ctx.text;

    for (const [pattern, replacement] of KEYWORD_FIXES) {
      text = text.replace(pattern, replacement);
    }

    text = text.replace(/\/\//g, (match) => match);
    text = text.replace(/\/\*/g, (match) => match);
    text = text.replace(/\*\//g, (match) => match);

    text = text.replace(/(\w)\s*\((\s*)\)/g, '$1()');

    text = text.replace(/^\s+$/gm, (match) => match);

    return { ...ctx, text };
  }
}
