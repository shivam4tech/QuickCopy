import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { deflateSync } from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SIZES = [16, 48, 128] as const;
const ICON_DIR = resolve(__dirname, '../public/icons');
const STORE_DIR = resolve(__dirname, '../store-assets');

type RGB = [number, number, number];
type RGBA = [number, number, number, number];

// --- palette ---------------------------------------------------------------

const BG_TOP: RGB = [46, 234, 168];
const BG_BOTTOM: RGB = [9, 105, 84];
const BOLT_TOP: RGB = [16, 185, 129];
const BOLT_BOTTOM: RGB = [4, 120, 87];
const WHITE: RGB = [255, 255, 255];

function lerp(a: RGB, b: RGB, t: number): RGB {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function blend(dst: RGB, src: RGB, alpha: number): RGB {
  return [
    src[0] * alpha + dst[0] * (1 - alpha),
    src[1] * alpha + dst[1] * (1 - alpha),
    src[2] * alpha + dst[2] * (1 - alpha),
  ];
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

// --- shapes ----------------------------------------------------------------

function roundRectContains(x: number, y: number, cx: number, cy: number, w: number, h: number, r: number): boolean {
  const hw = w / 2;
  const hh = h / 2;
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  if (dx > hw || dy > hh) return false;
  if (dx <= hw - r || dy <= hh - r) return true;
  const ex = dx - (hw - r);
  const ey = dy - (hh - r);
  return ex * ex + ey * ey <= r * r;
}

function polygonContains(x: number, y: number, pts: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i]![0];
    const yi = pts[i]![1];
    const xj = pts[j]![0];
    const yj = pts[j]![1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// --- the drawing -----------------------------------------------------------

// Lightning bolt, normalized to a [-0.5, 0.5] box (y down) — lucide-style zap.
const BOLT: Array<[number, number]> = [
  [0.0556, -0.5],
  [-0.5, 0.1],
  [0, 0.1],
  [-0.0556, 0.5],
  [0.5, -0.1],
  [0, -0.1],
];

function sample(x: number, y: number, s: number): RGBA {
  if (!roundRectContains(x, y, s / 2, s / 2, s, s, 0.23 * s)) {
    return [0, 0, 0, 0];
  }

  let c = lerp(BG_TOP, BG_BOTTOM, clamp01(y / s));
  c = blend(c, WHITE, clamp01(1 - y / (0.3 * s)) * 0.16); // top gloss
  c = blend(c, [0, 0, 0], clamp01((y / s - 0.55) / 0.45) * 0.14); // bottom shade

  const backCx = s / 2 + 0.055 * s;
  const backCy = s / 2 - 0.055 * s;
  const frontCx = s / 2 - 0.055 * s;
  const frontCy = s / 2 + 0.055 * s;
  const sheetW = 0.52 * s;
  const sheetH = 0.62 * s;

  if (roundRectContains(x, y, backCx, backCy, sheetW, sheetH, 0.08 * s)) {
    c = blend(c, WHITE, 0.5);
  }
  if (roundRectContains(x, y, frontCx, frontCy, sheetW, sheetH, 0.08 * s)) {
    c = WHITE;
  }

  const boltW = 0.3 * s;
  const boltH = 0.48 * s;
  const pts = BOLT.map(([bx, by]) => [frontCx + bx * boltW, frontCy + by * boltH] as [number, number]);
  if (polygonContains(x, y, pts)) {
    c = lerp(BOLT_TOP, BOLT_BOTTOM, clamp01((y - (frontCy - boltH / 2)) / boltH));
  }

  return [c[0], c[1], c[2], 255];
}

// --- PNG writer -------------------------------------------------------------

const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf.readUInt8(i)) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, 'ascii');
  const crcV = crc32(Buffer.concat([typeB, data]));
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crcV);
  return Buffer.concat([len, typeB, data, crcB]);
}

function makePNG(size: number): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Supersample for smooth edges: more samples at small sizes where each
  // pixel matters, fewer at large sizes where it is already dense.
  const samples = size <= 48 ? 4 : size <= 128 ? 3 : 2;

  const rows: Buffer[] = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          const c = sample(px, py, size);
          r += c[0];
          g += c[1];
          b += c[2];
          a += c[3];
        }
      }
      const n = samples * samples;
      const off = 1 + x * 4;
      row[off] = Math.round(r / n);
      row[off + 1] = Math.round(g / n);
      row[off + 2] = Math.round(b / n);
      row[off + 3] = Math.round(a / n);
    }
    rows.push(row);
  }

  const raw = Buffer.concat(rows);
  const compressed = deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function run(): void {
  mkdirSync(ICON_DIR, { recursive: true });

  for (const s of SIZES) {
    const png = makePNG(s);
    const path = resolve(ICON_DIR, `icon${s}.png`);
    writeFileSync(path, png);
    console.log(`Created ${path} (${png.length} bytes)`);
  }

  mkdirSync(STORE_DIR, { recursive: true });
  for (const s of [128, 512] as const) {
    const png = makePNG(s);
    const path = resolve(STORE_DIR, `store-icon-${s}.png`);
    writeFileSync(path, png);
    console.log(`Created ${path} (${png.length} bytes)`);
  }
}

run();
