import { vi } from 'vitest';

type Handler = (init: RequestInit | undefined, url: URL) => unknown;

/**
 * Stub fetch for /api/v1 calls in page tests: `{ 'GET /lists/:id': body | fn }`. Unknown routes
 * return 404. Returns the spy so tests can check what was sent.
 */
export function mockApi(routes: Record<string, unknown | Handler>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'https://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace(/^\/api\/v1/, '');
    for (const [key, value] of Object.entries(routes)) {
      const [m, pattern] = key.split(' ') as [string, string];
      const re = new RegExp(`^${pattern.replace(/:[^/]+/g, '[^/]+')}$`);
      if (m === method && re.test(path)) {
        const body = typeof value === 'function' ? (value as Handler)(init, url) : value;
        if (body instanceof Response) return body;
        return body === undefined
          ? new Response(null, { status: 204 })
          : new Response(JSON.stringify(body), { status: 200 });
      }
    }
    return new Response(JSON.stringify({ error: { code: 'not_found', message: 'Not found.' } }), {
      status: 404,
    });
  });
}
