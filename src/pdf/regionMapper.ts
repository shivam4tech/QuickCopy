import type { Region } from '@type/index';

export interface PageRegion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ViewportLike {
  convertToPdfPoint(x: number, y: number): number[];
}

/**
 * Convert a drag region (viewport CSS coordinates, as produced by the
 * OverlayManager) into PDF user-space coordinates for a rendered page.
 *
 * The canvas backing store may be device-pixel-ratio scaled, but its CSS box
 * is exactly the pdf.js viewport size, so client coordinates map 1:1 through
 * `viewport.convertToPdfPoint` after subtracting the canvas's offset.
 */
export function clientRegionToPageRegion(region: Region, rect: RectLike, viewport: ViewportLike): PageRegion {
  const left = Math.max(0, region.x - rect.left);
  const top = Math.max(0, region.y - rect.top);
  const right = Math.max(0, region.x + region.width - rect.left);
  const bottom = Math.max(0, region.y + region.height - rect.top);

  const [px0 = 0, py0 = 0] = viewport.convertToPdfPoint(left, top);
  const [px1 = 0, py1 = 0] = viewport.convertToPdfPoint(right, bottom);

  return {
    x0: Math.min(px0, px1),
    y0: Math.min(py0, py1),
    x1: Math.max(px0, px1),
    y1: Math.max(py0, py1),
  };
}
