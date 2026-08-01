import type { ContentType, ProgrammingLanguage } from './types';

const CODE_PATTERNS: [RegExp, number][] = [
  [/^(def |class |import |from |return |if __name__|print\()/m, 20],
  [/^(function |const |let |var |import |export |interface |type |enum )/m, 20],
  [/^(using |namespace |public |private |protected |static |void |int |string )/m, 20],
  [/^(fn |pub |impl |let |mut |struct |enum |trait |use )/m, 20],
  [/^(package |import |func |type |struct |interface |defer |go )/m, 20],
  [/^(SELECT |FROM |WHERE |INSERT |UPDATE |DELETE |CREATE |ALTER |DROP )/m, 20],
  [/[{}\(\)=;]$/m, 10],
  [/\/\/.*$/m, 5],
  [/\/\*.*\*\//m, 5],
  [/=>|===|!==|::|->|\.\.\./m, 5],
  [/^[ \t]*(if|for|while|switch|try|catch) /m, 10],
];

const TERMINAL_PATTERNS: [RegExp, number][] = [
  [/^[\w@:~\/]+[#$>] /m, 20],
  [/^(error|warning|info|debug|trace):/im, 10],
  [/^\[[\d]{2}:[\d]{2}:[\d]{2}\]/m, 10],
  [/^(fatal|segmentation fault|killed|aborted)/im, 10],
  [/^[\w-]+@[\w-]+:/m, 15],
  [/^\$ /m, 20],
  [/^(> |# )/m, 10],
];

const MARKDOWN_PATTERNS: [RegExp, number][] = [
  [/^#{1,6}\s/m, 20],
  [/^[-*+]\s/m, 10],
  [/^\d+\.\s/m, 10],
  [/`{3}/m, 20],
  [/\[.+\]\(.+\)/m, 10],
  [/^>\s/m, 10],
  [/[*_]{2}[^*_]+[*_]{2}/m, 5],
];

const JSON_PATTERNS: [RegExp, number][] = [
  [/^[\s]*\{[\s\S]*\}[\s]*$/m, 25],
  [/^[\s]*\[[\s\S]*\][\s]*$/m, 25],
  [/"\w+":\s/g, 10],
];

const YAML_PATTERNS: [RegExp, number][] = [
  [/^---[\s]*$/m, 25],
  [/^[\w-]+:\s/gm, 15],
  [/^[\s]+[\w-]+:\s/gm, 10],
  [/^[\s]+-\s/gm, 10],
];

const XML_HTML_PATTERNS: [RegExp, number][] = [
  [/^<\?xml/m, 25],
  [/^<!DOCTYPE/m, 25],
  [/<\/?\w+[^>]*>/m, 15],
  [/<\/\w+>/m, 10],
];

const STACKTRACE_PATTERNS: [RegExp, number][] = [
  [/^[ \t]+at\s/m, 20],
  [/^[ \t]+at\s+\S+\(/m, 25],
  [/^Error:\s/m, 15],
  [/^Uncaught\s/m, 10],
  [/^Traceback/m, 20],
  [/^File\s+"[^"]+",\s+line\s+\d+/m, 20],
];

const LOG_PATTERNS: [RegExp, number][] = [
  [/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/m, 20],
  [/^\[INFO\]|^\[WARN\]|^\[ERROR\]|^\[DEBUG\]/im, 15],
  [/^\d+\.\d+\.\d+\.\d+ - - /m, 15],
];

export class ContentDetector {
  detectContentType(text: string): ContentType {
    if (!text || text.length < 3) return 'plaintext';

    const scores: [ContentType, number][] = [
      ['json', this.scorePatterns(text, JSON_PATTERNS)],
      ['yaml', this.scorePatterns(text, YAML_PATTERNS)],
      ['xml', this.scorePatterns(text, XML_HTML_PATTERNS)],
      ['html', this.scorePatterns(text, XML_HTML_PATTERNS) * 0.8],
      ['markdown', this.scorePatterns(text, MARKDOWN_PATTERNS)],
      ['terminal', this.scorePatterns(text, TERMINAL_PATTERNS)],
      ['stacktrace', this.scorePatterns(text, STACKTRACE_PATTERNS)],
      ['log', this.scorePatterns(text, LOG_PATTERNS)],
      ['code', this.scorePatterns(text, CODE_PATTERNS)],
    ];

    scores.sort((a, b) => b[1] - a[1]);

    const topScore = scores[0]!;
    const runnerUp = scores[1]!;

    if (topScore[1] < 5) return 'plaintext';

    if (topScore[1] > runnerUp[1] * 2 || topScore[1] - runnerUp[1] > 15) return topScore[0];

    if (topScore[0] === 'xml' && runnerUp[0] === 'html') return 'html';

    return topScore[0];
  }

  detectLanguage(text: string): ProgrammingLanguage {
    if (!text || text.length < 3) return 'unknown';

    const checks: [ProgrammingLanguage, RegExp, number][] = [
      ['shell', /^\$\s/m, 10],
      ['shell', /^[~\/]\S*[#$>]\s/m, 10],
      ['python', /^(import |from |def |print\(|if __name__|yield |lambda |async def|with )/m, 15],
      ['python', /^class\s+\w+.*:\s*$/m, 15],
      ['python', /self\.|__init__|__str__|__repr__|__all__|sys\.|os\.|re\.|numpy|pandas/g, 8],
      ['typescript', /:\s*(string|number|boolean|any|never|void|unknown)\b/g, 10],
      ['typescript', /interface\s+\w+|type\s+\w+\s*=|as\s+\w+|readonly/g, 10],
      ['javascript', /=>|const .* = require|module\.exports|\.jsx?['"]/g, 8],
      ['javascript', /console\.(log|error|warn)|\.map\(|\.filter\(|\.reduce\(/g, 5],
      ['rust', /^(fn |let mut|impl |struct |enum |trait |pub fn|use |mod )/m, 15],
      ['rust', /\.unwrap\(\)|\.expect\(|-> [A-Z]\w+|Ok\(|Err\(|Some\(|None\)/g, 8],
      ['go', /^(func |package |import \(|type |struct {|defer |go )/m, 15],
      ['go', /fmt\.(Print|Sprint|Errorf)|err != nil/g, 10],
      ['go', /\.(\w+)\(\)\s*$/m, 5],
      ['cpp', /#include|std::|template|class\s+\w+|virtual |override/g, 12],
      ['cpp', /->|::|<<|>>|auto\s+\w+\s*=/g, 5],
      ['java', /public\s+(static\s+)?(void|int|String|boolean|class)/g, 12],
      ['java', /System\.(out|err)\.(print|println)|@Override/g, 10],
      ['java', /import\s+java\.|new\s+\w+\(\)/g, 8],
      ['csharp', /^(using |namespace |class |public |private |protected |static )/m, 12],
      ['csharp', /Console\.(Write|Read)Line|var\s+\w+\s*=\s*new/g, 10],
      ['csharp', /async Task|string\.|int\.|\.Select\(|\.Where\(/g, 5],
      ['shell', /^[\w@:~\/]+[#$>]\s/m, 15],
      ['shell', /^(sudo |apt |yum |brew |pip |npm |yarn |docker |git |ssh |curl |wget |chmod |grep |sed |awk )/m, 10],
      ['powershell', /^(Write-Host|Get-|Set-|New-|Remove-|Invoke-|Write-Output|\$PS)/m, 15],
      ['powershell', /\| Out-File|\| Select-Object|\| Where-Object|\$_\s*\./g, 8],
      ['sql', /^(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|JOIN|GROUP BY|ORDER BY|HAVING)/m, 15],
      ['sql', /\b(INNER|OUTER|LEFT|RIGHT|CROSS)\s+JOIN|ON\s+\w+\.\w+\s*=\s*\w+\.\w+/g, 10],
      ['yaml', /^---$/m, 15],
      ['yaml', /^[\w-]+:\s/gm, 8],
      ['json', /^[\s]*[{[]/m, 15],
      ['markdown', /^#{1,6}\s/m, 15],
      ['markdown', /^```/m, 15],
    ];

    const scores: Map<ProgrammingLanguage, number> = new Map();
    for (const [lang, pattern, weight] of checks) {
      const matches = text.match(pattern);
      if (matches) {
        scores.set(lang, (scores.get(lang) ?? 0) + matches.length * weight);
      }
    }

    if (scores.size === 0) return 'unknown';

    let best: ProgrammingLanguage = 'unknown';
    let bestScore = 0;
    for (const [lang, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        best = lang;
      }
    }

    return bestScore > 5 ? best : 'unknown';
  }

  private scorePatterns(text: string, patterns: [RegExp, number][]): number {
    let score = 0;
    for (const [pattern, weight] of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        score += matches.length * weight;
      }
    }
    return score;
  }
}

export const contentDetector = new ContentDetector();
