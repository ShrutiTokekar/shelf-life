import { expect, test, type Page } from '@playwright/test';
import { completeOnboarding, expectNoSeriousA11yViolations, signInAsNewUser } from './helpers';
import { receiptPng } from './receiptImage';

const PATEL = `PATEL BROTHERS
09/27/26 14:32
TOOR DAL 4LB      8.99
PANEER 400G       5.49
CILANTRO          0.99
TOMATO ON VINE    3.12
PAPER TOWELS      5.99
TAX               1.23
TOTAL            25.81`;

/** Sign in, then scan the receipt image and wait for the review screen. */
async function scanToReview(page: Page) {
  await signInAsNewUser(page);
  await completeOnboarding(page);
  await page.goto('/scan');
  await page.getByTestId('file-input').setInputFiles({
    name: 'receipt.png',
    mimeType: 'image/png',
    buffer: await receiptPng(page, PATEL),
  });
  await expect(page.getByRole('heading', { level: 1, name: 'Review items' })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText('4 groceries found', { exact: false })).toBeVisible();
}

test.describe('Review + receipt history (SRS 6.5, 6.12)', () => {
  test.setTimeout(150_000);

  test('REV-1..REV-7 HIS-1..HIS-6 review a scan, add it to the pantry, find it in history', async ({
    page,
  }, info) => {
    await scanToReview(page);
    await expectNoSeriousA11yViolations(page);

    // REV-3: untick one; edit another's name.
    await page.getByRole('checkbox', { name: 'Add Tomatoes to pantry' }).uncheck();
    await page.getByRole('button', { name: 'Edit Paneer' }).click();
    const sheet = page.getByRole('dialog', { name: /Edit Paneer/ });
    await sheet.getByRole('textbox', { name: 'Name' }).fill('Malai paneer');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('checkbox', { name: 'Add Malai paneer to pantry' })).toBeChecked();

    // REV-5: the skipped lines collapse into one row and can be restored.
    const skipped = page.getByRole('button', { name: /lines skipped: totals, tax, store info/ });
    await skipped.click();
    await expect(page.getByTestId('skipped-line').filter({ hasText: 'TAX' })).toBeVisible();
    await expect(
      page.getByTestId('skipped-line').filter({ hasText: 'PAPER TOWELS' }),
    ).toBeVisible();

    // REV-6 → REV-7
    await expect(page.getByRole('combobox', { name: 'Goes to' })).toHaveText(/Home/);
    await page.getByRole('button', { name: 'Add 3 items to pantry' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Your pantry' })).toBeVisible();
    await expect(page.getByText('3 items added to your pantry')).toBeVisible();
    await expect(page.locator('article[data-highlighted]')).toHaveCount(3);
    // …for 3 s only.
    await expect(page.locator('article[data-highlighted]')).toHaveCount(0, { timeout: 5_000 });
    await expect(page.getByRole('article', { name: 'Malai paneer' })).toBeVisible();
    await expect(page.getByRole('article', { name: 'Tomatoes' })).toHaveCount(0);

    // HIS-1..HIS-3
    await page.goto('/profile');
    await page.getByRole('link', { name: /Receipt history/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Receipt history' })).toBeVisible();
    await expect(page.getByText('1 receipt · photos never leave your device')).toBeVisible();
    const row = page.getByTestId('receipt-row');
    await expect(row).toContainText('$25.81');
    await expect(row).toContainText('3 items');
    await expect(row.getByText('2 edited').first()).toBeAttached();
    await expectNoSeriousA11yViolations(page);

    // HIS-4 HIS-6
    if (info.project.name === 'mobile')
      await row.getByRole('link', { name: 'Patel Brothers' }).click();
    const detail = page.getByTestId('receipt-detail');
    await expect(detail.getByRole('heading', { name: 'Patel Brothers' })).toBeVisible();
    await expect(detail.getByText('3 added to pantry')).toBeVisible();
    await expect(
      detail.getByText('The photo was deleted after scanning. Only this text was saved.'),
    ).toBeVisible();
    await expect(detail.getByTestId('receipt-line').filter({ hasText: 'TOOR DAL' })).toContainText(
      'Toor dal · Cupboard',
    );
    await expectNoSeriousA11yViolations(page);
  });

  test('HIS-5 edit items from history, then delete the receipt but keep the pantry items', async ({
    page,
  }) => {
    await scanToReview(page);
    await page.getByRole('button', { name: 'Add 4 items to pantry' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Your pantry' })).toBeVisible();

    await page.goto('/profile/receipts');
    await page.getByTestId('receipt-row').getByRole('link', { name: 'Patel Brothers' }).click();
    const detail = page.getByTestId('receipt-detail');
    await detail.getByRole('link', { name: 'Edit items' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Edit receipt items' })).toBeVisible();
    await page.getByRole('checkbox', { name: 'Add Cilantro to pantry' }).uncheck();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Receipt updated')).toBeVisible();
    await expect(detail.getByText('3 added to pantry')).toBeVisible();

    await detail.getByRole('button', { name: 'Delete receipt' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete this receipt?' });
    await expect(dialog.getByRole('button', { name: 'Keep it' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Delete receipt' }).click();
    await expect(page.getByRole('heading', { name: 'No receipts yet' })).toBeVisible();

    // The receipt record is gone; what it added stays in the pantry (minus the unticked line).
    await page.goto('/pantry');
    await expect(page.getByRole('article', { name: 'Toor dal' })).toBeVisible();
    await expect(page.getByRole('article', { name: 'Cilantro' })).toHaveCount(0);
  });

  test('SRS 9.2 REV-4 a line the dictionary can’t read gets an AI guess to confirm', async ({
    page,
  }) => {
    // E2E runs the API with the mock AI provider: no outside calls.
    await signInAsNewUser(page);
    await completeOnboarding(page);
    await page.goto('/scan');
    await page.getByTestId('file-input').setInputFiles({
      name: 'receipt.png',
      mimeType: 'image/png',
      buffer: await receiptPng(
        page,
        'PATEL BROTHERS\nTOOR DAL 4LB      8.99\nQZX VLRP          2.49\nTOTAL            11.48',
      ),
    });
    await expect(page.getByRole('heading', { level: 1, name: 'Review items' })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByRole('button', { name: /^AI guess from “QZX VLRP”/ })).toBeVisible();
    await expect(page.getByText(/never your photo/)).toBeVisible();
  });

  // REV-7 offline is covered against the production build in e2e-pwa/offline-shell.spec.ts: the
  // dev server can't serve lazy route code offline, the service worker can.
});
