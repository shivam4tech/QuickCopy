/**
 * Output-quality scoring for the OCR router.
 *
 * After an engine returns text, this scores how likely the result is
 * trustworthy. Retry is triggered ONLY when multiple independent signals
 * indicate failure — never on slightly-low confidence alone.
 */

export interface QualityBlock {
  text: string;
  confidence: number;
  bbox?: { x: number; y: number; width: number; height: number } | null;
}

export interface QualityInput {
  text: string;
  confidence: number;
  blocks: QualityBlock[];
  /** optional content type from later pipeline stages; when absent we infer */
  detectedContentType?: string;
}

export interface QualitySignals {
  averageConfidence: number;
  braceBalanceDelta: number;
  parenBalanceDelta: number;
  impossibleTokenRatio: number;
  mergedLineCount: number;
  lostIndentLevels: number;
  lineWidthCv: number;
}

export interface QualityResult {
  overall: number;
  signals: QualitySignals;
  flags: string[];
  retry: boolean;
  retryReason: string | null;
}

const PRINTABLE = /[\u0020-\u007E\u00A0-\u024F\u2500-\u257F\u2580-\u259F]/;

export function meanConfidence(blocks: QualityBlock[], fallback: number): number {
  if (blocks.length === 0) return fallback;
  const confs = blocks.map((b) => (typeof b.confidence === 'number' && b.confidence >= 0 ? b.confidence : fallback));
  return confs.reduce((a, b) => a + b, 0) / confs.length;
}

function countChar(text: string, char: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) if (text[i] === char) n++;
  return n;
}

/** Number of distinct leading-whitespace levels in the text (code indentation). */
export function indentLevelsInText(text: string): number {
  const levels = new Set<number>();
  for (const line of text.split('\n')) {
    const leading = line.match(/^[ \t]*/)?.[0] ?? '';
    levels.add(leading.length);
  }
  return levels.size;
}

/** Number of distinct bbox.x values in the per-line geometry (3px tolerance). */
export function distinctXLevels(blocks: QualityBlock[]): number {
  const xs = new Set<number>();
  for (const b of blocks) {
    if (b.bbox && typeof b.bbox.x === 'number') xs.add(Math.floor(b.bbox.x / 3));
  }
  return xs.size;
}

/**
 * Score output quality. Returns 0..100 (higher = better) plus per-signal flags.
 * Retry fires only when >= 2 flags are set AND overall quality is below the
 * acceptance threshold.
 */
export function scoreOcrQuality(input: QualityInput, retryThreshold = 60): QualityResult {
  const { text, confidence, blocks } = input;
  const avgConf = meanConfidence(blocks, confidence);
  const flags: string[] = [];

  const braceDelta = Math.abs(countChar(text, '{') - countChar(text, '}'));
  const parenDelta = Math.abs(countChar(text, '(') - countChar(text, ')'));

  let impossibleTokens = 0;
  let printable = 0;
  for (const ch of text) {
    if (ch === '\n' || ch === '\t' || ch === '\r') continue;
    printable++;
    if (!PRINTABLE.test(ch)) impossibleTokens++;
  }
  const impossibleTokenRatio = printable > 0 ? impossibleTokens / printable : 0;

  const mergedLineCount = blocks.filter((b) => b.text.includes('\n')).length;

  const indentText = indentLevelsInText(text);
  const xLevels = distinctXLevels(blocks);
  const lostIndentLevels = xLevels >= 1 ? Math.max(0, indentText - xLevels - 1) : 0;

  let lineWidthCv = 0;
  const widths = blocks
    .filter((b) => b.bbox && typeof b.bbox.width === 'number' && b.bbox.width > 0)
    .map((b) => b.bbox!.width);
  if (widths.length >= 3) {
    const mean = widths.reduce((a, b) => a + b, 0) / widths.length;
    const variance = widths.reduce((a, b) => a + (b - mean) * (b - mean), 0) / widths.length;
    lineWidthCv = Math.sqrt(variance) / (mean || 1);
  }

  const signals: QualitySignals = {
    averageConfidence: avgConf,
    braceBalanceDelta: braceDelta,
    parenBalanceDelta: parenDelta,
    impossibleTokenRatio,
    mergedLineCount,
    lostIndentLevels,
    lineWidthCv,
  };

  let overall = avgConf;
  overall -= Math.min(30, braceDelta * 6 + parenDelta * 3);
  overall -= Math.min(25, impossibleTokenRatio * 250);
  overall -= Math.min(20, mergedLineCount * 7);
  overall -= Math.min(20, lostIndentLevels * 8);
  overall -= Math.min(15, lineWidthCv * 60);
  overall = Math.max(0, Math.min(100, overall));

  if (avgConf < 55) flags.push('low-confidence');
  if (impossibleTokenRatio > 0.02) flags.push('impossible-tokens');
  if (braceDelta + parenDelta > 2) flags.push('unbalanced-brackets');
  if (mergedLineCount > 0) flags.push('merged-lines');
  if (lostIndentLevels > 0) flags.push('lost-indentation');

  const retry = flags.length >= 2 && overall < retryThreshold;
  const retryReason = retry ? flags.join(',') : null;

  return { overall: Math.round(overall), signals, flags, retry, retryReason };
}
