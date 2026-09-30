import { parseReceipt, todayIso, type OcrLine, type ParsedReceipt } from '@shelf-life/shared';
import { heicToJpeg, isHeic } from './heic';
import type { PreprocessResponse } from './preprocess.worker';
import { createRecognizer, type Recognizer } from './recognize';

/** SCN-3 steps, in order. */
export const SCAN_STEPS = ['clean', 'read', 'match', 'expiry'] as const;
export type ScanStep = (typeof SCAN_STEPS)[number];
export type StepState = 'todo' | 'active' | 'done';

export type ScanProgress = {
  percent: number;
  steps: Record<ScanStep, StepState>;
  /** Filled once text is read ("Found 14 lines"). */
  lineCount: number | null;
  /** True while the OCR engine is downloading/starting (first scan only takes long). */
  preparing: boolean;
};

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
export const MAX_BYTES = 15 * 1024 * 1024;

export class ScanError extends Error {
  constructor(
    readonly code: 'type' | 'size' | 'unreadable' | 'failed',
    message: string,
  ) {
    super(message);
  }
}

/** SCN-2: JPG, PNG or HEIC up to 15 MB. Camera captures are JPEG blobs. */
export function validateImage(file: Blob & { name?: string }): void {
  const typeOk =
    ACCEPTED_TYPES.includes(file.type.toLowerCase()) ||
    isHeic(file) ||
    /\.(jpe?g|png)$/i.test(file.name ?? '');
  if (!typeOk) throw new ScanError('type', 'Choose a JPG, PNG or HEIC photo.');
  if (file.size > MAX_BYTES)
    throw new ScanError('size', 'That photo is over 15 MB. Try a smaller one.');
}

const initialSteps = (): Record<ScanStep, StepState> => ({
  clean: 'active',
  read: 'todo',
  match: 'todo',
  expiry: 'todo',
});

/** Runs the clean-up worker; falls back to plain downscaling where OffscreenCanvas is missing. */
async function preprocess(
  bitmap: ImageBitmap,
  signal: AbortSignal,
): Promise<{ canvas: HTMLCanvasElement; dispose: () => void }> {
  const canvas = document.createElement('canvas');
  const dispose = () => {
    canvas.width = canvas.height = 0;
  };
  if (typeof OffscreenCanvas === 'undefined') {
    // Older Safari: no OffscreenCanvas in workers. Send the downscaled photo; Tesseract binarizes it.
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return { canvas, dispose };
  }
  const worker = new Worker(new URL('./preprocess.worker.ts', import.meta.url), { type: 'module' });
  try {
    const result = await new Promise<PreprocessResponse>((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), {
        once: true,
      });
      worker.onmessage = (e: MessageEvent<PreprocessResponse>) => resolve(e.data);
      worker.onerror = (e) => reject(new ScanError('failed', e.message || 'Clean-up failed'));
      worker.postMessage({ bitmap }, [bitmap]);
    });
    if (!result.ok) throw new ScanError('failed', result.message);
    canvas.width = result.width;
    canvas.height = result.height;
    canvas
      .getContext('2d')!
      .putImageData(
        new ImageData(new Uint8ClampedArray(result.rgba), result.width, result.height),
        0,
        0,
      );
    return { canvas, dispose };
  } finally {
    worker.terminate();
  }
}

/**
 * Scan a receipt photo on this device (SRS 8.1, 8.2, 8.3). Reports SCN-3 progress, stops when
 * `signal` aborts (SCN-4), throws ScanError('unreadable') when fewer than 2 lines are read
 * (SCN-7). The photo is discarded as soon as it has been read (SEC-5): the bitmap is closed, the
 * canvas emptied, and only text lines leave this function.
 */
export async function runScan(
  file: Blob & { name?: string },
  opts: {
    signal: AbortSignal;
    onProgress: (p: ScanProgress) => void;
    today?: string;
    /** The raw OCR lines, for the labeled accuracy set (tests/receipts). Text only. */
    onLines?: (lines: OcrLine[]) => void;
  },
): Promise<ParsedReceipt> {
  const { signal, onProgress } = opts;
  const state: ScanProgress = {
    percent: 0,
    steps: initialSteps(),
    lineCount: null,
    preparing: false,
  };
  const emit = (patch: Partial<ScanProgress>) => {
    Object.assign(state, patch);
    onProgress({ ...state, steps: { ...state.steps } });
  };
  const checkAborted = () => {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  };

  validateImage(file);
  emit({});

  // Start the OCR engine straight away so its download overlaps the clean-up.
  let recognizer: Recognizer | null = null;
  const recognizerReady = createRecognizer((p) => {
    if (p.phase === 'loading') emit({ preparing: p.progress < 1 });
    else emit({ preparing: false, percent: Math.round(15 + p.progress * 65) });
  }).then((r) => (recognizer = r));
  recognizerReady.catch(() => undefined);
  const stop = () => void recognizer?.terminate();
  signal.addEventListener('abort', stop, { once: true });

  let dispose = () => {};
  try {
    const jpeg = isHeic(file) ? await heicToJpeg(file) : file;
    checkAborted();
    // imageOrientation applies the photo's EXIF rotation.
    const bitmap = await createImageBitmap(jpeg, { imageOrientation: 'from-image' });
    checkAborted();
    const cleaned = await preprocess(bitmap, signal);
    dispose = cleaned.dispose;
    emit({ percent: 15, steps: { ...state.steps, clean: 'done', read: 'active' } });

    const ocr = await recognizerReady;
    checkAborted();
    const lines: OcrLine[] = await ocr.read(cleaned.canvas);
    dispose();
    opts.onLines?.(lines);
    checkAborted();
    const readable = lines.filter((l) => /[a-z]{2,}/i.test(l.text));
    if (readable.length < 2) throw new ScanError('unreadable', "We couldn't read this receipt");
    emit({
      percent: 80,
      lineCount: readable.length,
      steps: { ...state.steps, read: 'done', match: 'active' },
    });

    const receipt = parseReceipt(lines, opts.today ?? todayIso());
    emit({ percent: 92, steps: { ...state.steps, match: 'done', expiry: 'active' } });
    emit({ percent: 100, steps: { ...state.steps, expiry: 'done' } });
    return receipt;
  } finally {
    dispose();
    signal.removeEventListener('abort', stop);
    await recognizerReady.then((r) => r.terminate()).catch(() => undefined);
  }
}
