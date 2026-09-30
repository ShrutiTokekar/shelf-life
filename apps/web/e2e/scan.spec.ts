import { expect, test, type Page } from '@playwright/test';
import { completeOnboarding, expectNoSeriousA11yViolations, signInAsNewUser } from './helpers';
import { receiptPng } from './receiptImage';

const PATEL = `PATEL BROTHERS
1234 DEVON AVE
09/27/26 14:32
TOOR DAL 4LB      8.99
GV WHL MLK        4.29
PANEER 400G       5.49
CILANTRO          0.99
SPINACH BAG       2.99
GRK YOGURT        4.79
ATTA 20LB        16.99
TOMATO ON VINE    3.12
SUBTOTAL         47.65
TAX               1.23
TOTAL            48.88`;

async function openScanner(page: Page) {
  await signInAsNewUser(page);
  await completeOnboarding(page);
  await page.goto('/scan');
}

async function upload(page: Page, buffer: Buffer, name = 'receipt.png', mimeType = 'image/png') {
  await page.getByTestId('file-input').setInputFiles({ name, mimeType, buffer });
}

test.describe('Scan receipt (SRS 6.4)', () => {
  test.setTimeout(120_000);

  test('SCN-2 SCN-3 a receipt photo is read on the device and its groceries are found', async ({
    page,
  }) => {
    await openScanner(page);
    await expectNoSeriousA11yViolations(page);
    await upload(page, await receiptPng(page, PATEL, { tilt: 3 }));
    // SCN-3 progress sheet with the lock note (SCN-6).
    await expect(page.getByRole('heading', { name: 'Reading your receipt…' })).toBeVisible();
    await expect(page.getByText(/Nothing is uploaded\./).first()).toBeVisible();

    await expect(page.getByRole('heading', { level: 1, name: 'Review items' })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByText('8 groceries found', { exact: false })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Store name' })).toHaveValue('Patel Brothers');
    const labels = await page
      .getByTestId('review-item')
      .getByRole('checkbox')
      .evaluateAll((boxes) => boxes.map((b) => b.getAttribute('aria-label')));
    const names = labels.map((l) => l!.replace(/^Add (.*) to pantry$/, '$1'));
    expect(names).toEqual([
      'Toor dal',
      'Milk',
      'Paneer',
      'Cilantro',
      'Spinach',
      'Greek yogurt',
      'Atta',
      'Tomatoes',
    ]);
    await expectNoSeriousA11yViolations(page);
  });

  test('SEC-5 rule 1: nothing is uploaded and the photo is not stored on the device', async ({
    page,
  }) => {
    await openScanner(page);
    const sent: string[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'GET')
        sent.push(`${r.method()} ${r.url()} ${r.postDataBuffer()?.length ?? 0}`);
    });
    const before = await page.evaluate(async () =>
      (await indexedDB.databases()).map((d) => d.name).sort(),
    );
    await upload(page, await receiptPng(page, PATEL));
    await expect(page.getByRole('heading', { level: 1, name: 'Review items' })).toBeVisible({
      timeout: 90_000,
    });
    // Saving the review writes text lines to the pantry doc on this device (REV-7).
    await page.getByRole('button', { name: /^Add \d+ items to pantry$/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Your pantry' })).toBeVisible();

    // No request carried anything during the scan or the save (only GETs for /ocr/ assets).
    expect(sent).toEqual([]);
    // No new IndexedDB database besides the pantry doc (Tesseract's own cache is off)…
    const after = await page.evaluate(async () =>
      (await indexedDB.databases()).map((d) => d.name).sort(),
    );
    expect(after.filter((n) => !before.includes(n))).toEqual(
      after.filter((n) => !before.includes(n) && n!.startsWith('shelf-life:pantry:')),
    );
    // …and nothing stored anywhere on the device is an image: no Blobs, no PNG/JPEG bytes, and
    // the whole pantry doc stays small (the photo alone would be hundreds of KB).
    const stored = await page.evaluate(async () => {
      let bytes = 0;
      let blobs = 0;
      let imageBytes = 0;
      const isImage = (b: Uint8Array) => {
        for (let i = 0; i + 3 < b.length; i++) {
          if (b[i] === 0x89 && b[i + 1] === 0x50 && b[i + 2] === 0x4e && b[i + 3] === 0x47)
            return true;
          if (b[i] === 0xff && b[i + 1] === 0xd8 && b[i + 2] === 0xff) return true;
        }
        return false;
      };
      for (const info of await indexedDB.databases()) {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open(info.name!);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        for (const name of Array.from(db.objectStoreNames)) {
          const values = await new Promise<unknown[]>((resolve, reject) => {
            const req = db.transaction(name).objectStore(name).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          for (const v of values) {
            if (v instanceof Blob) blobs++;
            if (v instanceof Uint8Array) {
              bytes += v.length;
              if (isImage(v)) imageBytes++;
            }
          }
        }
        db.close();
      }
      return { bytes, blobs, imageBytes };
    });
    expect(stored.blobs).toBe(0);
    expect(stored.imageBytes).toBe(0);
    expect(stored.bytes).toBeLessThan(100_000);
    // Cache Storage only ever holds the OCR engine files, never user images.
    const cached = await page.evaluate(async () => {
      const out: string[] = [];
      for (const name of await caches.keys())
        for (const req of await (await caches.open(name)).keys())
          out.push(new URL(req.url).pathname);
      return out;
    });
    expect(
      cached.filter((p) => !p.startsWith('/ocr/') && /\.(png|jpe?g|heic|webp)$/i.test(p)),
    ).toEqual([]);
  });

  test('SCN-7 an unreadable photo offers Retake and Add manually', async ({ page }) => {
    await openScanner(page);
    await upload(page, await receiptPng(page, '\n\n\n'));
    await expect(page.getByRole('heading', { name: "We couldn't read this receipt" })).toBeVisible({
      timeout: 90_000,
    });
    await page.getByRole('link', { name: 'Add manually' }).click();
    await expect(page.getByRole('dialog', { name: 'Add an item' })).toBeVisible();
  });

  test('SCN-4 Cancel stops the scan and returns to the scanner', async ({ page }) => {
    await openScanner(page);
    await upload(page, await receiptPng(page, PATEL));
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Scan cancelled.')).toBeVisible();
    await expect(page).toHaveURL(/\/scan$/);
  });

  test('SCN-2 only JPG, PNG or HEIC up to 15 MB', async ({ page }) => {
    await openScanner(page);
    await upload(page, Buffer.from('not an image'), 'notes.txt', 'text/plain');
    await expect(page.getByRole('alert')).toHaveText(/Choose a JPG, PNG or HEIC photo/);
    await upload(page, Buffer.alloc(15 * 1024 * 1024 + 1), 'huge.jpg', 'image/jpeg');
    await expect(page.getByRole('alert')).toHaveText(/over 15 MB/);
  });
});

test.describe('Mobile camera (SCN-1)', () => {
  test('shows the live camera with a shutter, an upload option and the lock note', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'mobile', 'Camera scanner is the mobile layout');
    await openScanner(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Scan receipt' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Take photo' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Upload photo' })).toBeVisible();
    await expect(page.getByText('Processed on your phone. Nothing is uploaded.')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
  });

  test('A11Y-8 camera denied: explains and offers upload instead', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'Camera scanner is the mobile layout');
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('denied', 'NotAllowedError'));
    });
    await openScanner(page);
    await expect(page.getByText(/Camera access is off/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Take photo' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Upload photo' })).toBeEnabled();
  });

  test('taking a photo with the camera runs the scan', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'Camera scanner is the mobile layout');
    test.setTimeout(120_000);
    await openScanner(page);
    await page.getByRole('button', { name: 'Take photo' }).click();
    // The fake camera shows a moving test pattern, not a receipt. Depending on the frame, OCR finds
    // a couple of stray "lines" (→ review) or nothing (→ SCN-7). Either way the shutter captured a
    // frame and the whole pipeline ran.
    const review = page.getByRole('heading', { level: 1, name: 'Review items' });
    const unreadable = page.getByRole('heading', { name: "We couldn't read this receipt" });
    await expect(review.or(unreadable)).toBeVisible({ timeout: 90_000 });
    if (await unreadable.isVisible()) {
      await page.getByRole('button', { name: 'Retake' }).click();
      await expect(page.getByRole('button', { name: 'Take photo' })).toBeEnabled();
    }
  });
});
