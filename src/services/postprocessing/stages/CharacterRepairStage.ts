import type { PostProcessingContext, PostProcessingStage } from '../types';

interface RepairRule {
  name: string;
  pattern: RegExp;
  replace: (...groups: string[]) => string;
  contexts: string[];
  minConfidence: number;
}

const REPAIR_RULES: RepairRule[] = [
  {
    name: 'hex-digit-O-to-0',
    pattern: /\b0x([0-9A-Fa-f]*)[Oo]([0-9A-Fa-f]*)\b/g,
    replace: (_match, before, after) => `0x${before}0${after}`,
    contexts: ['number', 'code', 'terminal'],
    minConfidence: 0,
  },
  {
    name: 'hex-digit-I-to-1',
    pattern: /\b0x([0-9A-Fa-f]*)[Il]([0-9A-Fa-f]*)\b/g,
    replace: (_match, before, after) => `0x${before}1${after}`,
    contexts: ['number', 'code', 'terminal'],
    minConfidence: 0,
  },
  {
    name: 'http-status-200',
    pattern: /\b2[Oo0][Oo0]\b/g,
    replace: () => '200',
    contexts: ['number', 'code', 'terminal'],
    minConfidence: 0,
  },
  {
    name: 'http-status-404',
    pattern: /\b4[Oo0][Oo0-4]/g,
    replace: (m) => m.replace(/[Oo]/g, '0'),
    contexts: ['number', 'code', 'terminal'],
    minConfidence: 0,
  },
  {
    name: 'http-status-500',
    pattern: /\b5[Oo0][Oo0]/g,
    replace: (m) => m.replace(/[Oo]/g, '0'),
    contexts: ['number', 'code', 'terminal'],
    minConfidence: 0,
  },
  {
    name: 'number-O-to-0',
    pattern: /\b\d+[Oo]\d+\b/g,
    replace: (m) => m.replace(/[Oo]/g, '0'),
    contexts: ['*'],
    minConfidence: 0,
  },
  {
    name: 'number-l-to-1',
    pattern: /\b\d+[lI]\d+\b/g,
    replace: (m) => m.replace(/[lI]/g, '1'),
    contexts: ['*'],
    minConfidence: 0,
  },
  {
    name: 'version-O-to-0',
    pattern: /\b\d+\.\d+\.\d+[Oo]\d*\b/g,
    replace: (m) => m.replace(/[Oo]/g, '0'),
    contexts: ['*'],
    minConfidence: 0,
  },
  {
    name: 'percent-O-to-0',
    pattern: /\b[Oo]%\b/g,
    replace: () => '0%',
    contexts: ['*'],
    minConfidence: 0,
  },
  {
    name: 'url-colon-slash',
    pattern: /https?: \/\//g,
    replace: (m) => m.replace(/: \/\//, '://'),
    contexts: ['*'],
    minConfidence: 0,
  },
  {
    name: 'url-colon-slash-www',
    pattern: /https?:\/ \//g,
    replace: (m) => m.replace(/\/ \//, '//'),
    contexts: ['*'],
    minConfidence: 0,
  },
  {
    name: 'email-at-space',
    pattern: /\b[\w.%-]+ @ [\w.-]+\.[a-z]{2,}\b/g,
    replace: (m) => m.replace(/ @ /, '@'),
    contexts: ['*'],
    minConfidence: 0,
  },
  {
    name: 'email-dot-space',
    pattern: /\b[\w.%-]+@[\w.-]+ \. [a-z]{2,}\b/g,
    replace: (m) => m.replace(/ \. /, '.'),
    contexts: ['*'],
    minConfidence: 0,
  },
  {
    name: 'arrow-equals',
    pattern: /= >/g,
    replace: () => '=>',
    contexts: ['code', 'terminal'],
    minConfidence: 0,
  },
  {
    name: 'arrow-dash-gt',
    pattern: /- >/g,
    replace: () => '->',
    contexts: ['code', 'terminal'],
    minConfidence: 0,
  },
  {
    name: 'not-equal',
    pattern: /! =/g,
    replace: () => '!=',
    contexts: ['code', 'terminal'],
    minConfidence: 0,
  },
  {
    name: 'strict-equal',
    pattern: /= = =/g,
    replace: () => '===',
    contexts: ['code', 'terminal'],
    minConfidence: 0,
  },
  {
    name: 'less-equal',
    pattern: /< =/g,
    replace: () => '<=',
    contexts: ['code', 'terminal'],
    minConfidence: 0,
  },
  {
    name: 'greater-equal',
    pattern: /> =/g,
    replace: () => '>=',
    contexts: ['code', 'terminal'],
    minConfidence: 0,
  },
  {
    name: 'and-and',
    pattern: /& &/g,
    replace: () => '&&',
    contexts: ['code', 'terminal'],
    minConfidence: 0,
  },
  {
    name: 'or-or',
    pattern: /\| \|/g,
    replace: () => '||',
    contexts: ['code', 'terminal'],
    minConfidence: 0,
  },
  {
    name: 'pipe',
    pattern: /\| /g,
    replace: () => '| ',
    contexts: ['code', 'terminal'],
    minConfidence: 0.9,
  },
  {
    name: 'semicolon',
    pattern: /; ;/g,
    replace: () => ';;',
    contexts: ['code', 'terminal'],
    minConfidence: 0,
  },
  {
    name: 'file-ext-ts',
    pattern: /\.tsx?\b/g,
    replace: (m) => m,
    contexts: ['code'],
    minConfidence: 0,
  },
  {
    name: 'file-ext-js',
    pattern: /\.jsx?\b/g,
    replace: (m) => m,
    contexts: ['code'],
    minConfidence: 0,
  },
  {
    name: 'file-ext-py',
    pattern: /\.py\b/g,
    replace: (m) => m,
    contexts: ['code'],
    minConfidence: 0,
  },
  {
    name: 'file-ext-go',
    pattern: /\.go\b/g,
    replace: (m) => m,
    contexts: ['code'],
    minConfidence: 0,
  },
  {
    name: 'file-ext-rs',
    pattern: /\.rs\b/g,
    replace: (m) => m,
    contexts: ['code'],
    minConfidence: 0,
  },
  {
    name: 'console-dot',
    pattern: /console \. (log|error|warn|dir|time|timeEnd|group|groupEnd|assert|count|clear|trace)/g,
    replace: (_m, method) => `console.${method}`,
    contexts: ['code', '*'],
    minConfidence: 0,
  },
  {
    name: 'import-from',
    pattern: /import (\w+) from /g,
    replace: (_m, name) => `import ${name} from `,
    contexts: ['code'],
    minConfidence: 0,
  },
  {
    name: 'require-paren',
    pattern: /require \(/g,
    replace: () => 'require(',
    contexts: ['code'],
    minConfidence: 0,
  },
  {
    name: 'return-statement',
    pattern: /\bretur n\b/g,
    replace: () => 'return',
    contexts: ['code'],
    minConfidence: 0.9,
  },
  {
    name: 'function-keyword',
    pattern: /\bfunct ion\b/g,
    replace: () => 'function',
    contexts: ['code'],
    minConfidence: 0.95,
  },
  {
    name: 'class-keyword',
    pattern: /\bcias s\b/g,
    replace: () => 'class',
    contexts: ['code'],
    minConfidence: 0.95,
  },
];

const CONTEXT_MAP: Record<string, string[]> = {
  number: ['number'],
  code: ['code', 'json', 'yaml', 'xml', 'html', 'sql', 'config', 'stacktrace', 'log'],
  terminal: ['terminal'],
};

function getContextsForType(contentType: string): string[] {
  const contexts: string[] = ['*'];
  for (const [ctx, types] of Object.entries(CONTEXT_MAP)) {
    if (types.includes(contentType)) contexts.push(ctx);
  }
  return contexts;
}

export class CharacterRepairStage implements PostProcessingStage {
  readonly name = 'character-repair';

  process(ctx: PostProcessingContext): PostProcessingContext {
    let text = ctx.text;
    const activeContexts = getContextsForType(ctx.detectedContentType);
    let repairCount = ctx.repairCount;

    for (const rule of REPAIR_RULES) {
      const applies = rule.contexts.some((c) => c === '*' || activeContexts.includes(c));
      if (!applies) continue;

      if (rule.minConfidence > ctx.confidence / 100) continue;

      text = text.replace(rule.pattern, (...args) => {
        const match = args[0]!;
        const groups = args.slice(1, -2) as string[];
        const result = rule.replace(match, ...groups);
        if (result !== match) repairCount++;
        return result;
      });
    }

    return { ...ctx, text, repairCount };
  }
}
