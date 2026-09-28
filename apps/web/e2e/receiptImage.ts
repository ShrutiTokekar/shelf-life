import type { Page } from '@playwright/test';

/**
 * Draws receipt text onto a canvas in the page and returns it as a PNG buffer, so E2E tests can
 * scan a realistic receipt without shipping real (private) receipt photos. `tilt` rotates the
 * paper; `background` is the table colour around it.
 */
export async function receiptPng(
  page: Page,
  text: string,
  opts: { tilt?: number; background?: string } = {},
): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ({ text, tilt, background }) => {
      const lines = text.split('\n');
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 300 + lines.length * 56;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((tilt * Math.PI) / 180);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      ctx.fillStyle = '#fbf8f1';
      ctx.fillRect(200, 100, 800, canvas.height - 200);
      ctx.fillStyle = '#222';
      ctx.font = '34px "Courier New", monospace';
      lines.forEach((line, i) => ctx.fillText(line, 240, 170 + i * 56));
      const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (const b of bytes) s += String.fromCharCode(b);
      return btoa(s);
    },
    { text, tilt: opts.tilt ?? 0, background: opts.background ?? '#3a4372' },
  );
  return Buffer.from(base64, 'base64');
}
