import { describe, it, expect } from 'vitest';
import { clientRegionToPageRegion } from '../../pdf/regionMapper';
import type { Region } from '../../types/index';

function mockViewport(_width: number, height: number) {
  return {
    convertToPdfPoint: (x: number, y: number): [number, number] => [x, height - y],
  };
}

describe('clientRegionToPageRegion', () => {
  it('maps a region inside the canvas to PDF coordinates', () => {
    const region: Region = { x: 130, y: 100, width: 200, height: 50 };
    const rect = { left: 10, top: 40, width: 300, height: 400 };
    const viewport = mockViewport(300, 400);

    const page = clientRegionToPageRegion(region, rect, viewport);

    expect(page.x0).toBe(120);
    expect(page.x1).toBe(320);
    expect(page.y0).toBe(400 - 110); // (100 - 40) from top → flipped
    expect(page.y1).toBe(400 - 60);
    expect(page.y0).toBeLessThan(page.y1);
  });

  it('clamps negative offsets to the page edge', () => {
    const region: Region = { x: 5, y: 5, width: 50, height: 50 };
    const rect = { left: 10, top: 10, width: 300, height: 400 };
    const viewport = mockViewport(300, 400);

    const page = clientRegionToPageRegion(region, rect, viewport);

    expect(page.x0).toBe(0);
    expect(page.y1).toBe(400);
  });

  it('handles the fully flipped y-axis of PDF coordinates', () => {
    const region: Region = { x: 0, y: 0, width: 100, height: 50 };
    const rect = { left: 0, top: 0, width: 100, height: 100 };
    const viewport = mockViewport(100, 100);

    const page = clientRegionToPageRegion(region, rect, viewport);

    expect(page.y0).toBe(50);
    expect(page.y1).toBe(100);
  });
});
