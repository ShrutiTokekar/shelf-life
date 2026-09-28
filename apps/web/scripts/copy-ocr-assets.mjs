// Copies the Tesseract worker, engine and English model from node_modules into public/ocr/, so
// OCR loads from our own origin (no CDN; SRS 14.3, SEC-5). public/ocr/ is git-ignored.
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'ocr');

const tesseractDir = dirname(require.resolve('tesseract.js/package.json'));
const coreDir = dirname(
  require.resolve('tesseract.js-core/package.json', { paths: [tesseractDir] }),
);
const langDir = dirname(require.resolve('@tesseract.js-data/eng/package.json'));

const files = [
  [join(tesseractDir, 'dist', 'worker.min.js'), 'worker.min.js'],
  // LSTM-only engine builds; each device downloads just one (relaxed SIMD, SIMD, or plain).
  [
    join(coreDir, 'tesseract-core-relaxedsimd-lstm.wasm.js'),
    'core/tesseract-core-relaxedsimd-lstm.wasm.js',
  ],
  [join(coreDir, 'tesseract-core-simd-lstm.wasm.js'), 'core/tesseract-core-simd-lstm.wasm.js'],
  [join(coreDir, 'tesseract-core-lstm.wasm.js'), 'core/tesseract-core-lstm.wasm.js'],
  // English, LSTM integer model (smaller and faster than "best").
  [join(langDir, '4.0.0_best_int', 'eng.traineddata.gz'), 'lang/eng.traineddata.gz'],
];

await mkdir(join(out, 'core'), { recursive: true });
await mkdir(join(out, 'lang'), { recursive: true });
for (const [from, to] of files) {
  const dest = join(out, to);
  // Copy when missing or different (compare bytes, not just size, so an edited copy is restored).
  const [a, b] = await Promise.all([stat(from), stat(dest).catch(() => null)]);
  if (!b || b.size !== a.size || !(await readFile(from)).equals(await readFile(dest))) {
    await copyFile(from, dest);
  }
}
console.log('OCR assets ready in public/ocr/');
