import type { OcrBlock } from '@type/index';

interface TesseractBBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface TesseractLine {
  text?: string;
  confidence?: number;
  bbox?: TesseractBBox;
}

interface TesseractParagraph {
  lines?: TesseractLine[];
}

interface TesseractBlock {
  text?: string;
  confidence?: number;
  bbox?: TesseractBBox;
  paragraphs?: TesseractParagraph[];
}

function toRegion(bbox: TesseractBBox): { x: number; y: number; width: number; height: number } {
  return {
    x: bbox.x0,
    y: bbox.y0,
    width: bbox.x1 - bbox.x0,
    height: bbox.y1 - bbox.y0,
  };
}

/**
 * tesseract.js v7 does not expose `data.lines`; the only structured output is
 * `data.blocks`, which is Tesseract's native nested JSON:
 *
 *   blocks[].paragraphs[].lines[]   (each line: { text, confidence, bbox })
 *
 * A whole code snippet usually lands in ONE block, whose bbox covers every
 * line, so indentation is invisible at the block level. Flattening to the
 * nested lines gives each text row its own bbox — the per-line x-offset is
 * exactly the editor's monospace indentation. Falls back to the block-level
 * entry when a block carries no nested lines.
 */
export function flattenTesseractBlocks(blocks: unknown[] | null | undefined): OcrBlock[] {
  const out: OcrBlock[] = [];
  for (const raw of blocks ?? []) {
    if (!raw || typeof raw !== 'object') continue;
    const b = raw as TesseractBlock;
    const paragraphs = b.paragraphs ?? [];
    if (paragraphs.length === 0) {
      if (b.text && b.bbox) {
        out.push({
          text: b.text,
          confidence: typeof b.confidence === 'number' ? b.confidence : 0,
          bbox: toRegion(b.bbox),
        });
      }
      continue;
    }
    for (const p of paragraphs) {
      for (const line of p.lines ?? []) {
        if (!line.text || !line.bbox) continue;
        out.push({
          text: line.text.replace(/\n/g, ''),
          confidence: typeof line.confidence === 'number' ? line.confidence : 0,
          bbox: toRegion(line.bbox),
        });
      }
    }
  }
  return out;
}
