import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OCRManager } from '../../../services/ocr/OCRManager';
import { decodeDataUrl } from '../../../services/ocr/image';
import type { OCRProvider } from '../../../services/ocr/providers/OCRProvider';
import type { OcrResult } from '@type/index';

vi.mock('../../../services/ocr/image', () => ({
  decodeDataUrl: vi.fn(),
  dataUrlToBlob: vi.fn(),
}));

const mockDecode = vi.mocked(decodeDataUrl);

type Buffer = { data: Uint8ClampedArray; width: number; height: number };
type Rect = { x: number; y: number; w: number; h: number };

function makeBuffer(width: number, height: number, rects: Rect[]): Buffer {
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

function monoRow(y: number, margin: number, glyphW: number, glyphH: number, gap: number, nGlyphs: number, symbolEvery = 0): Rect[] {
  const rects: Rect[] = [];
  let x = margin;
  for (let g = 0; g < nGlyphs; g++) {
    const isSymbol = symbolEvery > 0 && g % symbolEvery === 0;
    rects.push({ x, y, w: isSymbol ? 3 : glyphW, h: glyphH });
    x += (isSymbol ? 3 : glyphW) + gap;
  }
  return rects;
}

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** Synthesizes the ImageAnalyzer 'HIGH CODE' fixture. */
function codeImage(): Buffer {
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
  rows.forEach((r, i) => rects.push(...monoRow(12 + i * 28, r.margin, 12, 18, 3, r.n, r.symbol ?? 0)));
  return makeBuffer(640, 240, rects);
}

/** Synthesizes the ImageAnalyzer 'HIGH TEXT' fixture. */
function proseImage(): Buffer {
  const rand = lcg(7);
  const rects: Rect[] = [];
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
    let x = r.margin;
    for (let g = 0; g < r.n; g++) {
      const w = 5 + Math.round(rand() * 22);
      rects.push({ x, y: 10 + i * 28, w, h: r.h });
      x += w + 2 + Math.round(rand() * 6);
    }
  });
  return makeBuffer(640, 240, rects);
}

function makeResult(text: string, confidence: number, xOffset = 0): OcrResult {
  return {
    text,
    confidence,
    language: 'eng',
    duration: 10,
    blocks: text
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l, i) => ({ text: l, confidence, bbox: { x: xOffset, y: i * 20, width: 100, height: 18 } })),
  };
}

/** Clean, confident code result that passes the quality gate. */
function goodResult(): OcrResult {
  return makeResult('class Program {\n  static void Main() {\n    x();\n  }\n}\n', 95);
}

/** Fails the quality gate (multiple failure signals, low confidence). */
function poorResult(): OcrResult {
  return makeResult('class Program {\nstatic void Main( {\nx()\n}{\n', 47);
}

function fakeCodeProvider(opts: { result?: OcrResult; fail?: boolean } = {}): {
  provider: OCRProvider;
  recognize: ReturnType<typeof vi.fn>;
  ensureWarm: ReturnType<typeof vi.fn>;
  ready: boolean;
} {
  const recognize = vi.fn(async (_img: string) => {
    if (opts.fail) throw new Error('code engine failed');
    return opts.result ?? goodResult();
  });
  const ensureWarm = vi.fn();
  const provider: OCRProvider = {
    id: 'codeocr',
    initialize: async () => true,
    ensureWarm,
    whenReady: async () => true,
    isReady: () => true,
    isWarming: () => false,
    recognize,
    terminate: async () => {},
  };
  return { provider, recognize, ensureWarm, ready: true };
}

function fakeTesseract(opts: { result?: OcrResult; fail?: boolean } = {}) {
  const recognize = vi.fn(async (_img: string) => {
    if (opts.fail) throw new Error('tesseract failed');
    return opts.result ?? goodResult();
  });
  return { adapter: { isReady: () => true, recognize }, recognize };
}

beforeEach(() => {
  mockDecode.mockReset();
});

