import { expect, test } from '@playwright/test';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { todayIso } from '@shelf-life/shared';
import { draftLabel } from '../../../tests/receipts/lib/draft';

/**
 * Not a test: the receipt labeler (tests/receipts/README.md). For each photo in
 * tests/receipts/photos without a label yet, run the app's real OCR in the browser, redact the
 * text and write a draft label to tests/receipts/labels. RELABEL=1 redoes existing ones.
 */
const RECEIPTS = resolve(dirname(fileURLToPath(import.meta.url)), '../../../tests/receipts');
const PHOTOS = join(RECEIPTS, 'photos');
const LABELS = join(RECEIPTS, 'labels');
const photos = existsSync(PHOTOS)
  ? readdirSync(PHOTOS)
      .filter((f) => /\.(jpe?g|png|heic|heif)$/i.test(f))
      .sort()
  : [];

test('there are photos to label', () => {
  expect(
    photos.length,
    `Put receipt photos in ${PHOTOS} (named like patel-brothers-01.jpg)`,
  ).toBeGreaterThan(0);
});

for (const photo of photos) {
  test(photo, async ({ page }) => {
    const target = join(LABELS, `${draftLabel(photo, [], todayIso()).label.id}.json`);
    test.skip(existsSync(target) && !process.env.RELABEL, 'already labeled (RELABEL=1 to redo)');

    // Only this machine: block the API and fail on any request that isn't localhost.
    const offHost: string[] = [];
    page.on('request', (r) => {
      if (new URL(r.url()).hostname !== 'localhost') offHost.push(r.url());
    });
    await page.route('**/api/**', (r) => r.abort());
    await page.goto('/welcome');
    await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'file';
      input.id = 'label-photo';
      document.body.append(input);
    });
    await page.setInputFiles('#label-photo', join(PHOTOS, photo));

    const lines = await page.evaluate(async () => {
      // The app's own pipeline, served by Vite: same clean-up, OCR and settings as a real scan.
      const path = '/src/features/ocr/scanSession.ts';
      const { runScan } = await import(/* @vite-ignore */ path);
      const file = (document.getElementById('label-photo') as HTMLInputElement).files![0]!;
      let read: { text: string; confidence: number }[] = [];
      await runScan(file, {
        signal: new AbortController().signal,
        onProgress: () => undefined,
        onLines: (l: { text: string; confidence: number }[]) => {
          read = l.map(({ text, confidence }) => ({ text, confidence }));
        },
      }).catch(() => undefined); // "unreadable" still gives us its lines
      return read;
    });
    expect(offHost).toEqual([]);

    const { label, redacted } = draftLabel(photo, lines, todayIso());
    mkdirSync(LABELS, { recursive: true });
    writeFileSync(target, `${JSON.stringify(label, null, 2)}\n`);
    const items = label.lines.filter((l) => l.expect !== 'skip').length;
    console.log(
      `${photo} → labels/${label.id}.json: ${label.lines.length} lines, ${items} groceries guessed, ${redacted} lines redacted (${label.split})`,
    );
  });
}
