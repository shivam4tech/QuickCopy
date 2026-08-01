import type { FormattableBlock } from './types';

export interface IndentRecoveryResult {
  byLine: Map<number, number>;
  unit: number;
  confident: boolean;
}

interface GeoLine {
  text: string;
  x: number;
  y: number;
  cw: number | null;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Recovers indentation from OCR geometry instead of guessing from syntax.
 *
 * Code editors render indentation as a monospace x-offset per line, so the
 * relative x positions of OCR text rows are ground truth for how the code was
 * laid out. This class maps each OCR line back to a reconstructed line and
 * derives indent levels from the x-offsets, detecting the indent unit
 * (2/4/tab/etc.) along the way.
 */
export class IndentRecovery {
  recover(lines: string[], blocks: FormattableBlock[]): IndentRecoveryResult {
    const byLine = new Map<number, number>();

    // Flatten block/line geometry into one row per non-blank OCR text line.
    // Tesseract blocks group whole paragraphs, so line-level boxes (when the
    // OCR service provides them) give us the true per-line x-offsets.
    const geoLines: GeoLine[] = [];
    for (const b of blocks) {
      if (!b.bbox || !b.text || !b.text.trim()) continue;
      const visible = b.text.replace(/\s/g, '').length;
      const cw = visible >= 2 && b.bbox.width > 0 ? b.bbox.width / visible : null;
      for (const rawLine of b.text.split('\n')) {
        if (!rawLine.trim()) continue;
        geoLines.push({ text: rawLine.trim(), x: b.bbox.x, y: b.bbox.y, cw });
      }
    }

    if (geoLines.length < 2) {
      return { byLine, unit: 4, confident: false };
    }

    // Keep top-to-bottom order (stable; equal-y rows keep their given order).
    geoLines.sort((a, b) => a.y - b.y);

    // Match each OCR row to a reconstructed line by normalized content.
    const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, '');
    const used = new Set<number>();
    let cursor = 0;
    const matches: Array<{ lineIdx: number; geo: GeoLine }> = [];

    for (const geo of geoLines) {
      const target = norm(geo.text);
      if (!target) continue;
      let best = -1;
      let bestScore = 0;
      const limit = Math.min(lines.length, cursor + 12);
      for (let i = cursor; i < limit; i++) {
        if (used.has(i)) continue;
        const a = norm(lines[i]!.trim());
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
          best = i;
        }
        if (score >= 1000) break;
      }

      if (best !== -1 && bestScore >= 0.6) {
        matches.push({ lineIdx: best, geo });
        used.add(best);
        cursor = best + 1;
      }
    }

    const nonBlank = lines.filter((l) => l.trim().length > 0).length;
    if (matches.length < Math.max(3, Math.ceil(nonBlank * 0.35))) {
      return { byLine, unit: 4, confident: false };
    }

    // Median char width from the matched rows only (robust to wide outliers).
    const cwVals = matches
      .map((m) => m.geo.cw)
      .filter((cw): cw is number => cw !== null && cw > 4 && cw < 40);
    if (cwVals.length === 0) {
      return { byLine, unit: 4, confident: false };
    }
    const cw = this.median(cwVals);

    // The leftmost matched row is the base column; everything else is an
    // offset in character widths from there.
    const minX = Math.min(...matches.map((m) => m.geo.x));
    const raw = matches.map((m) => Math.max(0, (m.geo.x - minX) / cw));

    // Detect the unit from the positive indent values. Prefer the gcd of the
    // distinct offsets (handles 2/3/4/8-space indents); when char-width noise
    // collapses the gcd to 1 (e.g. [3, 7] instead of [4, 8]), fall back to the
    // spacing between the levels.
    const distinct = [...new Set(raw.filter((v) => v >= 1).map((v) => Math.round(v)))].sort(
      (a, b) => a - b
    );
    let unit = 4;
    if (distinct.length === 1) {
      unit = this.snapUnit(distinct[0]!);
    } else if (distinct.length > 1) {
      const g = distinct.reduce((a, b) => gcd(a, b));
      if (g >= 2 && g <= 8) {
        unit = g;
      } else {
        let minGap = Infinity;
        for (let i = 1; i < distinct.length; i++) {
          minGap = Math.min(minGap, distinct[i]! - distinct[i - 1]!);
        }
        if (minGap >= 2 && minGap <= 8) {
          unit = minGap;
        } else {
          const freq = new Map<number, number>();
          for (const v of raw) freq.set(Math.round(v), (freq.get(Math.round(v)) ?? 0) + 1);
          let bestVal = 4;
          let bestCount = 0;
          for (const [v, c] of freq) {
            if (v >= 2 && v <= 8 && c > bestCount) {
              bestCount = c;
              bestVal = v;
            }
          }
          unit = bestVal;
        }
      }
    }

    for (let i = 0; i < matches.length; i++) {
      const m = matches[i]!;
      const level = Math.min(20, Math.max(0, Math.round(raw[i]! / unit)));
      byLine.set(m.lineIdx, level);
    }

    return { byLine, unit, confident: true };
  }

  private median(arr: number[]): number {
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
  }

  /**
   * Keeps exact common indents (2/3/4/8); anything else snaps to the nearest
   * of 2/4/8 so a single noisy depth (e.g. 5 or 9 chars) does not render as a
   * bizarre indent width.
   */
  private snapUnit(v: number): number {
    if (v >= 2 && v <= 8 && (v === 2 || v === 3 || v === 4 || v === 8)) return v;
    const options = [2, 4, 8];
    let best = 4;
    let bestDist = Infinity;
    for (const o of options) {
      const d = Math.abs(v - o);
      if (d < bestDist) {
        bestDist = d;
        best = o;
      }
    }
    return best;
  }
}

export const indentRecovery = new IndentRecovery();
