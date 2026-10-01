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

# Another random string of 32+ characters (`openssl rand -base64 32`), shared by the API and the
# sync service to sign 5-minute sync tokens
SYNC_JWT_SECRET=
```

`.env` is git-ignored. Never commit it or paste its values anywhere public. Later milestones add AI and Web Push variables (SRS 14.4); this README will list them when they're needed.

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
- Sync service: `ws://localhost:8790`, proxied at `wss://localhost:5173/sync`. It relays list and pantry changes between devices and saves them to Postgres.

To try sharing, open a second browser profile (or a private window), sign in with another Google test user, and open an invite link from **Share list**.

The dev server uses a self-signed HTTPS certificate, which the camera needs. The first time you open the app, your browser warns you: choose **Advanced → Proceed to localhost**.

Sign in with Google. As a new user, you're asked to name your home list, which creates your pantry. Then you land on Today.

### 7. (Optional) Load sample data

To see a realistic pantry without scanning a receipt, sign in once and finish home-list setup, then run:

```bash
pnpm db:seed --email you@gmail.com
```

This adds two lists (**Family groceries**, **Diwali party**) and two demo members (**Arjun**, **Meera**) to your account. It only runs locally and is safe to run again.

Next, open **Pantry**. While it's empty, dev builds show a **Load sample pantry** button, which fills your shelves with about 26 items across all four shelves and your lists. Pantry items live in your browser (IndexedDB) until the sync server arrives in Milestone 5, so load the sample in each browser you use. The dates are relative to the day you load it.

### Receipt scanning (OCR)

Scanning runs entirely in the browser with Tesseract.js. `pnpm dev` and `pnpm build` copy the OCR engine and English model from `node_modules` into `apps/web/public/ocr/` (git-ignored), so nothing loads from a CDN and no photo or text leaves the device. The first scan downloads about 7 MB; after that the service worker caches it and scanning works offline.

After a scan, the review screen saves the items and the receipt's text lines to the pantry on this device. Receipt history (Profile → Receipt history) shows that text; the photo itself is never stored.

### Receipt accuracy set

`tests/receipts/` holds the labeled receipts that give the OCR accuracy score (SRS 13). Photos stay on your machine in `tests/receipts/photos/` (git-ignored); only redacted text is committed. See [tests/receipts/README.md](tests/receipts/README.md).

### Troubleshooting

| Problem                                           | Fix                                                                                                   |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Invalid environment` when the API starts         | A required `.env` value is missing. The error names it.                                               |
| Google says `redirect_uri_mismatch`               | The redirect URI in Google Cloud must be exactly `https://localhost:5173/api/v1/auth/callback/google` |
| Google says `access_denied` or "app not verified" | Add your account under **Test users** on the OAuth consent screen                                     |
| `ECONNREFUSED 5432`                               | Docker Desktop isn't running, or run `pnpm db:up`                                                     |
| Port 5173, 8787 or 8790 already in use            | Stop the other `pnpm dev`, or whatever else is using that port                                        |

### Running the tests locally

```bash
pnpm lint && pnpm typecheck && pnpm test
pnpm test:e2e
```

`pnpm test:e2e` needs Postgres running (`pnpm db:up`). It starts its own servers on ports 5174/8788/8791 (plus 5175/8789/8792 for the offline test) against a separate `shelflife_test` database. It won't touch your dev data, and you can leave `pnpm dev` running. Google isn't contacted: E2E signs in through a test-only route that exists only when the API runs with `NODE_ENV=test`.

## Deploying (free tiers)

Production follows SRS 14.1: the web app on **Vercel Hobby**; the API, the sync service and Postgres on **Northflank's free Developer Sandbox**. Both are free. Northflank may ask for a card to verify the account; if it does, set a spending cap of $0 in billing.

### 1. Northflank: database, API and sync service

