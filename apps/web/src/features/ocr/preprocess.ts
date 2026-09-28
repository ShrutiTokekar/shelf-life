/**
 * SRS 8.1 step 2: photo clean-up before OCR, as pure functions on pixel arrays so they run in a
 * worker (OffscreenCanvas) and are unit-testable. Skew is found with a projection profile and
 * edges with a brightness outline, instead of OpenCV.js (approved Milestone 3 decision; revisit
 * if the Milestone 4 accuracy test needs it).
 */

export type Gray = { data: Uint8ClampedArray; width: number; height: number };
export type Box = { x: number; y: number; width: number; height: number };

/** Downscale so the long edge is at most `maxLong` px (SRS 8.1: 2000). Never upscales. */
export function scaledSize(
  width: number,
  height: number,
  maxLong = 2000,
): { width: number; height: number } {
  const scale = Math.min(1, maxLong / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** RGBA → luminance (Rec. 601). */
export function toGray(rgba: Uint8ClampedArray, width: number, height: number): Gray {
  const out = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = (rgba[p]! * 299 + rgba[p + 1]! * 587 + rgba[p + 2]! * 114) / 1000;
  }
  return { data: out, width, height };
}

/** Stretch the 2nd–98th percentile range to 0–255 (SRS 8.1: contrast stretch). */
export function contrastStretch(img: Gray): Gray {
  const hist = new Uint32Array(256);
  for (const v of img.data) hist[v]!++;
  const n = img.data.length;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]!) < n * 0.02; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]!) < n * 0.02; hi--);
  if (hi <= lo) return img;
  const out = new Uint8ClampedArray(n);
  const range = hi - lo;
  for (let i = 0; i < n; i++) out[i] = ((img.data[i]! - lo) * 255) / range;
  return { ...img, data: out };
}

/**
 * Bradley adaptive threshold with an integral image (SRS 8.1): a pixel is ink when it is `t`%
 * darker than the mean of its neighbourhood. Copes with shadows and uneven light on receipts.
 */
export function adaptiveThreshold(img: Gray, windowFraction = 1 / 16, t = 0.15): Gray {
  const { width: w, height: h, data } = img;
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let rowSum = 0;
    for (let x = 1; x <= w; x++) {
      rowSum += data[(y - 1) * w + (x - 1)]!;
      integral[y * (w + 1) + x] = integral[(y - 1) * (w + 1) + x]! + rowSum;
    }
  }
  const half = Math.max(4, Math.floor((Math.max(w, h) * windowFraction) / 2));
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y - half);
    const y2 = Math.min(h - 1, y + half);
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - half);
      const x2 = Math.min(w - 1, x + half);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * (w + 1) + (x2 + 1)]! -
        integral[y1 * (w + 1) + (x2 + 1)]! -
        integral[(y2 + 1) * (w + 1) + x1]! +
        integral[y1 * (w + 1) + x1]!;
      out[y * w + x] = data[y * w + x]! * count <= sum * (1 - t) ? 0 : 255;
    }
  }
  return { ...img, data: out };
}

/** Nearest-neighbour rotation about the centre (degrees, positive = counter-clockwise). White fill. */
export function rotate(img: Gray, degrees: number): Gray {
  const { width: w, height: h, data } = img;
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = w / 2;
  const cy = h / 2;
  const out = new Uint8ClampedArray(w * h).fill(255);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const sx = Math.round(cos * dx - sin * dy + cx);
      const sy = Math.round(sin * dx + cos * dy + cy);
      if (sx >= 0 && sx < w && sy >= 0 && sy < h) out[y * w + x] = data[sy * w + sx]!;
    }
  }
  return { ...img, data: out };
}

/**
 * Deskew angle in degrees (SRS 8.1): the rotation that makes text lines horizontal. Rotates a
 * small binary copy through ±maxDeg and keeps the angle where row ink counts change most sharply
 * between neighbouring rows (crisp line/gap edges). Pass the result straight to `rotate`.
 */
export function estimateDeskewAngle(binary: Gray, maxDeg = 10, step = 0.5): number {
  const small = downsample(binary, 400);
  let best = 0;
  let bestScore = -1;
  for (let a = -maxDeg; a <= maxDeg + 1e-9; a += step) {
    const r = rotate(small, a);
    const rows = new Float64Array(r.height);
    for (let y = 0; y < r.height; y++) {
      let ink = 0;
      for (let x = 0; x < r.width; x++) if (r.data[y * r.width + x]! < 128) ink++;
      rows[y] = ink;
    }
    let score = 0;
    for (let y = 1; y < rows.length; y++) score += (rows[y]! - rows[y - 1]!) ** 2;
    if (score > bestScore + 1e-9) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}

/** Box-average downsample so the long edge is at most `maxLong`. */
export function downsample(img: Gray, maxLong: number): Gray {
  const { width, height } = scaledSize(img.width, img.height, maxLong);
  if (width === img.width && height === img.height) return img;
  const out = new Uint8ClampedArray(width * height);
  const sx = img.width / width;
  const sy = img.height / height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let n = 0;
      for (let yy = Math.floor(y * sy); yy < Math.floor((y + 1) * sy); yy++) {
        for (let xx = Math.floor(x * sx); xx < Math.floor((x + 1) * sx); xx++) {
          sum += img.data[yy * img.width + xx]!;
          n++;
        }
      }
      out[y * width + x] = n ? sum / n : 255;
    }
  }
  return { data: out, width, height };
}

