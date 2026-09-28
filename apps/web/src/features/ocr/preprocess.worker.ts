/// <reference lib="webworker" />
import { cleanUp, scaledSize, toRgba } from './preprocess';

/**
 * SCN-4: photo clean-up off the main thread. Receives an ImageBitmap (transferred), draws it at
 * ≤ 2000 px, cleans it up and sends back black-and-white RGBA pixels (transferred). The bitmap is
 * closed here, so no copy of the photo survives in the worker.
 */
export type PreprocessRequest = { bitmap: ImageBitmap };
export type PreprocessResponse =
  | {
      ok: true;
      width: number;
      height: number;
      rgba: Uint8ClampedArray;
      cropped: boolean;
      skew: number;
    }
  | { ok: false; message: string };

self.onmessage = (event: MessageEvent<PreprocessRequest>) => {
  const { bitmap } = event.data;
  try {
    const { width, height } = scaledSize(bitmap.width, bitmap.height, 2000);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('No 2D context in worker');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const pixels = ctx.getImageData(0, 0, width, height).data;
    canvas.width = canvas.height = 0;
    const result = cleanUp(pixels, width, height);
    const rgba = toRgba(result.image);
    const response: PreprocessResponse = {
      ok: true,
      width: result.image.width,
      height: result.image.height,
      rgba,
      cropped: result.cropped,
      skew: result.skew,
    };
    (self as unknown as Worker).postMessage(response, [rgba.buffer]);
  } catch (err) {
    bitmap.close();
    (self as unknown as Worker).postMessage({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    } satisfies PreprocessResponse);
  }
};
