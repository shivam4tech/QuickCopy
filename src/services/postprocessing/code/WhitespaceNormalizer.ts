import type { IndentStyle } from './types';

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export class WhitespaceNormalizer {
  normalize(text: string): string {
    const lines = text.split(/\r\n|\r|\n/);
    const out: string[] = [];

    for (const line of lines) {
      const trimmed = line.replace(/[ \t]+$/, '');
      if (trimmed === '') {
        if (out.length > 0 && out[out.length - 1] !== '') {
          out.push('');
        }
      } else {
        out.push(trimmed);
      }
    }

    // Drop leading blank lines.
    while (out.length > 0 && out[0] === '') {
      out.shift();
    }

    return out.join('\n');
  }

  detectIndentStyle(lines: string[]): IndentStyle {
    const widths: number[] = [];
    let tabIndented = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      const tabMatch = line.match(/^\t+/);
      if (tabMatch) {
        tabIndented++;
      }
      const leading = line.match(/^[ \t]+/);
      if (leading) {
        let w = 0;
        for (const ch of leading[0]) {
          w += ch === '\t' ? 4 : 1;
        }
        widths.push(w);
      }
    }

    const diffs: number[] = [];
    for (let i = 1; i < widths.length; i++) {
      const d = widths[i]! - widths[i - 1]!;
      if (d > 0) diffs.push(d);
    }

    let unit = 4;
    if (diffs.length > 0) {
      const sorted = [...new Set(diffs)].sort((a, b) => a - b);
      let g = sorted[0]!;
      for (const v of sorted) g = gcd(g, v);
      if (g >= 2 && g <= 8) {
        unit = g;
      } else {
        const freq = new Map<number, number>();
        for (const v of sorted) freq.set(v, (freq.get(v) ?? 0) + 1);
        let best = sorted[0]!;
        let bestCount = 0;
        for (const [v, c] of freq) {
          if (c > bestCount) {
            bestCount = c;
            best = v;
          }
        }
        if (best >= 2 && best <= 8) unit = best;
      }
    } else {
      const positive = widths.filter((w) => w > 0);
      if (positive.length > 0) {
        const freq = new Map<number, number>();
        for (const w of positive) freq.set(w, (freq.get(w) ?? 0) + 1);
        let best = positive[0]!;
        let bestCount = 0;
        for (const [w, c] of freq) {
          if (c > bestCount) {
            bestCount = c;
            best = w;
          }
        }
        if (best >= 2 && best <= 8) unit = best;
      }
    }

    const useTabs = tabIndented >= 2;
    return { unit, useTabs };
  }
}

export const whitespaceNormalizer = new WhitespaceNormalizer();
