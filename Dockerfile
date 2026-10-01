# Shelf Life API + sync service in one container (SRS 14.1; Render's free plan allows one web
# service). Build from the repo root: docker build -t shelf-life-server .
FROM node:24-slim
WORKDIR /app
RUN corepack enable

# Workspace manifests first, so the dependency layer is cached between code changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/sync/package.json apps/sync/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/docs/package.json packages/docs/
COPY packages/ranking/package.json packages/ranking/
COPY tests/receipts/package.json tests/receipts/
RUN pnpm install --frozen-lockfile --filter "@shelf-life/sync..."

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/docs packages/docs
COPY apps/api apps/api
COPY apps/sync apps/sync

ENV NODE_ENV=production
USER node
# Render sets PORT. Apply Drizzle migrations (SRS 14.2), then serve the API and /sync on it.
CMD ["sh", "-c", "cd apps/api && node_modules/.bin/tsx src/db/migrate.ts && cd ../sync && exec node_modules/.bin/tsx src/combined.ts"]
