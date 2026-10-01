# Shelf Life sync service (SRS 14.1: Northflank). Build from the repo root:
#   docker build -f apps/sync/Dockerfile .
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
EXPOSE 8790
CMD ["sh", "-c", "cd apps/sync && exec node_modules/.bin/tsx src/index.ts"]
