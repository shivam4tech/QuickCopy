import { describe, it, expect } from 'vitest';
import {
  analyzeImageFeatures,
  computeTextCodeScores,
  extractLineBands,
  downsampleToLuma,
  otsuThreshold,
  distinctClusters,
} from '../../../../services/ocr/router/ImageAnalyzer';

type Rect = { x: number; y: number; w: number; h: number };

function makeBuffer(width: number, height: number, rects: Rect[]): { data: Uint8ClampedArray; width: number; height: number } {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (y < 0 || x < 0 || y >= height || x >= width) continue;
        const idx = (y * width + x) * 4;
        data[idx] = 20;
        data[idx + 1] = 20;
        data[idx + 2] = 20;
      }
    }
  }
  return { data, width, height };
}

/** Deterministic PRNG so fixtures are reproducible. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/**
 * Draw a monospace-like line: `nGlyphs` uniform blocks, a narrow symbol block
 * every `symbolEvery` glyphs. margin = left offset, glyphW = run width, gap = gap.
 */
function monoRow(
  y: number,
  margin: number,
  glyphW: number,
  glyphH: number,
  gap: number,
  nGlyphs: number,
  symbolEvery = 0,
): Rect[] {
  const rects: Rect[] = [];
  let x = margin;
  for (let g = 0; g < nGlyphs; g++) {
    const isSymbol = symbolEvery > 0 && g % symbolEvery === 0;
    rects.push({ x, y, w: isSymbol ? 3 : glyphW, h: glyphH });
    x += (isSymbol ? 3 : glyphW) + gap;
  }
  return rects;
}

/** Draw a proportional (wordy) line: variable-width runs at ragged margins. */
function proseRow(y: number, margin: number, glyphH: number, rand: () => number, nRuns: number): Rect[] {
  const rects: Rect[] = [];
  let x = margin;
  for (let g = 0; g < nRuns; g++) {
    const w = 5 + Math.round(rand() * 22);
    rects.push({ x, y, w, h: glyphH });
    x += w + 2 + Math.round(rand() * 6);
  }
  return rects;
}

const W = 640;
const H = 240;

function codeImage(): ReturnType<typeof makeBuffer> {
  const rects: Rect[] = [];
  const rows = [
    { margin: 10, n: 8 },
    { margin: 40, n: 12, symbol: 6 },
    { margin: 70, n: 13, symbol: 7 },
    { margin: 70, n: 11, symbol: 5 },
    { margin: 70, n: 9, symbol: 8 },
    { margin: 70, n: 10, symbol: 6 },
    { margin: 40, n: 3, symbol: 4 },
    { margin: 10, n: 3 },
  ];
  rows.forEach((r, i) => {
    rects.push(...monoRow(12 + i * 28, r.margin, 12, 18, 3, r.n, r.symbol ?? 0));
  });
  return makeBuffer(W, H, rects);
}

function proseImage(): ReturnType<typeof makeBuffer> {
  const rand = lcg(7);
  const rects: Rect[] = [];
  // Flush-left paragraph, proportional font, variable run widths, first line
  // indented (paragraph indent), no compact symbol runs.
  const rows = [
    { margin: 24, n: 6, h: 20 },
    { margin: 12, n: 8, h: 14 },
    { margin: 12, n: 5, h: 22 },
    { margin: 12, n: 9, h: 16 },
    { margin: 12, n: 7, h: 18 },
    { margin: 12, n: 6, h: 13 },
    { margin: 12, n: 8, h: 20 },
    { margin: 12, n: 5, h: 15 },
  ];
  rows.forEach((r, i) => {
    rects.push(...proseRow(10 + i * 28, r.margin, r.h, rand, r.n));
  });
  return makeBuffer(W, H, rects);
}

