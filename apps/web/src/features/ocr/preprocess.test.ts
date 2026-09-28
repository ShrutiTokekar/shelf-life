// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  adaptiveThreshold,
  cleanUp,
  contrastStretch,
  crop,
  downsample,
  estimateDeskewAngle,
  findReceipt,
  otsu,
  rotate,
  scaledSize,
  toGray,
  toRgba,
  type Gray,
} from './preprocess';

/** White page with dark horizontal "text lines". */
function lines(width = 300, height = 300, rows = 10): Gray {
  const data = new Uint8ClampedArray(width * height).fill(240);
  for (let r = 0; r < rows; r++) {
    const y0 = 20 + r * 26;
    for (let y = y0; y < y0 + 8 && y < height; y++)
      for (let x = 30; x < width - 30; x++) data[y * width + x] = 20;
  }
  return { data, width, height };
}

/** A bright receipt rectangle on a dark table. */
function receiptOnTable(width = 400, height = 600): Gray {
  const data = new Uint8ClampedArray(width * height).fill(60);
  for (let y = 80; y < 540; y++) for (let x = 110; x < 290; x++) data[y * width + x] = 235;
  return { data, width, height };
}

const inkRatio = (g: Gray) => g.data.reduce((n, v) => n + (v < 128 ? 1 : 0), 0) / g.data.length;

describe('SRS 8.1 preprocessing', () => {
  it('downscales so the long edge is at most 2000 px, never upscales', () => {
    expect(scaledSize(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(scaledSize(3024, 4032)).toEqual({ width: 1500, height: 2000 });
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('converts RGBA to gray and back', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
    const g = toGray(rgba, 2, 1);
    expect([...g.data]).toEqual([76, 29]);
    expect([...toRgba(g)]).toEqual([76, 76, 76, 255, 29, 29, 29, 255]);
  });

  it('contrast stretch spreads a washed-out image to the full range', () => {
    const data = new Uint8ClampedArray(1000);
    for (let i = 0; i < 1000; i++) data[i] = 100 + (i % 50);
    const out = contrastStretch({ data, width: 1000, height: 1 });
    expect(Math.min(...out.data)).toBeLessThan(10);
    expect(Math.max(...out.data)).toBeGreaterThan(245);
  });

  it('adaptive threshold keeps text under a shadow', () => {
    const img = lines();
    // Darken the right half like a shadow across the receipt.
    for (let y = 0; y < img.height; y++)
      for (let x = 150; x < img.width; x++)
        img.data[y * img.width + x] = Math.max(0, img.data[y * img.width + x]! - 120);
    const bin = adaptiveThreshold(img);
    // Paper in the shadow stays white; text in the shadow stays black.
    expect(bin.data[5 * img.width + 200]).toBe(255);
    expect(bin.data[23 * img.width + 200]).toBe(0);
    expect(inkRatio(bin)).toBeLessThan(0.4);
  });

  it('deskew: finds the angle that straightens tilted text (sign matters)', () => {
    const straight = adaptiveThreshold(lines(400, 400, 12));
    for (const tilt of [5, -4]) {
      const tilted = rotate(straight, tilt);
      const angle = estimateDeskewAngle(tilted);
      expect(Math.abs(angle + tilt)).toBeLessThanOrEqual(1);
    }
    expect(Math.abs(estimateDeskewAngle(straight))).toBeLessThanOrEqual(0.5);
  });

  it('SCN-1 finds a bright receipt on a darker table, and not on a blank frame', () => {
    const r = findReceipt(receiptOnTable());
    expect(r.found).toBe(true);
    expect(r.box!.x).toBeGreaterThan(90);
    expect(r.box!.x).toBeLessThan(130);
    expect(r.box!.width).toBeGreaterThan(150);
    expect(r.box!.width).toBeLessThan(210);
    expect(
      findReceipt({ data: new Uint8ClampedArray(400 * 600).fill(60), width: 400, height: 600 })
        .found,
    ).toBe(false);
    expect(
      findReceipt({ data: new Uint8ClampedArray(400 * 600).fill(240), width: 400, height: 600 })
        .found,
    ).toBe(false);
  });

  it('otsu splits a two-tone image between the tones', () => {
    const data = new Uint8ClampedArray(200);
    data.fill(40, 0, 100);
    data.fill(220, 100);
    const t = otsu({ data, width: 200, height: 1 });
    expect(t).toBeGreaterThanOrEqual(40);
    expect(t).toBeLessThan(220);
  });

  it('crop and downsample keep dimensions consistent', () => {
    const c = crop(receiptOnTable(), { x: 110, y: 80, width: 180, height: 460 });
    expect([c.width, c.height]).toEqual([180, 460]);
    expect(c.data[0]).toBe(235);
    const d = downsample(receiptOnTable(), 160);
    expect(Math.max(d.width, d.height)).toBe(160);
  });

  it('cleanUp crops to the receipt and returns a black-and-white image', () => {
    const img = receiptOnTable();
    // Some text on the receipt.
    for (let y = 150; y < 158; y++)
      for (let x = 130; x < 270; x++) img.data[y * img.width + x] = 20;
    const rgba = toRgba(img);
    const out = cleanUp(rgba, img.width, img.height);
    expect(out.cropped).toBe(true);
    expect(out.image.width).toBeLessThan(img.width);
    expect(new Set(out.image.data)).toEqual(new Set([0, 255]));
  });
});