/** Otsu threshold for a grayscale image. */
export function otsu(img: Gray): number {
  const hist = new Float64Array(256);
  for (const v of img.data) hist[v]!++;
  const total = img.data.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i]!;
  let sumB = 0;
  let wB = 0;
  let best = 127;
  let max = -1;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > max) {
      max = between;
      best = t;
    }
  }
  return best;
}

/**
 * SCN-1 edge detection: find the bright paper against a darker background. Rows and columns where
 * most pixels are paper-bright form the receipt's box. `found` is true when the box is a
 * plausible receipt: big enough, clearly brighter than its surroundings, not the whole frame.
 */
export function findReceipt(img: Gray): { found: boolean; box: Box | null } {
  const small = downsample(img, 160);
  const { width: w, height: h, data } = small;
  const cut = otsu(small);
  const bright = (x: number, y: number) => data[y * w + x]! > cut;
  const rowFrac = (y: number) => {
    let n = 0;
    for (let x = 0; x < w; x++) if (bright(x, y)) n++;
    return n / w;
  };
  const colFrac = (x: number, y0: number, y1: number) => {
    let n = 0;
    for (let y = y0; y <= y1; y++) if (bright(x, y)) n++;
    return n / (y1 - y0 + 1);
  };
  let top = 0;
  while (top < h && rowFrac(top) < 0.25) top++;
  let bottom = h - 1;
  while (bottom > top && rowFrac(bottom) < 0.25) bottom--;
  if (bottom - top < h * 0.3) return { found: false, box: null };
  let left = 0;
  while (left < w && colFrac(left, top, bottom) < 0.5) left++;
  let right = w - 1;
  while (right > left && colFrac(right, top, bottom) < 0.5) right--;
  if (right - left < w * 0.2) return { found: false, box: null };

  const area = ((right - left + 1) * (bottom - top + 1)) / (w * h);
  // Contrast between the paper and what's around it.
  let inside = 0;
  let insideN = 0;
  let outside = 0;
  let outsideN = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inBox = x >= left && x <= right && y >= top && y <= bottom;
      if (inBox) {
        inside += data[y * w + x]!;
        insideN++;
      } else {
        outside += data[y * w + x]!;
        outsideN++;
      }
    }
  }
  const contrast = outsideN ? inside / insideN - outside / outsideN : 0;
  const found = area > 0.12 && area < 0.97 && contrast > 25;
  const sx = img.width / w;
  const sy = img.height / h;
  return {
    found,
    box: {
      x: Math.round(left * sx),
      y: Math.round(top * sy),
      width: Math.round((right - left + 1) * sx),
      height: Math.round((bottom - top + 1) * sy),
    },
  };
}

/** Crop a grayscale image to a box (clamped to the image). */
export function crop(img: Gray, box: Box): Gray {
  const x0 = Math.max(0, box.x);
  const y0 = Math.max(0, box.y);
  const x1 = Math.min(img.width, box.x + box.width);
  const y1 = Math.min(img.height, box.y + box.height);
  const width = Math.max(1, x1 - x0);
  const height = Math.max(1, y1 - y0);
  const out = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++)
    out.set(
      img.data.subarray((y0 + y) * img.width + x0, (y0 + y) * img.width + x0 + width),
      y * width,
    );
  return { data: out, width, height };
}

/** Grayscale back to RGBA for canvas / Tesseract. */
export function toRgba(img: Gray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(img.width * img.height * 4);
  for (let i = 0, p = 0; i < img.data.length; i++, p += 4) {
    out[p] = out[p + 1] = out[p + 2] = img.data[i]!;
    out[p + 3] = 255;
  }
  return out;
}

/** Only straighten when the skew is noticeable (SRS 8.1 uses 2° as the threshold). */
export const DESKEW_MIN_DEGREES = 2;

/**
 * The full clean-up: gray → crop to the receipt (if found) → contrast → deskew (if > 2°) →
 * adaptive threshold. Returns the binary image and what was done, for tests and logging.
 */
export function cleanUp(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): { image: Gray; cropped: boolean; skew: number } {
  let img = toGray(rgba, width, height);
  const receipt = findReceipt(img);
  const cropped = receipt.found && receipt.box !== null;
  if (cropped) img = crop(img, receipt.box!);
  img = contrastStretch(img);
  let binary = adaptiveThreshold(img);
  const skew = estimateDeskewAngle(binary);
  if (Math.abs(skew) >= DESKEW_MIN_DEGREES) binary = adaptiveThreshold(rotate(img, skew));
  return { image: binary, cropped, skew };
}