describe('downsampleToLuma', () => {
  it('downsamples large images while keeping longest side <= target', () => {
    const big = makeBuffer(2000, 1000, [{ x: 100, y: 100, w: 50, h: 50 }]);
    const { w, h } = downsampleToLuma(big);
    expect(Math.max(w, h)).toBe(512);
    expect(w / h).toBeCloseTo(2, 1);
  });
});

describe('otsuThreshold', () => {
  it('separates bimodal pixel distributions', () => {
    const luma = new Uint8ClampedArray(100);
    for (let i = 0; i < 80; i++) luma[i] = 240;
    for (let i = 80; i < 100; i++) luma[i] = 30;
    const t = otsuThreshold(luma);
    expect(t).toBeGreaterThanOrEqual(30);
    expect(t).toBeLessThan(240);
  });
});

describe('extractLineBands', () => {
  it('finds all text rows in a code-like image', () => {
    const img = codeImage();
    const { bands } = extractLineBands(img);
    expect(bands.length).toBe(8);
    expect(bands[0]!.firstCol).toBeLessThanOrEqual(12);
  });

  it('detects inverted (dark-theme) images', () => {
    // Invert a code image: light text on dark bg.
    const img = codeImage();
    const inverted = {
      width: img.width,
      height: img.height,
      data: new Uint8ClampedArray(img.data),
    };
    for (let i = 0; i < inverted.data.length; i += 4) {
      inverted.data[i] = 255 - inverted.data[i]!;
      inverted.data[i + 1] = 255 - inverted.data[i + 1]!;
      inverted.data[i + 2] = 255 - inverted.data[i + 2]!;
    }
    const { bands, inverted: wasInverted } = extractLineBands(inverted);
    expect(wasInverted).toBe(true);
    expect(bands.length).toBe(8);
  });
});

describe('distinctClusters', () => {
  it('groups values within tolerance', () => {
    expect(distinctClusters([10, 11, 40, 41, 70], 4)).toBe(3);
    expect(distinctClusters([], 4)).toBe(0);
    expect(distinctClusters([5, 6], 4)).toBe(1);
  });
});

describe('analyzeImageFeatures', () => {
  it('scores code higher than prose on structural signals', () => {
    const code = analyzeImageFeatures(codeImage());
    const prose = analyzeImageFeatures(proseImage());

    expect(code.indentGutterScore).toBeGreaterThan(prose.indentGutterScore);
    expect(code.lineRowCount).toBe(8);
    expect(code.avgRowHeightPx).toBeGreaterThan(8);
    expect(code.avgLineGapPx).toBeGreaterThan(0);
  });

  it('monospace runs are more uniform in code than prose', () => {
    const code = analyzeImageFeatures(codeImage());
    const prose = analyzeImageFeatures(proseImage());
    expect(code.monospaceScore).toBeGreaterThan(prose.monospaceScore);
    expect(code.symbolLikeRatio).toBeGreaterThan(prose.symbolLikeRatio);
  });

  it('returns zeroes for an empty image', () => {
    const empty = makeBuffer(100, 100, []);
    const f = analyzeImageFeatures(empty);
    expect(f.lineRowCount).toBe(0);
    expect(f.foregroundRatio).toBe(0);
    const { textScore, codeScore } = computeTextCodeScores(f);
    expect(textScore).toBe(0);
    expect(codeScore).toBe(0);
  });
});

describe('computeTextCodeScores', () => {
  it('flags code fixtures as HIGH CODE', () => {
    const features = analyzeImageFeatures(codeImage());
    const { textScore, codeScore } = computeTextCodeScores(features);
    expect(codeScore).toBeGreaterThan(80);
    expect(codeScore).toBeGreaterThan(textScore);
  });

  it('flags prose fixtures as HIGH TEXT', () => {
    const features = analyzeImageFeatures(proseImage());
    const { textScore, codeScore } = computeTextCodeScores(features);
    expect(textScore).toBeGreaterThan(codeScore);
    expect(codeScore).toBeLessThan(80);
  });});
