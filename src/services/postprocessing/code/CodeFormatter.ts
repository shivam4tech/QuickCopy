import { codeDetector } from './CodeDetector';
import { languageDetector } from './LanguageDetector';
import { whitespaceNormalizer } from './WhitespaceNormalizer';
import { lineReconstructor } from './LineReconstructor';
import { indentationEngine } from './IndentationEngine';
import { indentRecovery } from './IndentRecovery';
import { parenthesisBalancer } from './ParenthesisBalancer';
import { punctuationCorrector } from './PunctuationCorrector';
import { FORMAT_CONFIDENCE_THRESHOLD } from './types';
import type { CodeFormattingResult, CodeLanguage, FormattableBlock } from './types';

export class CodeFormatter {
  format(text: string, blocks: FormattableBlock[] = []): CodeFormattingResult {
    if (!text || !text.trim()) {
      return { text, confidence: 0, language: 'unknown', changed: false, lineChanges: 0 };
    }

    // Strip obvious OCR noise before anything else: stray punctuation-only
    // lines at the edges and tokens glued onto a block header (e.g. the "D"
    // in "class Program { D").
    text = this.cleanupNoise(text);

    // Step 1: code detection. If too few signals, leave OCR untouched.
    const detection = codeDetector.detect(text);
    if (!detection.isCode) {
      return { text, confidence: detection.confidence, language: 'unknown', changed: false, lineChanges: 0 };
    }

    // Infer language (with a conservative fallback for Python-style code).
    let language = languageDetector.detect(text);
    if (language === 'unknown') {
      const hasBraces = /[{}]/.test(text);
      const hasColonBlocks = /^\s*(if|for|while|def|class|try|except|with|match|case)\b.*:\s*$/m.test(text);
      if (!hasBraces && hasColonBlocks) language = 'python';
    }

    // Step 2: whitespace normalization.
    const normalized = whitespaceNormalizer.normalize(text);
    const originalLines = normalized.split('\n');

    // Step 5: line reconstruction (which OCR lines each output line came from).
    const rec = lineReconstructor.reconstructLines(originalLines, language);
    const lines = rec.lines;
    const lineOf = rec.lineOf;
    const lead = rec.lead;

    // Step 3+6: indentation. Geometry (editor x-offsets) is ground truth;
    // syntax inference is only a fallback when geometry is unavailable.
    const geo = indentRecovery.recover(originalLines, blocks);
    const syntax = indentationEngine.computeLevels(lines, language);

    if (geo.confident) {
      const levels = this.composeLevels(lines, lineOf, syntax, geo.byLine);
      const output = this.applyIndent(lines, levels, geo.unit, false);

      // Step 4: parenthesis balancing (only obvious OCR drops at the very end).
      // Step 8: punctuation correction (conservative).
      const finalText = this.repair(output, language);

      const confidence = this.computeConfidence(detection.confidence, true, levels, lines, text);
      if (confidence < FORMAT_CONFIDENCE_THRESHOLD) {
        return { text, confidence, language, changed: false, lineChanges: 0 };
      }
      return this.finish(text, finalText, confidence, language);
    }

    if (language === 'python') {
      // Without geometry, re-indenting Python risks changing its semantics.
      // Preserve the OCR's own indentation and only repair line structure.
      const preserved = this.preserveIndent(lines, lead);
      const finalText = this.repair(preserved, language);
      const confidence = Math.max(detection.confidence, 40);
      if (confidence < FORMAT_CONFIDENCE_THRESHOLD) {
        return { text, confidence, language, changed: false, lineChanges: 0 };
      }
      return this.finish(text, finalText, confidence, language);
    }

    // C-like fallback: rebuild indentation from brace structure.
    const style = whitespaceNormalizer.detectIndentStyle(originalLines);
    const levels = this.composeLevels(lines, lineOf, syntax, new Map());
    const output = this.applyIndent(lines, levels, style.unit, style.useTabs);
    const finalText = this.repair(output, language);

    const confidence = this.computeConfidence(detection.confidence, false, levels, lines, text);
    if (confidence < FORMAT_CONFIDENCE_THRESHOLD) {
      return { text, confidence, language, changed: false, lineChanges: 0 };
    }
    return this.finish(text, finalText, confidence, language);
  }

