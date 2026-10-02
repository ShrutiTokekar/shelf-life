import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import type { MeResponse } from '@shelf-life/shared';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { vi } from 'vitest';
import { ApiRequestError, NetworkError } from '../lib/api';
import { ToastProvider } from '../components/Toast/Toast';
import { SessionProvider } from '../lib/session';
import { routes } from '../router';

type MeResult = MeResponse | 'signedOut' | 'network' | 'server';

/** Render the real route table with a stubbed GET /me. */
export function renderApp(
  route: string,
  meResults: MeResult | MeResult[],
  /** Render like main.tsx in development, where React mounts components twice. */
  opts: { strict?: boolean } = {},
) {
  const queue = Array.isArray(meResults) ? [...meResults] : [meResults];
  const load = vi.fn(async () => {
    const next = queue.length > 1 ? queue.shift()! : queue[0]!;
    if (next === 'signedOut') throw new ApiRequestError(401, 'unauthorized', 'Please sign in.');
    if (next === 'network') throw new NetworkError('offline');
    if (next === 'server') throw new ApiRequestError(500, 'internal_error', 'boom');
    return next;
  });
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  const tree = (
    <SessionProvider load={load}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </SessionProvider>
  );
  const utils = render(opts.strict ? <StrictMode>{tree}</StrictMode> : tree);
  return { ...utils, router, load };
}
