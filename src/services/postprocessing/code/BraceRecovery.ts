import type { FormattableBlock } from './types';

export interface BraceRecoveryResult {
  text: string;
  changed: boolean;
}

interface GeoRow {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Recovers standalone `{` braces that OCR loses when the author writes them
 * on their own line (Allman style):
 *
 *   a) A lone `{` merged onto the previous header line:
 *        `if (x)` + `{`  ->  `if (x) {`   (the detection box covered both rows,
 *      so the block's height is ~2 lines tall).
 *   b) A lone `{` misread as a single glyph (e.g. `4`), sitting right below a
 *      block header at the same left margin.
 *
 * Both cases are gated on geometry so they NEVER fire for K&R-style braces
 * that genuinely share a line with the header (`if (x) {` in the image), and
 * never touch closing braces or prose.
 */
export class BraceRecovery {
  recover(text: string, blocks: FormattableBlock[]): BraceRecoveryResult {
    const lines = text.split('\n');
    if (lines.length < 2) return { text, changed: false };

    const geo = this.collectRows(blocks);
    if (geo.length < 2) return { text, changed: false };

    const lineHeight = this.robustMedian(geo.map((g) => g.height), 0.5, 2.2);
    const charWidth = this.medianCharWidth(geo);
    if (!lineHeight || !charWidth) return { text, changed: false };

    const rowOf = this.matchRows(lines, geo);

    let changed = false;
    const out: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]!;
      const indent = raw.match(/^[ \t]*/)?.[0] ?? '';
      const content = raw.trim();
      const row = rowOf[i];

      // (a) Merged header + `{`: only when the block is visibly taller than a
      // single line, i.e. two text rows were detected as one.
      if (row && row.height >= lineHeight * 1.5) {
        const m = content.match(/^(.+?)\{\s*$/);
        if (m && this.isBlockHeader(m[1]!.trim())) {
          out.push(indent + m[1]!.trimEnd());
          out.push(indent + '{');
          changed = true;
          continue;
        }
      }

      // (b) Lone suspicious glyph right below a header at the same left margin.
      if (
        row &&
        this.isSingleSuspiciousGlyph(content) &&
        row.width <= charWidth * 1.7 &&
        this.isBelowBlockHeader(i, lines, rowOf, charWidth)
      ) {
        out.push(indent + '{');
        changed = true;
        continue;
      }

      out.push(raw);
    }

    return { text: changed ? out.join('\n') : text, changed };
  }

  private collectRows(blocks: FormattableBlock[]): GeoRow[] {
    const geo: GeoRow[] = [];
    for (const b of blocks) {
      if (!b.bbox || !b.text || !b.text.trim()) continue;
      for (const rawLine of b.text.split('\n')) {
        const t = rawLine.trim();
        if (!t) continue;
        geo.push({ text: t, x: b.bbox.x, y: b.bbox.y, width: b.bbox.width, height: b.bbox.height });
      }
    }
    return geo;
  }

  /** Median, then re-median over rows within [lowF*median, highF*median]. */
  private robustMedian(values: number[], lowF: number, highF: number): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const raw = sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
    if (raw <= 0) return null;
    const kept = sorted.filter((v) => v >= raw * lowF && v <= raw * highF);
    if (kept.length === 0) return raw;
    const kMid = Math.floor(kept.length / 2);
    return kept.length % 2 === 1 ? kept[kMid]! : (kept[kMid - 1]! + kept[kMid]!) / 2;
  }

  private medianCharWidth(geo: GeoRow[]): number | null {
    const widths: number[] = [];
    for (const g of geo) {
      const visible = g.text.replace(/\s/g, '').length;
      if (visible >= 2 && g.width > 0) {
        const cw = g.width / visible;
        if (cw > 4 && cw < 40) widths.push(cw);
      }
    }
    if (widths.length === 0) return null;
    const sorted = [...widths].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  }

  /** Map each text line to its geometry row by normalized content. */
  private matchRows(lines: string[], geo: GeoRow[]): Array<GeoRow | undefined> {
    const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, '');
    const rowOf: Array<GeoRow | undefined> = new Array(lines.length);
    const used = new Set<number>();
    let cursor = 0;
    for (let i = 0; i < lines.length; i++) {
      const target = norm(lines[i]!.trim());
      if (!target) continue;
      let best = -1;
      let bestScore = 0;
      const limit = Math.min(geo.length, cursor + 12);
      for (let g = cursor; g < limit; g++) {
        if (used.has(g)) continue;
        const a = norm(geo[g]!.text);
        if (!a) continue;
        let score: number;
        if (a === target) {
          score = 1000;
        } else {
          let k = 0;
          const m = Math.min(a.length, target.length);
          while (k < m && a[k] === target[k]) k++;
          score = k / Math.max(a.length, target.length);
          if (a.includes(target) || target.includes(a)) score = Math.max(score, 700);
        }
        if (score > bestScore) {
          bestScore = score;
          best = g;
        }
        if (score >= 1000) break;
      }
      if (best !== -1 && bestScore >= 0.6) {
        rowOf[i] = geo[best];
        used.add(best);
        cursor = best + 1;
      }
    }
    return rowOf;
  }

  /**
   * True when the line text is a single glyph that a brace is commonly
   * misread as. Multi-character lines and real braces are excluded.
   */
  private isSingleSuspiciousGlyph(content: string): boolean {
    if (content.length !== 1) return false;
    return '410[(|\\lIijJ?`\'!~2'.includes(content);
  }

  /** Block headers that legitimately open a `{` on their own line. */
  private isBlockHeader(prefix: string): boolean {
    if (/\)\s*$/.test(prefix)) return true;
    if (/^(else|do|try|finally|switch|default:)$/.test(prefix)) return true;
    if (/^(class|interface|struct|enum|namespace|record)\b.*$/.test(prefix)) return true;
    return false;
  }

  /**
   * True when the nearest non-blank line above `i` is a block header that does
   * not already carry a `{`, and its left margin matches this line's.
   */
  private isBelowBlockHeader(
    i: number,
    lines: string[],
    rowOf: Array<GeoRow | undefined>,
    charWidth: number
  ): boolean {
    let j = i - 1;
    let skipped = 0;
    while (j >= 0 && skipped <= 1) {
      if (lines[j]!.trim()) break;
      skipped++;
      j--;
    }
    if (j < 0) return false;

    const header = lines[j]!.trim();
    if (!this.isBlockHeader(header)) return false;
    if (header.includes('{')) return false;

    const my = rowOf[i];
    const above = rowOf[j];
    if (!my || !above || my.x === undefined || above.x === undefined) return false;
    return Math.abs(my.x - above.x) <= charWidth * 0.5;
  }
}

export const braceRecovery = new BraceRecovery();