describe('OCRManager routing', () => {
  it('manual code mode always uses the code engine', async () => {
    mockDecode.mockResolvedValue(codeImage());
    const code = fakeCodeProvider();
    const tess = fakeTesseract();
    const mgr = new OCRManager({ mode: 'code', tesseract: tess.adapter, codeProvider: code.provider });
    const r = await mgr.recognize('data:image/png;base64,x');
    expect(code.recognize).toHaveBeenCalledTimes(1);
    expect(tess.recognize).not.toHaveBeenCalled();
    expect(r.engine?.provider).toBe('codeocr');
    expect(r.engine?.routeReason).toBe('manual-code');
  });

  it('manual code mode falls back to tesseract when code fails', async () => {
    mockDecode.mockResolvedValue(codeImage());
    const code = fakeCodeProvider({ fail: true });
    const tess = fakeTesseract();
    const mgr = new OCRManager({ mode: 'code', tesseract: tess.adapter, codeProvider: code.provider });
    const r = await mgr.recognize('data:image/png;base64,x');
    expect(code.recognize).toHaveBeenCalledTimes(1);
    expect(tess.recognize).toHaveBeenCalledTimes(1);
    expect(r.engine?.provider).toBe('tesseract');
    expect(r.engine?.fallbackUsed).toBe(true);
  });

  it('manual code mode rejects when both engines fail', async () => {
    mockDecode.mockResolvedValue(codeImage());
    const code = fakeCodeProvider({ fail: true });
    const tess = fakeTesseract({ fail: true });
    const mgr = new OCRManager({ mode: 'code', tesseract: tess.adapter, codeProvider: code.provider });
    await expect(mgr.recognize('data:image/png;base64,x')).rejects.toThrow(/both engines unavailable/);
  });

  it('manual text mode always uses tesseract, never the code engine', async () => {
    mockDecode.mockResolvedValue(codeImage());
    const code = fakeCodeProvider();
    const tess = fakeTesseract();
    const mgr = new OCRManager({ mode: 'text', tesseract: tess.adapter, codeProvider: code.provider });
    const r = await mgr.recognize('data:image/png;base64,x');
    expect(tess.recognize).toHaveBeenCalledTimes(1);
    expect(code.recognize).not.toHaveBeenCalled();
    expect(r.engine?.provider).toBe('tesseract');
    expect(r.engine?.routeReason).toBe('manual-text');
  });

  it('auto mode sends a HIGH CODE image to the code engine', async () => {
    mockDecode.mockResolvedValue(codeImage());
    const code = fakeCodeProvider();
    const tess = fakeTesseract();
    let info: any;
    const mgr = new OCRManager({ mode: 'auto', tesseract: tess.adapter, codeProvider: code.provider, onRoute: (i) => (info = i) });
    const r = await mgr.recognize('data:image/png;base64,x');
    expect(info?.codeScore).toBeGreaterThan(80);
    expect(r.engine?.provider).toBe('codeocr');
    expect(tess.recognize).not.toHaveBeenCalled();
  });

  it('auto mode sends a HIGH TEXT image to tesseract without retry', async () => {
    mockDecode.mockResolvedValue(proseImage());
    const code = fakeCodeProvider();
    const tess = fakeTesseract();
    const mgr = new OCRManager({ mode: 'auto', tesseract: tess.adapter, codeProvider: code.provider });
    const r = await mgr.recognize('data:image/png;base64,x');
    expect(tess.recognize).toHaveBeenCalledTimes(1);
    expect(code.recognize).not.toHaveBeenCalled();
    expect(r.engine?.provider).toBe('tesseract');
    expect(r.engine?.retried).toBe(false);
  });

  it('uncertain path does not retry when tesseract output is clean', async () => {
    mockDecode.mockResolvedValue(null);
    const code = fakeCodeProvider();
    const tess = fakeTesseract({ result: goodResult() });
    const mgr = new OCRManager({ mode: 'auto', tesseract: tess.adapter, codeProvider: code.provider });
    const r = await mgr.recognize('data:image/png;base64,x');
    expect(tess.recognize).toHaveBeenCalledTimes(1);
    expect(code.recognize).not.toHaveBeenCalled();
    expect(r.engine?.retried).toBe(false);
    expect(r.engine?.routeReason).toBe('uncertain');
  });

  it('uncertain path retries with the code engine once when quality is poor', async () => {
    mockDecode.mockResolvedValue(null);
    const code = fakeCodeProvider();
    const tess = fakeTesseract({ result: poorResult() });
    const mgr = new OCRManager({ mode: 'auto', tesseract: tess.adapter, codeProvider: code.provider });
    const r = await mgr.recognize('data:image/png;base64,x');
    expect(tess.recognize).toHaveBeenCalledTimes(1);
    expect(code.recognize).toHaveBeenCalledTimes(1);
    expect(r.engine?.provider).toBe('codeocr');
    expect(r.engine?.retried).toBe(true);
    expect(r.engine?.retryReason).toBeTruthy();
  });

  it('retries only once even when the second pass also fails', async () => {
    mockDecode.mockResolvedValue(null);
    const code = fakeCodeProvider({ fail: true });
    const tess = fakeTesseract({ result: poorResult() });
    const mgr = new OCRManager({ mode: 'auto', tesseract: tess.adapter, codeProvider: code.provider });
    const r = await mgr.recognize('data:image/png;base64,x');
    expect(tess.recognize).toHaveBeenCalledTimes(1);
    expect(code.recognize).toHaveBeenCalledTimes(1);
    expect(r.engine?.provider).toBe('tesseract');
    expect(r.engine?.retried).toBe(true);
  });

  it('tesseract failure on uncertain route falls back to the code engine', async () => {
    mockDecode.mockResolvedValue(null);
    const code = fakeCodeProvider();
    const tess = fakeTesseract({ fail: true });
    const mgr = new OCRManager({ mode: 'auto', tesseract: tess.adapter, codeProvider: code.provider });
    const r = await mgr.recognize('data:image/png;base64,x');
    expect(code.recognize).toHaveBeenCalledTimes(1);
    expect(r.engine?.provider).toBe('codeocr');
    expect(r.engine?.fallbackUsed).toBe(true);
    expect(r.engine?.retried).toBe(true);
  });

  it('rethrows the tesseract error when both engines fail on uncertain route', async () => {
    mockDecode.mockResolvedValue(null);
    const code = fakeCodeProvider({ fail: true });
    const tess = fakeTesseract({ fail: true });
    const mgr = new OCRManager({ mode: 'auto', tesseract: tess.adapter, codeProvider: code.provider });
    await expect(mgr.recognize('data:image/png;base64,x')).rejects.toThrow('tesseract failed');
  });

  it('does not prewarm when the signal is not code-like', async () => {
    mockDecode.mockResolvedValue(null);
    const code = fakeCodeProvider();
    const tess = fakeTesseract();
    const mgr = new OCRManager({ mode: 'auto', tesseract: tess.adapter, codeProvider: code.provider });
    await mgr.recognize('data:image/png;base64,x');
    expect(code.ensureWarm).not.toHaveBeenCalled();
  });
});