  /**
   * Geometry levels for group-start lines; syntax deltas for the pieces
   * created when a merged OCR line was split (their inner indent is unknown,
   * so the brace/colon structure refines them relative to the group start).
   */
  private composeLevels(
    lines: string[],
    lineOf: number[],
    syntax: number[],
    geoByLine: Map<number, number>
  ): number[] {
    const groupStart = new Map<number, number>();
    for (let i = 0; i < lineOf.length; i++) {
      const g = lineOf[i]!;
      if (!groupStart.has(g)) groupStart.set(g, i);
    }

    const levels: number[] = new Array(lines.length);
    for (let i = 0; i < lines.length; i++) {
      const g = lineOf[i]!;
      const start = groupStart.get(g)!;
      const sLevel = syntax[i] ?? 0;
      if (start === i) {
        const geoLevel = geoByLine.get(g);
        levels[i] = geoLevel !== undefined ? Math.max(0, geoLevel) : Math.max(0, sLevel);
      } else {
        const base = levels[start] ?? 0;
        const baseSyntax = syntax[start] ?? 0;
        levels[i] = Math.max(0, base + (sLevel - baseSyntax));
      }
    }
    return levels;
  }

  private applyIndent(lines: string[], levels: number[], unit: number, useTabs: boolean): string {
    const out: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.trim() === '') {
        out.push('');
        continue;
      }
      const level = Math.max(0, levels[i] ?? 0);
      const indent = useTabs ? '\t'.repeat(level) : ' '.repeat(level * unit);
      out.push(indent + line.trim());
    }
    return out.join('\n');
  }

  /**
   * Removes OCR artifacts that are never valid code:
   * - leading/trailing lines that contain a single stray punctuation char,
   * - a short token glued onto a block header (e.g. "class Program { D").
   */
  private cleanupNoise(text: string): string {
    const lines = text.split('\n');
    const isStray = (l: string): boolean => {
      const t = l.trim();
      return t.length === 1 && !/[{}()[\];'"0-9A-Za-z]/.test(t);
    };
    let start = 0;
    let end = lines.length;
    while (start < end && isStray(lines[start]!)) start++;
    while (end > start && isStray(lines[end - 1]!)) end--;
    const kept = lines.slice(start, end).map((l) => {
      const t = l.trimStart();
      if (t.startsWith('//') || t.startsWith('#') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--')) {
        return l;
      }
      return l.replace(/^(\s*[^{}\n]*\{)\s+\w{1,16}\s*$/, '$1');
    });
    return kept.join('\n');
  }

  private preserveIndent(lines: string[], lead: string[]): string {
    const out: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.trim() === '') {
        out.push('');
        continue;
      }
      out.push((lead[i] ?? '') + line.trim());
    }
    return out.join('\n');
  }

  private repair(text: string, language: CodeLanguage): string {
    let out = parenthesisBalancer.repair(text);
    out = punctuationCorrector.correct(out, language);
    return out;
  }

  private finish(
    original: string,
    output: string,
    confidence: number,
    language: CodeLanguage
  ): CodeFormattingResult {
    const changed = output !== original;
    const lineChanges = this.countLineChanges(original, output);
    return { text: output, confidence, language, changed, lineChanges };
  }

  private computeConfidence(
    detectConfidence: number,
    geometryConfident: boolean,
    levels: number[],
    lines: string[],
    original: string
  ): number {
    let score = geometryConfident ? Math.max(detectConfidence, 55) : detectConfidence;

    const opens = (original.match(/\{/g) ?? []).length;
    const closes = (original.match(/\}/g) ?? []).length;
    if (opens + closes > 0) {
      const imbalance = Math.abs(opens - closes);
      score -= Math.min(imbalance * 5, 25);
    }

    let jumps = 0;
    let prev: number | null = null;
    for (let i = 0; i < lines.length; i++) {
      const lv = levels[i] ?? 0;
      if (lv < 0) continue;
      if (prev !== null && Math.abs(lv - prev) > 3) jumps++;
      prev = lv;
    }
    const comparisons = Math.max(0, lines.filter((l) => l.trim().length > 0).length - 1);
    if (comparisons > 0) {
      const ratio = jumps / comparisons;
      if (ratio > 0.5) score -= 60;
      else if (ratio > 0.25) score -= 30;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private countLineChanges(a: string, b: string): number {
    const la = a.split('\n');
    const lb = b.split('\n');
    const max = Math.max(la.length, lb.length);
    let changes = 0;
    for (let i = 0; i < max; i++) {
      if (la[i] !== lb[i]) changes++;
    }
    return Math.min(changes, 100);
  }
}

export const codeFormatter = new CodeFormatter();
export type { FormattableBlock };
