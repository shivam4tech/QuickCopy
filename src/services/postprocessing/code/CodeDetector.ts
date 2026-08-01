import { CODE_DETECT_THRESHOLD } from './types';
import type { CodeDetectorResult } from './types';

export class CodeDetector {
  detect(text: string): CodeDetectorResult {
    if (!text || text.trim().length < 3) {
      return { isCode: false, confidence: 0 };
    }

    let score = 0;

    const count = (re: RegExp): number => (text.match(re) ?? []).length;

    // Structural punctuation.
    score += Math.min(count(/\{/g), 10) * 10;
    score += Math.min(count(/\}/g), 10) * 10;
    score += Math.min(count(/;/g), 14) * 4;
    score += Math.min(count(/\(/g), 10) * 2;
    score += Math.min(count(/\)/g), 10) * 2;
    score += Math.min(count(/\[/g), 8) * 3;
    score += Math.min(count(/\]/g), 8) * 3;
    score += Math.min(count(/==|!=|<=|>=|&&|\|\||->|=>|::|\+=|-=|\*=|\/=|--|\+\+/g), 10) * 6;
    score += Math.min(count(/\w+\s*=\s*\w+[,;)\]]/g), 8) * 4;

    // Python-style signals: line-ending colons and block headers.
    score += Math.min(count(/:\s*$/m), 6) * 8;
    score += Math.min(count(/^\s*(def|class|if|elif|else|for|while|try|except|finally|with|match|case)\b.*:$/m), 6) * 8;

    // Keywords are the strongest signal.
    const keyword = (re: RegExp): number => (text.match(re) ?? []).length;
    score += Math.min(
      keyword(
        /\b(class|namespace|function|import|from|using|package|#include|interface|implements|extends|struct|enum|typedef|template|def|func|fn|async|await|export|module|return|void|static|public|private|protected|const|let|var|new|this|lambda|elif|switch|case|default|printf|println|print|True|False|None|pass|int|float|double|string|bool|char|long|short|byte)\b/g
      ),
      22
    ) * 9;
    score += Math.min(keyword(/\b(if|for|while|try|catch|finally|else|do)\b[ \t]*[({]/g), 12) * 10;
    score += Math.min(keyword(/\b(Console\.|System\.|document\.|window\.|std::|print\(|echo\s+|cout)/g), 10) * 6;

    // Comments / preprocessor.
    score += Math.min(count(/\/\/|\/\*|\*\//g), 8) * 5;
    score += Math.min(count(/^\s*#/gm), 8) * 2;

    // Indentation structure: aligned blocks strongly imply monospace code.
    const lines = text.split('\n');
    let indentedLines = 0;
    const indentFreq = new Map<string, number>();
    for (const line of lines) {
      const m = line.match(/^[ \t]+/);
      if (m && line.trim().length > 0) {
        indentedLines++;
        indentFreq.set(m[0], (indentFreq.get(m[0]) ?? 0) + 1);
      }
    }
    if (indentedLines >= 2) {
      score += 12;
      const maxFreq = Math.max(...indentFreq.values());
      if (maxFreq >= 2) score += 8;
    }

    // Rough balance bonus when braces are present.
    const openBraces = count(/\{/g);
    const closeBraces = count(/\}/g);
    if (openBraces > 0 && Math.abs(openBraces - closeBraces) <= 2) {
      score += 5;
    }

    const confidence = Math.min(100, Math.round(score));
    return { isCode: confidence >= CODE_DETECT_THRESHOLD, confidence };
  }
}

export const codeDetector = new CodeDetector();
