import type { PageRegion } from './regionMapper';

export interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
}

export interface PdfTextContent {
  items: PdfTextItem[];
}

export interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Axis-aligned bounding box of a text item in PDF user space.
 *
 * pdf.js text items carry a `transform` matrix
 * `[scaleX, skewY, skewX, scaleY, translateX, translateY]` mapping local
 * item space (0..width × 0..height) into page space:
 *   x' = tx + scaleX·x + skewX·y
 *   y' = ty + skewY·x + scaleY·y
 * We map the four corners and take the min/max, which stays correct for
 * rotated text.
 */
export function itemBBox(item: PdfTextItem): BBox {
  const [scaleX = 1, skewY = 0, skewX = 0, scaleY = 1, tx = 0, ty = 0] = item.transform;
  const w = item.width;
  const h = item.height;

  const corners: [number, number][] = [
    [tx, ty],
    [tx + scaleX * w, ty + skewY * w],
    [tx + skewX * h, ty + scaleY * h],
    [tx + scaleX * w + skewX * h, ty + skewY * w + scaleY * h],
  ];

  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);

  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  };
}

interface Candidate {
  item: PdfTextItem;
  bbox: BBox;
  cx: number;
  cy: number;
}

interface Line {
  cy: number;
  height: number;
  candidates: Candidate[];
  endsWithEol: boolean;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

/**
 * Extract the text whose item CENTERS fall inside the given page region.
 *
 * Center-in-region semantics mean dragging over a line selects the whole
 * line — the "copy this paragraph" mental model. Lines are grouped by
 * vertical center, ordered top-to-bottom then left-to-right, with column
 * breaks and paragraph gaps preserved:
 *
 *   - column break: horizontal gap between two items on the same line larger
 *     than 1.5× the line's median item width (multi-column engineering PDFs)
 *   - paragraph break: vertical gap between consecutive lines larger than
 *     1.2× the previous line's height
 *   - `hasEOL` from the parser forces a line break (sub/superscripts that
 *     share a vertical center still split correctly)
 *
 * Returns an empty string when no text covers the region — the caller then
 * falls back to OCR (scanned PDFs).
 */
export function extractTextInRegion(textContent: PdfTextContent, region: PageRegion): string {
  const candidates: Candidate[] = [];

  for (const item of textContent.items) {
    if (typeof item.str !== 'string' || item.str.length === 0) continue;
    const bbox = itemBBox(item);
    const cx = (bbox.x0 + bbox.x1) / 2;
    const cy = (bbox.y0 + bbox.y1) / 2;
    if (cx >= region.x0 && cx <= region.x1 && cy >= region.y0 && cy <= region.y1) {
      candidates.push({ item, bbox, cx, cy });
    }
  }

  if (candidates.length === 0) return '';

  candidates.sort((a, b) => a.cy - b.cy || a.cx - b.cx);

  const lines: Line[] = [];
  let lastEndedWithEol = false;
  for (const c of candidates) {
    const itemHeight = c.bbox.y1 - c.bbox.y0;
    let placed = false;
    if (!lastEndedWithEol) {
      for (const line of lines) {
        if (Math.abs(line.cy - c.cy) <= Math.max(line.height, itemHeight) * 0.5) {
          line.candidates.push(c);
          line.cy = (line.cy * (line.candidates.length - 1) + c.cy) / line.candidates.length;
          line.height = Math.max(line.height, itemHeight);
          placed = true;
          break;
        }
      }
    }
    if (!placed) {
      lines.push({ cy: c.cy, height: itemHeight, candidates: [c], endsWithEol: false });
    }
    lastEndedWithEol = c.item.hasEOL === true;
  }

  const pieces: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.candidates.length === 0) continue;
    line.candidates.sort((a, b) => a.cx - b.cx);

    line.endsWithEol = line.candidates.some((c) => c.item.hasEOL === true);

    const medianWidth = median(line.candidates.map((c) => c.item.width));
    const columnGapThreshold = Math.max(1.5 * medianWidth, 8);

    let lineText = '';
    let prev: Candidate | null = null;
    for (const c of line.candidates) {
      if (prev) {
        const gap = c.bbox.x0 - prev.bbox.x1;
        lineText += gap > columnGapThreshold ? '\n' : ' ';
      }
      lineText += c.item.str;
      prev = c;
    }
    pieces.push(lineText);

    if (i === lines.length - 1) continue;

    const next = lines[i + 1];
    if (!next || next.candidates.length === 0) continue;

    let separator = '\n';
    if (line.endsWithEol) {
      separator = '\n';
    } else {
      const lastCandidate = line.candidates[line.candidates.length - 1];
      const firstNext = next.candidates[0];
      if (lastCandidate && firstNext) {
        const verticalGap = firstNext.bbox.y0 - lastCandidate.bbox.y1;
        if (verticalGap > 1.2 * line.height) separator = '\n\n';
      }
    }
    pieces.push(separator);
  }

  return pieces.join('').replace(/\n{3,}/g, '\n\n').trimEnd();
}
