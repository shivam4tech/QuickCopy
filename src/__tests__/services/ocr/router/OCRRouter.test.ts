import { describe, it, expect } from 'vitest';
import { planRoute, isCodeRoute, isUncertainRoute } from '../../../../services/ocr/router/OCRRouter';
import { analyzeImageFeatures } from '../../../../services/ocr/router/ImageAnalyzer';
import { computeTextCodeScores } from '../../../../services/ocr/router/ImageAnalyzer';

function scores(textScore: number, codeScore: number) {
  return { textScore, codeScore };
}

describe('planRoute', () => {
  it('manual code mode always routes to codeocr', () => {
    const d = planRoute('code', scores(90, 5));
    expect(d.provider).toBe('codeocr');
    expect(d.retryProvider).toBeNull();
    expect(d.reason).toBe('manual-code');
  });

  it('manual text mode always routes to tesseract', () => {
    const d = planRoute('text', scores(5, 90));
    expect(d.provider).toBe('tesseract');
    expect(d.retryProvider).toBeNull();
    expect(d.reason).toBe('manual-text');
  });

  it('auto routes high-code captures directly to codeocr', () => {
    const d = planRoute('auto', scores(30, 90));
    expect(isCodeRoute(d)).toBe(true);
    expect(d.reason).toBe('high-code');
    expect(d.retryProvider).toBeNull();
  });

  it('auto routes high-text captures directly to tesseract', () => {
    const d = planRoute('auto', scores(90, 20));
    expect(d.provider).toBe('tesseract');
    expect(d.retryProvider).toBeNull();
    expect(d.reason).toBe('high-text');
  });

  it('auto treats mid-band captures as uncertain: tesseract first, codeocr retry', () => {
    const d = planRoute('auto', scores(60, 60));
    expect(d.provider).toBe('tesseract');
    expect(d.retryProvider).toBe('codeocr');
    expect(isUncertainRoute(d)).toBe(true);
    expect(d.reason).toBe('uncertain');
  });

  it('debug mode routes identically to auto', () => {
    const d = planRoute('debug', scores(60, 60));
    expect(d.provider).toBe('tesseract');
    expect(d.retryProvider).toBe('codeocr');
  });

  it('real code fixture is a high-code route', () => {
    // Reconstruct a minimal code buffer (monospace, 3 tab stops).
    const W = 640;
    const H = 240;
    const data = new Uint8ClampedArray(W * H * 4).fill(255);
    const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
    const rows = [10, 40, 70, 70, 70, 70, 40, 10];
    rows.forEach((margin, i) => {
      let x = margin;
      for (let g = 0; g < 10; g++) {
        const sym = g % 6 === 0;
        rects.push({ x, y: 12 + i * 28, w: sym ? 3 : 12, h: 18 });
        x += (sym ? 3 : 12) + 3;
      }
    });
    for (const r of rects) {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          const idx = (y * W + x) * 4;
          data[idx] = 20;
          data[idx + 1] = 20;
          data[idx + 2] = 20;
        }
      }
    }
    const f = analyzeImageFeatures({ data, width: W, height: H });
    const { textScore, codeScore } = computeTextCodeScores(f);
    const d = planRoute('auto', { textScore, codeScore });
    expect(codeScore).toBeGreaterThan(80);
    expect(isCodeRoute(d)).toBe(true);
    expect(textScore).toBeLessThan(codeScore);
  });
});
