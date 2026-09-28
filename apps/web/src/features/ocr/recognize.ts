import type { OcrLine } from '@shelf-life/shared';
import type { Worker as TesseractWorker } from 'tesseract.js';

/**
 * SRS 8.1 step 3: Tesseract.js (English, psm 6, LSTM only) in its own Web Worker. Everything loads
 * from /ocr/ on our origin; nothing (image or text) is sent anywhere (SEC-5). tesseract.js itself
 * is imported lazily so it isn't in the initial bundle (PERF-2).
 */
export type RecognizerProgress =
  | { phase: 'loading'; progress: number } // downloading/starting the engine (first scan: ~7 MB)
  | { phase: 'reading'; progress: number };

export type Recognizer = {
  read: (image: HTMLCanvasElement | OffscreenCanvas | Blob) => Promise<OcrLine[]>;
  terminate: () => Promise<void>;
};

export async function createRecognizer(
  onProgress: (p: RecognizerProgress) => void,
): Promise<Recognizer> {
  const { createWorker, OEM, PSM } = await import('tesseract.js');
  const base = new URL('/ocr/', window.location.origin).href;
  const worker: TesseractWorker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: `${base}worker.min.js`,
    corePath: `${base}core`,
    langPath: `${base}lang`,
    gzip: true,
    // The service worker caches /ocr/ (CacheFirst); don't keep a second copy in IndexedDB.
    cacheMethod: 'none',
    workerBlobURL: false,
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress({ phase: 'reading', progress: m.progress });
      else onProgress({ phase: 'loading', progress: m.progress });
    },
  });
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    preserve_interword_spaces: '1',
  });

  return {
    async read(image) {
      const { data } = await worker.recognize(image, {}, { blocks: true, text: false });
      return (data.blocks ?? []).flatMap((block) =>
        block.paragraphs.flatMap((paragraph) =>
          paragraph.lines.map((line) => ({
            text: line.text.replace(/\s+$/, ''),
            confidence: Math.max(0, Math.min(1, line.confidence / 100)),
          })),
        ),
      );
    },
    async terminate() {
      await worker.terminate();
    },
  };
}
