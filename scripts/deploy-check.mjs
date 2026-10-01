// Post-deploy smoke check (SRS 14.2): node scripts/deploy-check.mjs <web-url> <sync-url>
// e.g. node scripts/deploy-check.mjs https://shelf-life.vercel.app wss://sync--abc.code.run
// Checks the web app, its /api proxy to the API, the security headers, and the sync service.
const [web, sync] = process.argv.slice(2);
if (!web || !sync) {
  console.error('Usage: node scripts/deploy-check.mjs <web-url> <sync-url>');
  process.exit(2);
}

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push(`✓ ${name}`);
  } catch (err) {
    results.push(`✗ ${name}: ${err.message}`);
  }
}
const expect = (ok, message) => {
  if (!ok) throw new Error(message);
};

await check('web app loads with its Content Security Policy (SEC-1)', async () => {
  const res = await fetch(web);
  expect(res.ok, `HTTP ${res.status}`);
  const html = await res.text();
  expect(html.includes('Content-Security-Policy'), 'no CSP meta tag');
  expect(html.includes(new URL(sync).origin), 'CSP connect-src is missing the sync origin');
  expect(res.headers.get('strict-transport-security'), 'no HSTS header');
  expect(
    /frame-ancestors 'none'/.test(res.headers.get('content-security-policy') ?? ''),
    'no frame-ancestors',
  );
});

await check('deep links fall back to the app (/lists)', async () => {
  const res = await fetch(new URL('/lists', web));
  expect(res.ok && (await res.text()).includes('id="root"'), `HTTP ${res.status}`);
});

await check('/api reaches the API through the web origin (cookies stay same-site)', async () => {
  const res = await fetch(new URL('/api/v1/me', web));
  expect(res.status === 401, `expected 401 signed out, got ${res.status}`);
  const body = await res.json();
  expect(body?.error?.code === 'unauthorized', 'not the API error envelope');
});

await check('sync service is up', async () => {
  const health = new URL('/health', sync.replace(/^ws/, 'http'));
  const res = await fetch(health);
  expect(res.ok, `HTTP ${res.status}`);
  expect((await res.json()).ok === true, 'unexpected body');
});

console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('✗')) ? 1 : 0);
