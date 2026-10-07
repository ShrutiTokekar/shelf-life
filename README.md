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

# Optional: a free Gemini API key from Google AI Studio (aistudio.google.com → Get API key).
# Without it, local development uses a built-in mock AI and the app works fully either way.
GEMINI_API_KEY=
```

`.env` is git-ignored. Never commit it or paste its values anywhere public. Optional AI settings:

| Variable                | Default                                                          | What it does                                                                         |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `GEMINI_MODEL`          | `gemini-3.5-flash`                                               | Model for recipes                                                                    |
| `GEMINI_LIGHT_MODEL`    | `gemini-3.5-flash-lite`                                          | Model for small jobs (receipt cleanup, shelf life), so they use their own free quota |
| `AI_PROVIDER`           | `gemini` with a key, else `mock` locally and `off` in production | `gemini`, `mock` or `off`                                                            |
| `AI_DAILY_LIMIT`        | 30                                                               | AI calls per pantry (household) per day                                              |
| `AI_GLOBAL_DAILY_LIMIT` | 500                                                              | AI calls per day for the whole app                                                   |
| `AI_PER_MINUTE_LIMIT`   | 10                                                               | AI calls per minute for the whole app                                                |

Google's free quota is shared by every user of your key. Check it in Google AI Studio → **Rate limit**, and set `AI_GLOBAL_DAILY_LIMIT` and `AI_PER_MINUTE_LIMIT` just under it, so the app falls back politely instead of Google refusing requests. Answers are cached and shared, so repeated receipt lines and items cost nothing, and recipe suggestions for the same expiring food and preferences are reused for 6 hours. With AI off or used up, recipes come from the app's own collection (`packages/shared/src/recipes`, 61 original recipes, CC0) ranked on the device. Web Push variables arrive in Milestone 8.

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

Production (SRS 14.1): the web app on **Vercel Hobby**, the API and sync service as **one free Render web service** (Docker), and Postgres on **Neon's free plan**. None of them needs a card.

Render's free instance sleeps after 15 minutes without traffic and takes about a minute to wake. The app still opens instantly and works offline, because lists and the pantry live on the device; syncing resumes once the server is awake.

### 1. Neon: the database

1. Sign up at neon.tech and create a project (Postgres 16 or newer, a region near you).
2. Copy the **connection string**. It looks like `postgres://…neon.tech/neondb?sslmode=require`.

### 2. Vercel: the web app

1. Import this repo in Vercel and set **Root Directory** to `apps/web`. `apps/web/vercel.json` sets the install, build and output.
2. Under Settings → General, set the Node.js version to 24.x if offered.
3. Deploy, and note your domain, e.g. `shelf-life-abc.vercel.app`. Sign-in won't work until step 5.

### 3. Render: the API and sync service

1. Sign up at render.com with GitHub, then **New → Blueprint** and pick this repo. It reads `render.yaml` and creates one free web service, `shelf-life-server`, built from the root `Dockerfile`.
2. Fill in the values it asks for:

   | Variable                                   | Value                                            |
   | ------------------------------------------ | ------------------------------------------------ |
   | `DATABASE_URL`                             | the Neon connection string                       |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | the same values as your local `.env`             |
   | `APP_URL`                                  | `https://<your Vercel domain>`                   |
   | `SYNC_URL`                                 | `wss://<this service's .onrender.com host>/sync` |

   Optionally add `GEMINI_API_KEY` (free, from Google AI Studio) to turn on AI; without it the app uses its non-AI fallbacks. Render generates `BETTER_AUTH_SECRET` and `SYNC_JWT_SECRET` itself. The service applies database migrations every time it starts.

3. When the deploy is live, note its host, e.g. `shelf-life-server.onrender.com`. If you didn't know it in step 2, set `SYNC_URL` now; Render redeploys.

### 4. Point the web app at the server

1. `apps/web/vercel.json` sends `/api` to the Render host (`shelf-life-server.onrender.com`); if yours differs, change it there and commit. The browser then reaches the API at `/api` on the web app's own address, which keeps the sign-in cookie same-site without buying a domain.
2. In Vercel → Settings → Environment Variables, add `SYNC_ORIGIN=wss://<Render host>`. It goes into the app's Content Security Policy, which otherwise allows only the app itself. Redeploy.

### 5. Google sign-in

In Google Cloud → APIs & Services → Credentials → your OAuth client, add the authorized redirect URI `https://<your Vercel domain>/api/v1/auth/callback/google`. While the OAuth app is in testing, add each person who will sign in under **OAuth consent screen → Test users**.

### 6. Phone notifications (optional, free)

Reminders always show in the app. To also send phone notifications (Web Push), give the server a pair of push keys:

1. On your computer, in this repo, run:

   ```bash
   npx web-push generate-vapid-keys
   ```

   It prints a **public key** and a **private key**. Keep the private key secret: don't commit it or paste it anywhere public.

2. In Render → `shelf-life-server` → **Environment**, add:

   | Variable            | Value                            |
   | ------------------- | -------------------------------- |
   | `VAPID_PUBLIC_KEY`  | the public key                   |
   | `VAPID_PRIVATE_KEY` | the private key                  |
   | `VAPID_SUBJECT`     | `mailto:` followed by your email |

   Save; Render redeploys. Each person then turns notifications on per device in **Profile → Notifications**. On iPhone and iPad, they add Shelf Life to the Home Screen first (Share → Add to Home Screen) and turn it on from there.

3. Turn on the hourly reminders (expiry alerts, "still out of" follow-ups and the weekly shopping reminder). Render's cron jobs aren't free, so a GitHub Actions workflow (`.github/workflows/reminders-cron.yml`) calls the server once an hour:
   1. Make a secret: run `openssl rand -hex 32`.
   2. In Render → `shelf-life-server` → **Environment**, add `CRON_SECRET` with that value.
   3. In GitHub → the repo → **Settings → Secrets and variables → Actions**, add two repository secrets: `CRON_SECRET` (the same value) and `API_URL` (the server's address, e.g. `https://shelf-life-server.onrender.com`).
   4. To check it: **Actions → Hourly reminders → Run workflow**. The run's summary shows how many reminders were sent.

   GitHub may start the job a few minutes late; that's fine. GitHub pauses scheduled workflows in a repo with no commits for 60 days; if that happens, re-enable it on the Actions tab.

### 7. Check it

```bash
node scripts/deploy-check.mjs https://<your Vercel domain> wss://<Render host>/sync
```

It checks the page, its security headers and policy, the `/api` proxy and the server. Then try two devices by hand: sign in on two phones with two Google test users, share a list from one, join from the other, add and check items, and turn one phone's network off and back on.

The automated two-device test runs in CI against the same API and sync code on every PR. It can't run against production, because signing in there needs real Google accounts and the test-only login never exists in production.

## Security and privacy

- Everything except sign-in needs a signed-in session, and every pantry and list request checks that you're a member (`apps/api/test/security.test.ts` fails if any route is left open).
- Sessions time out: in a browser after 5 hours without use, in the installed app (added to the Home Screen) 30 days after sign-in. Profile → **Sign out on all devices** ends every session. Deleting the account asks you to sign in again if your last sign-in was over 15 minutes ago.
- When a session ends, the app removes this account's data from the device (pantry, lists, receipts, saved recipes).
- Receipt photos never leave the device; other members see your name, never your email; AI requests carry no personal details; logs never include what you typed.
- Keys and secrets live only in the hosts' environment variables (Render, Vercel), never in the app or the repo.

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
