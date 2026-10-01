import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isHeic } from './heic';
import { runScan, ScanError, validateImage, type ScanProgress } from './scanSession';

const read = vi.fn();
const terminate = vi.fn(async () => undefined);
vi.mock('./recognize', () => ({
  createRecognizer: vi.fn(async (onProgress: (p: { phase: string; progress: number }) => void) => {
    onProgress({ phase: 'loading', progress: 0.5 });
    return { read: (...a: unknown[]) => read(...a), terminate };
  }),
}));

beforeEach(() => {
  read.mockReset();
  terminate.mockClear();
  // jsdom: no OffscreenCanvas (so the main-thread fallback runs) and no createImageBitmap.
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 100, height: 200, close: vi.fn() })),
  );
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never;
});

const jpeg = (size = 10) => new File([new Uint8Array(size)], 'r.jpg', { type: 'image/jpeg' });

describe('validateImage (SCN-2)', () => {
  it('accepts JPG, PNG and HEIC, rejects other types and files over 15 MB', () => {
    expect(() => validateImage(jpeg())).not.toThrow();
    expect(() => validateImage(new File(['x'], 'r.png', { type: 'image/png' }))).not.toThrow();
    expect(() => validateImage(new File(['x'], 'IMG_1.HEIC', { type: '' }))).not.toThrow();
    expect(() => validateImage(new File(['x'], 'a.txt', { type: 'text/plain' }))).toThrow(
      ScanError,
    );
    expect(() => validateImage(jpeg(15 * 1024 * 1024 + 1))).toThrow(/over 15 MB/);
  });

  it('recognizes HEIC by type or name', () => {
    expect(isHeic(new File(['x'], 'a.heic', { type: '' }))).toBe(true);
    expect(isHeic(new File(['x'], 'a', { type: 'image/heif' }))).toBe(true);
    expect(isHeic(jpeg())).toBe(false);
  });
});

describe('runScan', () => {
  it('SCN-3 reports the four steps and returns parsed groceries', async () => {
    read.mockResolvedValue([
      { text: 'PATEL BROTHERS', confidence: 0.9 },
      { text: 'PANEER 400G   5.49', confidence: 0.95 },
      { text: 'CILANTRO   0.99', confidence: 0.95 },
      { text: 'TOTAL   6.48', confidence: 0.95 },
    ]);
    const updates: ScanProgress[] = [];
    const receipt = await runScan(jpeg(), {
      signal: new AbortController().signal,
      onProgress: (p) => updates.push(p),
      today: '2026-09-28',
    });
    expect(receipt.items.map((i) => i.foodId)).toEqual(['paneer', 'cilantro']);
    const last = updates.at(-1)!;
    expect(last.percent).toBe(100);
    expect(last.lineCount).toBe(4);
    expect(Object.values(last.steps)).toEqual(['done', 'done', 'done', 'done']);
    expect(updates.some((u) => u.preparing)).toBe(true);
    expect(terminate).toHaveBeenCalled();
  });

  it('SCN-7 fewer than 2 readable lines is "unreadable"', async () => {
    read.mockResolvedValue([
      { text: '~~', confidence: 0.2 },
      { text: 'AB', confidence: 0.2 },
    ]);
    await expect(
      runScan(jpeg(), { signal: new AbortController().signal, onProgress: () => undefined }),
    ).rejects.toMatchObject({ code: 'unreadable' });
  });

  it('SCN-4 Cancel stops the scan and the engine', async () => {
    read.mockImplementation(() => new Promise(() => undefined));
    const controller = new AbortController();
    const scan = runScan(jpeg(), { signal: controller.signal, onProgress: () => undefined });
    await new Promise((r) => setTimeout(r, 0));
    controller.abort();
    // The engine is terminated on abort, even while reading.
    await vi.waitFor(() => expect(terminate).toHaveBeenCalled());
    void scan.catch(() => undefined);
  });

  it('SCN-4 Cancel works while the engine is still downloading', async () => {
    const { createRecognizer } = await import('./recognize');
    // The first scan: the engine download hasn't finished (and never does here).
    vi.mocked(createRecognizer).mockImplementationOnce(() => new Promise(() => undefined));
    const controller = new AbortController();
    const scan = runScan(jpeg(), { signal: controller.signal, onProgress: () => undefined });
    await new Promise((r) => setTimeout(r, 0));
    controller.abort();
    await expect(scan).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects bad files before doing any work', async () => {
    await expect(
      runScan(new File(['x'], 'a.txt', { type: 'text/plain' }), {
        signal: new AbortController().signal,
        onProgress: () => undefined,
      }),
    ).rejects.toMatchObject({ code: 'type' });
    expect(read).not.toHaveBeenCalled();
  });
});
