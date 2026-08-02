/**
 * Stage-1 image analysis for the OCR router.
 *
 * This module performs NO OCR. It decodes the captured region into RGBA
 * pixels once, downsamples, binarizes, and extracts cheap structural features
 * (aligned text rows, left-margin alignment, indentation gutters, monospace
 * probability, symbol density). These features feed the text/code decision in
 * OCRRouter.
 *
 * The pure analysis operates on raw RGBA so it can be unit-tested with
 * synthetic fixtures in Node (no canvas required).
 */

export interface AnalyzerInput {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface ImageFeatures {
  width: number;
  height: number;
  aspectRatio: number;
  /** fraction of pixels that are foreground (text) */
  foregroundRatio: number;
  /** number of detected horizontal text-line bands */
  lineRowCount: number;
  /** median text-line height in source pixels */
  avgRowHeightPx: number;
  /** median gap between line bands in source pixels */
  avgLineGapPx: number;
  /** 0..1 — few distinct left margins => code-like */
  leftMarginAlignScore: number;
  /** 0..1 — consistent leading whitespace gutters => code-like */
  indentGutterScore: number;
  /** 0..1 — uniform glyph run widths => monospace */
  monospaceScore: number;
  /** 0..1 — fraction of glyph runs that are compact/symbol-like */
  symbolLikeRatio: number;
}

const TARGET_MIN_DIM = 512;

/** Otsu threshold on a luma histogram; returns -1 when all pixels equal. */
export function otsuThreshold(luma: Uint8ClampedArray): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < luma.length; i++) hist[luma[i]!]!++;
  let total = luma.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i]!;
  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let threshold = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return maxVar <= 0 ? -1 : threshold;
}

interface Downsampled {
  w: number;
  h: number;
  luma: Uint8ClampedArray;
  scale: number;
}

/** Downsample RGBA to luminance, keeping the longest side <= TARGET_MIN_DIM. */
export function downsampleToLuma(input: AnalyzerInput): Downsampled {
  const { width, height, data } = input;
  const scale = Math.max(width, height) / TARGET_MIN_DIM;
  const factor = scale > 1 ? scale : 1;
  const w = Math.max(1, Math.round(width / factor));
  const h = Math.max(1, Math.round(height / factor));
  const luma = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(height - 1, Math.round(y * factor));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(width - 1, Math.round(x * factor));
      const idx = (sy * width + sx) * 4;
      const r = data[idx]!;
      const g = data[idx + 1]!;
      const b = data[idx + 2]!;
      luma[y * w + x] = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
    }
  }
  return { w, h, luma, scale: factor };
}

export interface LineBand {
  y0: number;
  y1: number;
  firstCol: number;
  lastCol: number;
  leadingSpaces: number;
  /** widths of internal dark-column runs (glyph/symbol runs), in downsampled px */
  runWidths: number[];
}