1. Create a project, then add a **PostgreSQL addon**. Copy its connection string (the `postgres://…` URI).
2. Add a **combined service** for the API, from this GitHub repo:
   - Build: Dockerfile `apps/api/Dockerfile`, build context `/` (the repo root).
   - Port: `8787`, public, HTTP. Health check path: `/health`.
   - Environment (mark the secrets as secret):

     ```bash
     NODE_ENV=production
     PORT=8787
     DATABASE_URL=            # the addon's connection string
     BETTER_AUTH_SECRET=      # openssl rand -base64 32
     SYNC_JWT_SECRET=         # openssl rand -base64 32 (the same value goes on the sync service)
     GOOGLE_CLIENT_ID=
     GOOGLE_CLIENT_SECRET=
     APP_URL=https://<your-vercel-domain>
     SYNC_URL=wss://<the sync service's public host>
     ```

   It applies database migrations every time it starts.

3. Add a second **combined service** for sync: Dockerfile `apps/sync/Dockerfile`, context `/`, port `8790` public HTTP, health check `/health`, with `NODE_ENV=production`, `SYNC_PORT=8790`, and the same `DATABASE_URL` and `SYNC_JWT_SECRET`.
4. Note both public hosts Northflank gives you (they end in `.code.run`).

### 2. Vercel: the web app

1. Import this repo in Vercel. Set **Root Directory** to `apps/web`; `apps/web/vercel.json` sets the install, build and output.
2. In `apps/web/vercel.json`, replace `API_HOST` with the API's public host (no `https://`) and commit. The browser then reaches the API at `/api` on the web app's own address, which keeps the sign-in cookie same-site without buying a domain.
3. Add the environment variable `SYNC_ORIGIN=wss://<the sync service's public host>`. It goes into the app's Content Security Policy, which is otherwise self-only.
4. Deploy, then put the final Vercel domain into the API's `APP_URL` and redeploy the API.

### 3. Google sign-in

In Google Cloud → Credentials → your OAuth client, add the authorized redirect URI `https://<your-vercel-domain>/api/v1/auth/callback/google`. While the OAuth app is in testing, add each person who will sign in under **Test users**.

### 4. Check it

```bash
node scripts/deploy-check.mjs https://<your-vercel-domain> wss://<sync host>
```

It checks the page, its security headers and policy, the `/api` proxy and the sync service. Then try two devices by hand: sign in on two phones with two Google test users, share a list from one, join from the other, add and check items, and turn one phone's network off and on.

The automated two-device test runs in CI against the same API and sync code on every PR. It can't run against production, because signing in there needs real Google accounts and the test-only login never exists in production.

## Commands

| Command                                               | What it does                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm dev`                                            | Web + API + sync service locally (web over HTTPS)                                          |
| `pnpm test`                                           | Unit and component tests (Vitest)                                                          |
| `pnpm test:coverage`                                  | Tests with coverage (90% lines gate on `packages/*`)                                       |
| `pnpm test:e2e`                                       | Playwright E2E on mobile and desktop viewports plus the offline check (needs `pnpm db:up`) |
| `pnpm lint`                                           | ESLint + Prettier check                                                                    |
| `pnpm typecheck`                                      | TypeScript in every package                                                                |
| `pnpm db:up` / `pnpm db:migrate` / `pnpm db:generate` | Postgres in Docker, apply / generate Drizzle migrations                                    |
| `pnpm db:seed --email you@gmail.com`                  | Dev only: extra lists and demo members for your account                                    |
| `pnpm stories`                                        | Component demo pages (Ladle)                                                               |
| `pnpm receipts:label`                                 | Read new photos in `tests/receipts/photos/` on this machine and write draft labels         |
| `pnpm receipts:score`                                 | Receipt accuracy on the labeled set (also runs in CI)                                      |

## Layout

```
apps/web/          React PWA
apps/api/          Hono API (Better Auth, Drizzle)
apps/sync/         y-websocket sync service (live lists, cart → pantry)
packages/shared/   types, Zod schemas, constants
packages/docs/     Yjs doc read/write helpers (web + sync)
packages/ranking/  ranking (pure functions, Milestone 6)
tests/receipts/    labeled receipt set and accuracy score (text only)
assets/            logo and fonts
```
