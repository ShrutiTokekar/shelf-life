import { render } from '@testing-library/react';
import type { MeResponse } from '@shelf-life/shared';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { vi } from 'vitest';
import { ApiRequestError, NetworkError } from '../lib/api';
import { SessionProvider } from '../lib/session';
import { routes } from '../router';

type MeResult = MeResponse | 'signedOut' | 'network' | 'server';

/** Render the real route table with a stubbed GET /me. */
export function renderApp(route: string, meResults: MeResult | MeResult[]) {
  const queue = Array.isArray(meResults) ? [...meResults] : [meResults];
  const load = vi.fn(async () => {
    const next = queue.length > 1 ? queue.shift()! : queue[0]!;
    if (next === 'signedOut') throw new ApiRequestError(401, 'unauthorized', 'Please sign in.');
    if (next === 'network') throw new NetworkError('offline');
    if (next === 'server') throw new ApiRequestError(500, 'internal_error', 'boom');
    return next;
  });
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  const utils = render(
    <SessionProvider load={load}>
      <RouterProvider router={router} />
    </SessionProvider>,
  );
  return { ...utils, router, load };
}
