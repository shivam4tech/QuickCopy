import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { deflateSync } from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SIZES = [16, 48, 128] as const;
const ICON_DIR = resolve(__dirname, '../public/icons');

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
    const byteVal = buf.readUInt8(i);
    const idx = (crc ^ byteVal) & 0xff;
    crc = crcTable[idx]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeB, data]);
  const crcV = crc32(crcInput);
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

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.4;
  const innerR = size * 0.22;

  const rows: Buffer[] = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const off = 1 + x * 4;

      if (dist <= r) {
        row[off] = 88;
        row[off + 1] = 166;
        row[off + 2] = 255;
        row[off + 3] = 255;

        if (dist <= innerR) {
          row[off] = 255;
          row[off + 1] = 255;
          row[off + 2] = 255;
          row[off + 3] = 255;
        }
      } else {
        row[off] = 0;
        row[off + 1] = 0;
        row[off + 2] = 0;
        row[off + 3] = 0;
      }
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
}

run();
