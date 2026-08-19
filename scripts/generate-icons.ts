import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { deflateSync, inflateSync } from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SIZES = [16, 32, 48, 128] as const;
const STORE_SIZES = [128, 512] as const;
const ICON_DIR = resolve(__dirname, '../public/icons');
const STORE_DIR = resolve(__dirname, '../store-assets');
const SOURCE = resolve(__dirname, '../assets/ekadanta.png');

// --- minimal PNG decode (RGB / RGBA, 8-bit, non-interlaced) -----------------

interface DecodedPng {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, top-down rows */
  data: Buffer;
}

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

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function unfilterRow(filter: number, row: Buffer, prev: Buffer, bpp: number): void {
  for (let i = 0; i < row.length; i++) {
    const left = i >= bpp ? row[i - bpp]! : 0;
    const up = prev[i] ?? 0;
    const ul = i >= bpp ? (prev[i - bpp] ?? 0) : 0;
    let v = row[i]!;
    switch (filter) {
      case 0:
        break;
      case 1:
        v += left;
        break;
      case 2:
        v += up;
        break;
      case 3:
        v += (left + up) >> 1;
        break;
      case 4:
        v += paeth(left, up, ul);
        break;
      default:
        throw new Error(`Unsupported PNG row filter: ${filter}`);
    }
    row[i] = v & 0xff;
  }
}

function readPNG(filePath: string): DecodedPng {
  const buf = readFileSync(filePath);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${filePath} is not a PNG`);

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];

  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8]!;
      colorType = data[9]!;
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + len;
  }

  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Unsupported PNG format: bit depth ${bitDepth}, color type ${colorType} (want 8-bit RGB/RGBA)`);
  }

  const bpp = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(width * height * 4);
  const prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]!;
    const row = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    unfilterRow(f, row, prev, bpp);
    for (let x = 0; x < width; x++) {
      const si = x * bpp;
      const di = (y * width + x) * 4;
      out[di] = row[si]!;
      out[di + 1] = row[si + 1]!;
      out[di + 2] = row[si + 2]!;
      out[di + 3] = colorType === 6 ? row[si + 3]! : 255;
    }
    row.copy(prev);
  }

  return { width, height, data: out };
}

// --- high-quality downscale (box/area-average) ------------------------------

function resize(
  src: Buffer,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Buffer {
  const out = Buffer.alloc(dstW * dstH * 4);
  const sx = srcW / dstW;
  const sy = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    const y0 = y * sy;
    const y1 = Math.min(srcH, (y + 1) * sy);
    for (let x = 0; x < dstW; x++) {
      const x0 = x * sx;
      const x1 = Math.min(srcW, (x + 1) * sx);
      let r = 0, g = 0, b = 0, a = 0;

      const yi0 = Math.floor(y0);
      const yi1 = Math.floor(y1);
      const xi0 = Math.floor(x0);
      const xi1 = Math.floor(x1);

      for (let yi = yi0; yi < yi1; yi++) {
        const yOverlap = (Math.min(yi + 1, y1) - Math.max(yi, y0)) / sy;
        for (let xi = xi0; xi < xi1; xi++) {
          const xOverlap = (Math.min(xi + 1, x1) - Math.max(xi, x0)) / sx;
          const w = xOverlap * yOverlap;
          const si = (yi * srcW + xi) * 4;
          r += src[si]! * w;
          g += src[si + 1]! * w;
          b += src[si + 2]! * w;
          a += src[si + 3]! * w;
        }
      }

      const di = (y * dstW + x) * 4;
      out[di] = Math.round(r);
      out[di + 1] = Math.round(g);
      out[di + 2] = Math.round(b);
      out[di + 3] = Math.round(a);
    }
  }

  return out;
}

// --- PNG writer (RGBA) ------------------------------------------------------

function makePNG(width: number, height: number, pixels: Buffer): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    pixels.copy(row, 1, y * width * 4, (y + 1) * width * 4);
    rows.push(row);
  }

  const compressed = deflateSync(Buffer.concat(rows));
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

function run(): void {
  const src = readPNG(SOURCE);
  console.log(`Loaded ${SOURCE} (${src.width}x${src.height})`);

  mkdirSync(ICON_DIR, { recursive: true });
  for (const s of SIZES) {
    const resized = resize(src.data, src.width, src.height, s, s);
    const png = makePNG(s, s, resized);
    const path = resolve(ICON_DIR, `icon${s}.png`);
    writeFileSync(path, png);
    console.log(`Created ${path} (${png.length} bytes)`);
  }

  mkdirSync(STORE_DIR, { recursive: true });
  for (const s of STORE_SIZES) {
    const resized = resize(src.data, src.width, src.height, s, s);
    const png = makePNG(s, s, resized);
    const path = resolve(STORE_DIR, `store-icon-${s}.png`);
    writeFileSync(path, png);
    console.log(`Created ${path} (${png.length} bytes)`);
  }
}

run();