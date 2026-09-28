# Shelf Life

Use it before you lose it. A mobile-first PWA and desktop web app that tracks kitchen food, ranks what to use first, and shares grocery lists with different groups, all feeding one pantry.

## Requirements

- **Node 24 LTS** (see `.nvmrc`)
- **pnpm** via Corepack (ships with Node): `corepack enable`
- **Docker Desktop** (runs Postgres locally; free for personal use)
- **A Google account** to create a free OAuth client for sign-in

## Local setup

### 1. Install dependencies

```bash
corepack enable
pnpm install
```

### 2. Start Postgres in Docker

Open Docker Desktop and wait until it says it's running, then:

```bash
pnpm db:up
```

This starts Postgres 16 on `localhost:5432` (user `postgres`, password `postgres`, database `shelflife`). Data is kept in a Docker volume, so it survives restarts. Stop it with `docker compose stop`.

### 3. Create your `.env`

Create a file named `.env` in the project root with these contents:

```bash
# Local Postgres from step 2 (leave as is)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/shelflife

# Random string of 32+ characters: run `openssl rand -base64 32` and paste the result
BETTER_AUTH_SECRET=

# From step 4
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Web app origin and API port (leave as is)
APP_URL=https://localhost:5173
PORT=8787
```

`.env` is git-ignored. Never commit it or paste its values anywhere public. These are the only variables Milestone 1 needs. Later milestones add AI, Web Push and sync variables (SRS 14.4), and this README will list them when they're needed.

### 4. Create a Google OAuth client (free)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project (for example "Shelf Life dev").
2. Open **APIs & Services → OAuth consent screen**. Choose **External**, fill in the app name and your email, and add your Google account under **Test users**. While the app is in testing mode, only test users can sign in.
3. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**, and choose **Web application**.
4. Under **Authorized JavaScript origins**, add `https://localhost:5173`.
5. Under **Authorized redirect URIs**, add exactly:

   ```
   https://localhost:5173/api/v1/auth/callback/google
   ```

6. Copy the **Client ID** and **Client secret** into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### 5. Create the database tables

```bash
pnpm db:migrate
```

This applies the Drizzle migrations in `apps/api/drizzle/` to the database in `DATABASE_URL`. Run it again whenever new migrations arrive.

### 6. Run the app

```bash
pnpm dev
```

- Web app: **https://localhost:5173**
- API: `http://localhost:8787`. The web dev server proxies `/api` to it, so the browser only ever talks to `localhost:5173`, and the session cookie stays same-site.

The dev server uses a self-signed HTTPS certificate, which the camera needs. The first time you open the app, your browser warns you: choose **Advanced → Proceed to localhost**.

Sign in with Google. As a new user, you're asked to name your home list, which creates your pantry. Then you land on Today.

### Troubleshooting

| Problem                                           | Fix                                                                                                   |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Invalid environment` when the API starts         | A required `.env` value is missing. The error names it.                                               |
| Google says `redirect_uri_mismatch`               | The redirect URI in Google Cloud must be exactly `https://localhost:5173/api/v1/auth/callback/google` |
| Google says `access_denied` or "app not verified" | Add your account under **Test users** on the OAuth consent screen                                     |
| `ECONNREFUSED 5432`                               | Docker Desktop isn't running, or run `pnpm db:up`                                                     |
| Port 5173 or 8787 already in use                  | Stop the other `pnpm dev`, or whatever else is using that port                                        |

### Running the tests locally

```bash
pnpm lint && pnpm typecheck && pnpm test
pnpm test:e2e
```

`pnpm test:e2e` needs Postgres running (`pnpm db:up`). It starts its own servers on ports 5174/8788 (plus 5175/8789 for the offline test) against a separate `shelflife_test` database. It won't touch your dev data, and you can leave `pnpm dev` running. Google isn't contacted: E2E signs in through a test-only route that exists only when the API runs with `NODE_ENV=test`.

## Commands

| Command                                               | What it does                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm dev`                                            | Web + API locally (web over HTTPS)                                                         |
| `pnpm test`                                           | Unit and component tests (Vitest)                                                          |
| `pnpm test:coverage`                                  | Tests with coverage (90% lines gate on `packages/*`)                                       |
| `pnpm test:e2e`                                       | Playwright E2E on mobile and desktop viewports plus the offline check (needs `pnpm db:up`) |
| `pnpm lint`                                           | ESLint + Prettier check                                                                    |
| `pnpm typecheck`                                      | TypeScript in every package                                                                |
| `pnpm db:up` / `pnpm db:migrate` / `pnpm db:generate` | Postgres in Docker, apply / generate Drizzle migrations                                    |
| `pnpm stories`                                        | Component demo pages (Ladle)                                                               |

## Layout

```
apps/web/          React PWA
apps/api/          Hono API (Better Auth, Drizzle)
packages/shared/   types, Zod schemas, constants
packages/ranking/  ranking (pure functions, Milestone 6)
assets/            logo and fonts
```

`apps/sync` (y-websocket) arrives with list sharing in Milestone 5.