/** Binarize (minority = text) and extract horizontal line bands. */
export function extractLineBands(input: AnalyzerInput): { bands: LineBand[]; foregroundRatio: number; inverted: boolean } {
  const { w, h, luma } = downsampleToLuma(input);
  const threshold = otsuThreshold(luma);
  if (threshold < 0) return { bands: [], foregroundRatio: 0, inverted: false };

  const dark = new Uint8Array(w * h);
  let lowCount = 0;
  let highCount = 0;
  for (let i = 0; i < luma.length; i++) {
    if (luma[i]! <= threshold) lowCount++;
    else highCount++;
  }
  // Text is the minority class. Dark-on-light (luma below threshold) or
  // light-on-dark (luma above threshold) — pick whichever has fewer pixels so
  // dark-theme IDE screenshots are handled.
  const useLow = lowCount <= highCount;
  const mask = dark;
  for (let i = 0; i < luma.length; i++) {
    if (useLow ? luma[i]! <= threshold : luma[i]! > threshold) mask[i] = 1;
  }
  const foregroundRatio = Math.min(lowCount, highCount) / luma.length;
  const inverted = !useLow;

  const rowCount = new Uint16Array(h);
  for (let y = 0; y < h; y++) {
    let n = 0;
    const row = y * w;
    for (let x = 0; x < w; x++) n += mask[row + x]!;
    rowCount[y] = n;
  }

  const minDarkPerRow = Math.max(2, Math.round(w * 0.02));
  const bands: LineBand[] = [];
  let y = 0;
  while (y < h) {
    if (rowCount[y]! >= minDarkPerRow) {
      const y0 = y;
      let y1 = y;
      while (y1 + 1 < h && rowCount[y1 + 1]! >= minDarkPerRow) y1++;
      let firstCol = w;
      let lastCol = -1;
      for (let ry = y0; ry <= y1; ry++) {
        const row = ry * w;
        for (let x = 0; x < w; x++) {
          if (mask[row + x]) {
            if (x < firstCol) firstCol = x;
            if (x > lastCol) lastCol = x;
          }
        }
      }
      bands.push({
        y0,
        y1,
        firstCol,
        lastCol: lastCol < 0 ? w - 1 : lastCol,
        leadingSpaces: firstCol,
        runWidths: [],
      });
      y = y1 + 1;
    } else {
      y++;
    }
  }

  // Merge bands separated by a single thin row (anti-aliasing splits).
  const merged: LineBand[] = [];
  for (const band of bands) {
    const prev = merged[merged.length - 1];
    if (prev && band.y0 - prev.y1 <= 2) {
      prev.y1 = band.y1;
      if (band.firstCol < prev.firstCol) prev.firstCol = band.firstCol;
      if (band.lastCol > prev.lastCol) prev.lastCol = band.lastCol;
      prev.leadingSpaces = prev.firstCol;
    } else {
      merged.push({ ...band, runWidths: [] });
    }
  }

  // Internal glyph-run widths per band (column projection, thresholded so
  // descenders/ascenders of a single glyph still register as one run).
  for (const band of merged) {
    const colDark = new Uint16Array(w);
    const bandHeight = band.y1 - band.y0 + 1;
    for (let ry = band.y0; ry <= band.y1; ry++) {
      const row = ry * w;
      for (let x = band.firstCol; x <= band.lastCol; x++) colDark[x]! += mask[row + x]!;
    }
    const colThreshold = Math.max(1, Math.floor(bandHeight * 0.5));
    const runs: number[] = [];
    let x = band.firstCol;
    while (x <= band.lastCol) {
      while (x <= band.lastCol && colDark[x]! < colThreshold) x++;
      if (x > band.lastCol) break;
      const start = x;
      while (x <= band.lastCol && colDark[x]! >= colThreshold) x++;
      runs.push(x - start);
    }
    band.runWidths = runs;
  }

  return { bands: merged, foregroundRatio, inverted };
}

/** Distinct-cluster count of a sorted array of column values (tolerance in px). */
export function distinctClusters(values: number[], tolerance: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  let clusters = 1;
  let clusterStart = sorted[0]!;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]! - clusterStart > tolerance) {
      clusters++;
      clusterStart = sorted[i]!;
    }
  }
  return clusters;
}

/** Cohesion of first-columns into few tight clusters; 0 (ragged) .. 1 (tab-stops). */
export function marginAlignmentScore(bands: LineBand[], tol: number): number {
  if (bands.length === 0) return 0;
  const cols = bands.map((b) => b.firstCol);
  const clusters = distinctClusters(cols, tol);
  if (clusters === 1) return 0.9;
  const score = 1 - (clusters - 1) / Math.max(3, bands.length);
  return Math.max(0, Math.min(1, score));
}

/**
 * Consistency of leading whitespace. A strong code gutter means lines repeat at
 * several regular tab-stop columns, each supported by multiple lines. Prose has
 * no such repeated structure (at most a one-line paragraph indent).
 */
export function indentGutterScore(bands: LineBand[], tol: number): number {
  if (bands.length < 2) return 0;
  const firstCols = bands.map((b) => b.firstCol).sort((a, b) => a - b);

  // Cluster first-columns into distinct levels.
  const levels: Array<{ center: number; count: number }> = [];
  for (const col of firstCols) {
    const last = levels[levels.length - 1];
    if (last && col - last.center <= tol) {
      last.center = (last.center * last.count + col) / (last.count + 1);
      last.count++;
    } else {
      levels.push({ center: col, count: 1 });
    }
  }
  if (levels.length < 2) return 0;

  const centers = levels.map((l) => l.center);
  const deltas: number[] = [];
  for (let i = 1; i < centers.length; i++) deltas.push(centers[i]! - centers[i - 1]!);
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const variance = deltas.reduce((a, b) => a + (b - mean) * (b - mean), 0) / deltas.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
  const regularity = Math.max(0, 1 - cv * 2);

  const minorityLevels = levels.slice(1);
  const supported = minorityLevels.filter((l) => l.count >= 2).length;
  const supportFactor = minorityLevels.length > 0 ? supported / minorityLevels.length : 0;

  const depthFactor = Math.min(1, levels.length / 4);
  const score = regularity * supportFactor * (0.5 + 0.5 * depthFactor);
  return Math.max(0, Math.min(1, score));
}

