# apps/api production image. Built from the repo root (turbo prune needs full monorepo context) —
# see fly.toml, which lives at the repo root for exactly this reason.
#
#   fly deploy   (run from the repo root)
#
# node:22-slim (Debian), not alpine — Prisma's query engine binary is glibc-linked by default
# (schema.prisma sets no binaryTargets) and needs libssl, which is simplest to guarantee on Debian.

FROM node:22-slim AS base
RUN corepack enable

# ---- prune: reduce the monorepo to just what @outreach-engine/api actually depends on ----
FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@2.10.5
COPY . .
RUN turbo prune @outreach-engine/api --docker

# ---- install + build ----
FROM base AS installer
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Install from the pruned lockfile/package.jsons first — a source-only change to apps/api
# invalidates Docker's layer cache here without also invalidating the (much slower) install layer.
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Full pruned source, then generate the Prisma client before anything tries to type-check against
# it — packages/db's own build imports @prisma/client, which doesn't exist as real generated code
# until `prisma generate` runs.
COPY --from=pruner /app/out/full/ .
RUN pnpm --filter @outreach-engine/db db:generate
RUN pnpm turbo run build --filter=@outreach-engine/api

# ---- runtime ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nodejs

# Copy the whole installed tree (node_modules preserves pnpm's workspace symlinks, which rely on
# the same relative directory layout being intact) rather than trying to hand-pick prod-only
# subsets — correctness over image size for this project's first-ever Dockerfile.
COPY --from=installer --chown=nodejs:nodejs /app /app

USER nodejs
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
