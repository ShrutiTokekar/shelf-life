# Shelf Life

Use it before you lose it. A mobile-first PWA and desktop web app that tracks kitchen food, ranks what to use first, and shares grocery lists with different groups, all feeding one pantry.

## Requirements

- Node 20+ (see `.nvmrc`) and pnpm (`corepack enable`)
- Docker (for local Postgres)
- A Google OAuth client for sign-in (free)

## Setup

```bash
pnpm install
cp .env.example .env        # then fill in the values below
pnpm db:up                  # start Postgres in Docker
pnpm db:migrate
pnpm dev                    # web on https://localhost:5173, API on :8787
```

The dev server uses a self-signed certificate (needed for the camera). Accept the browser warning once.

### Google sign-in (free)

1. In Google Cloud Console, create an OAuth client ID of type **Web application**.
2. Authorized JavaScript origin: `https://localhost:5173`
3. Authorized redirect URI: `https://localhost:5173/api/v1/auth/callback/google`
4. Put the client ID and secret in `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. Set `BETTER_AUTH_SECRET` to a random string of 32+ characters (`openssl rand -base64 32`).

## Commands

| Command                                               | What it does                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| `pnpm dev`                                            | Web + API locally (web over HTTPS)                                  |
| `pnpm test`                                           | Unit and component tests (Vitest)                                   |
| `pnpm test:coverage`                                  | Tests with coverage (90% lines gate on `packages/*`)                |
| `pnpm test:e2e`                                       | Playwright E2E on mobile and desktop viewports (needs `pnpm db:up`) |
| `pnpm lint`                                           | ESLint + Prettier check                                             |
| `pnpm typecheck`                                      | TypeScript in every package                                         |
| `pnpm db:up` / `pnpm db:migrate` / `pnpm db:generate` | Postgres in Docker, apply / generate Drizzle migrations             |
| `pnpm stories`                                        | Component demo pages (Ladle)                                        |

## Layout

```
apps/web/          React PWA
apps/api/          Hono API (Better Auth, Drizzle)
packages/shared/   types, Zod schemas, constants
packages/ranking/  ranking (pure functions, Milestone 6)
assets/            logo and fonts
```

`apps/sync` (y-websocket) arrives with list sharing in Milestone 5.
