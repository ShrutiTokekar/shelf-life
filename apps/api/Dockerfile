# Shelf Life api service (SRS 14.1: Northflank). Build from the repo root:
#   docker build -f apps/api/Dockerfile .
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
RUN pnpm install --frozen-lockfile --filter "@shelf-life/api..."

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/docs packages/docs
COPY apps/api apps/api


ENV NODE_ENV=production
USER node
EXPOSE 8787
# Applies Drizzle migrations, then starts the API (SRS 14.2: migrations before deploy).
CMD ["sh", "-c", "cd apps/api && node_modules/.bin/tsx src/db/migrate.ts && exec node_modules/.bin/tsx src/index.ts"]
