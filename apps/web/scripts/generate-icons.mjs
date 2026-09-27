// Renders the PWA icons (192/512 PNG) from assets/logo/logo-stacked.svg.
// Run: pnpm --filter @shelf-life/web icons
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const logo = await readFile(
  fileURLToPath(new URL('../../../assets/logo/logo-stacked.svg', import.meta.url)),
  'utf8',
);
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(logo).toString('base64')}`;
const browser = await chromium.launch();
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  // Logo sits inside the maskable safe zone (inner 80%) on the cream app background.
  await page.setContent(`<body style="margin:0;background:#FFFBF3;display:grid;place-items:center;width:${size}px;height:${size}px">
    <img src="${dataUrl}" style="width:${Math.round(size * 0.78)}px;height:auto"></body>`);
  await page.screenshot({
    path: fileURLToPath(new URL(`../public/icons/icon-${size}.png`, import.meta.url)),
  });
  await page.close();
}
await browser.close();
console.log('Icons written to public/icons/');