/** Monospace probability from glyph-run width uniformity (symbol runs ignored). */
export function monospaceScore(bands: LineBand[]): number {
  const widths = bands.flatMap((b) => b.runWidths).filter((w) => w > 3);
  if (widths.length === 0) return 0;
  const mean = widths.reduce((a, b) => a + b, 0) / widths.length;
  const variance = widths.reduce((a, b) => a + (b - mean) * (b - mean), 0) / widths.length;
  const cv = Math.sqrt(variance) / (mean || 1);
  return Math.max(0, 1 - cv * 2.2);
}

/** Fraction of glyph runs that are narrow/compact (symbol-like: { } ( ) ; = . , : < >). */
export function symbolLikeRatio(bands: LineBand[]): number {
  const widths = bands.flatMap((b) => b.runWidths).filter((w) => w > 0);
  if (widths.length === 0) return 0;
  const compact = widths.filter((w) => w <= 3).length;
  return compact / widths.length;
}

/**
 * Full feature extraction. Pure and cheap: single O(pixels) downsample pass
 * followed by a few small passes over the downsampled grid.
 */
export function analyzeImageFeatures(input: AnalyzerInput): ImageFeatures {
  const { w, scale } = downsampleToLuma(input);
  const { bands, foregroundRatio } = extractLineBands(input);

  const lineRowCount = bands.length;
  const heights = bands.map((b) => b.y1 - b.y0 + 1);
  const heightsSorted = [...heights].sort((a, b) => a - b);
  const avgRowHeightPx = Math.round((heightsSorted[Math.floor(heightsSorted.length / 2)] ?? 0) * scale);

  const gaps: number[] = [];
  for (let i = 1; i < bands.length; i++) gaps.push(bands[i]!.y0 - bands[i - 1]!.y1);
  const avgLineGapPx = gaps.length ? Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * scale) : 0;

  const tol = Math.max(1, Math.round(w * 0.03));
  const leftMarginAlignScore = marginAlignmentScore(bands, tol);
  const indent = indentGutterScore(bands, tol);
  const mono = monospaceScore(bands);
  const sym = symbolLikeRatio(bands);

  return {
    width: input.width,
    height: input.height,
    aspectRatio: input.height > 0 ? input.width / input.height : 1,
    foregroundRatio,
    lineRowCount,
    avgRowHeightPx,
    avgLineGapPx,
    leftMarginAlignScore,
    indentGutterScore: indent,
    monospaceScore: mono,
    symbolLikeRatio: sym,
  };
}

/**
 * Map features to the text/code decision. Returns 0..100 scores.
 * Band semantics (used by OCRRouter): score > 80 = HIGH, 40-80 = UNCERTAIN.
 */
export function computeTextCodeScores(features: ImageFeatures): { textScore: number; codeScore: number } {
  const rows = features.lineRowCount;

  // Presence of real text structure at all.
  const hasStructure = rows >= 2 ? 1 : rows === 1 ? 0.5 : 0;

  // Code favors: aligned margins, indent gutters, monospace, symbols.
  let codeScore = 0;
  codeScore += hasStructure * 20;
  codeScore += features.leftMarginAlignScore * 25;
  codeScore += features.indentGutterScore * 25;
  codeScore += features.monospaceScore * 20;
  codeScore += features.symbolLikeRatio * 15;
  codeScore = Math.round(Math.max(0, Math.min(100, codeScore)));

  // Text favors: structured rows that are NOT code-like (ragged margins,
  // proportional fonts, few symbols). Gated by structure so empty/noise images
  // don't score as "perfect prose".
  let textScore = 0;
  if (hasStructure > 0) {
    textScore += hasStructure * 25;
    textScore += (1 - features.leftMarginAlignScore) * 25;
    textScore += (1 - features.indentGutterScore) * 20;
    textScore += (1 - features.monospaceScore) * 20;
    textScore += (1 - features.symbolLikeRatio) * 15;
  }
  textScore = Math.round(Math.max(0, Math.min(100, textScore)));

  return { textScore, codeScore };
}
