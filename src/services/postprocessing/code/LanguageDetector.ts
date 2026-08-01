import type { CodeLanguage } from './types';

const CHECKS: [CodeLanguage, RegExp, number][] = [
  ['python', /^\s*(import |from |def |async def |print\(|if __name__|yield |lambda )/gm, 12],
  ['python', /^\s*class\s+\w+.*:\s*$/gm, 12],
  ['python', /^\s*(if|for|while|elif|else|try|except|with|match|case)\b.*:\s*$/gm, 6],
  ['python', /self\.|__init__|__str__|__repr__|elif\b/g, 6],
  ['rust', /^\s*(fn |pub fn |let mut |impl |struct \w+ \{|enum \w+ \{|trait |use \w+::)/gm, 12],
  ['rust', /println!\(|\.unwrap\(\)|-> [A-Z]\w+|Ok\(|Err\(/g, 6],
  ['go', /^\s*(func |package |import \(|type \w+ struct|defer |go )/gm, 12],
  ['go', /fmt\.(Print|Sprint|Errorf)|err != nil|:=/g, 6],
  ['cpp', /#include|std::|template|using namespace|printf\(|cout|->|<<|>>/g, 8],
  ['java', /public\s+(static\s+)?(void|int|String|boolean|class)/g, 12],
  ['java', /System\.(out|err)\.|@Override|import java\./g, 8],
  ['csharp', /^\s*(using \S+;|namespace |public (class|static|void|string|int)|private |protected )/gm, 12],
  ['csharp', /^\s*(static\s+(void|int|string|bool|double|float|long|var)\s+\w+\s*\(|class\s+\w+\s*\{)/gm, 12],
  ['csharp', /Console\.(Write|Read)Line|Console\.(Write|Read)Key|async Task|\.Select\(|\.Where\(/g, 8],
  ['typescript', /:\s*(string|number|boolean|any|never|void|unknown)\b|interface \w+ \{|type \w+\s*=|\bas \w+\b|readonly/g, 8],
  ['javascript', /=>|module\.exports|const .* = require|\.map\(|\.filter\(|\.reduce\(/g, 6],
  ['javascript', /console\.(log|error|warn|dir)/g, 4],
  ['php', /<?php|echo\s+|namespace \\|\$this->|function \w+\([^)]*\)\s*\{/g, 8],
  ['kotlin', /^\s*(fun |val |var |data class |class \w+ \{)/gm, 10],
  ['kotlin', /println\(|=>\s|\?\.let/g, 4],
  ['swift', /^\s*(func |import Foundation|class \w+ \{|struct \w+ \{)/gm, 10],
  ['swift', /print\(|guard let|\?\? /g, 4],
];

export class LanguageDetector {
  detect(text: string): CodeLanguage {
    if (!text || text.trim().length < 3) return 'unknown';

    const scores = new Map<CodeLanguage, number>();
    for (const [lang, pattern, weight] of CHECKS) {
      const matches = text.match(pattern);
      if (matches) {
        scores.set(lang, (scores.get(lang) ?? 0) + matches.length * weight);
      }
    }

    if (scores.size === 0) return 'unknown';

    let best: CodeLanguage = 'unknown';
    let bestScore = 0;
    for (const [lang, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        best = lang;
      }
    }

    return bestScore >= 8 ? best : 'unknown';
  }
}

export const languageDetector = new LanguageDetector();
