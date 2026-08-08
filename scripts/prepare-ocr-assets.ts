import { copyFileSync, mkdirSync, existsSync, statSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PUBLIC_TESSDATA = resolve(ROOT, 'public', 'tessdata');

const TESSERACT_JS = resolve(ROOT, 'node_modules', 'tesseract.js');
const TESSERACT_CORE = resolve(ROOT, 'node_modules', 'tesseract.js-core');

const FILES_TO_COPY = [
  { src: resolve(TESSERACT_JS, 'dist', 'worker.min.js'), dest: 'worker.min.js' },
  { src: resolve(TESSERACT_CORE, 'tesseract-core-simd-lstm.wasm.js'), dest: 'tesseract-core-simd-lstm.wasm.js' },
  { src: resolve(TESSERACT_CORE, 'tesseract-core-simd-lstm.wasm'), dest: 'tesseract-core-simd-lstm.wasm' },
  { src: resolve(TESSERACT_CORE, 'tesseract-core-relaxedsimd-lstm.wasm.js'), dest: 'tesseract-core-relaxedsimd-lstm.wasm.js' },
  { src: resolve(TESSERACT_CORE, 'tesseract-core-relaxedsimd-lstm.wasm'), dest: 'tesseract-core-relaxedsimd-lstm.wasm' },
];

async function downloadTraineddata(): Promise<void> {
  const dest = resolve(PUBLIC_TESSDATA, 'eng.traineddata');
  if (existsSync(dest)) {
    console.log('eng.traineddata already exists, skipping download');
    return;
  }
  const url = 'https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata';
  console.log('Downloading eng.traineddata...');
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  writeFileSync(dest, buffer);
  console.log(`Downloaded eng.traineddata (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
}

function copyFiles(): void {
  if (!existsSync(PUBLIC_TESSDATA)) {
    mkdirSync(PUBLIC_TESSDATA, { recursive: true });
  }

  for (const { src, dest } of FILES_TO_COPY) {
    const destPath = resolve(PUBLIC_TESSDATA, dest);
    if (existsSync(src)) {
      copyFileSync(src, destPath);
      const size = statSync(src).size;
      console.log(`Copied ${dest} (${(size / 1024).toFixed(0)} KB)`);
    } else {
      console.warn(`WARNING: Source not found: ${src}`);
    }
  }
}

async function main(): Promise<void> {
  console.log('Preparing OCR assets...');
  copyFiles();
  await downloadTraineddata();
  console.log('Done. OCR assets ready in public/tessdata/');
}

main().catch(err => {
  console.error('prepare-ocr-assets failed:', err);
  process.exit(1);
});
