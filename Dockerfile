# DroidVibe Web Backend — Hono + oRPC + arduino-cli
# Multi-stage build for a slim production image

FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# --- Builder stage ---
FROM base AS builder
WORKDIR /app

# Install arduino-cli for sketch compilation
RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | \
    BINDIR=/usr/local/bin sh

# Copy workspace config and package files
COPY pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/web/package.json packages/web/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/web/ packages/web/
COPY packages/shared/ packages/shared/
COPY packages/db/ packages/db/

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @droidvibe/web build

# --- Runtime stage ---
FROM base AS runtime
WORKDIR /app

RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | \
    BINDIR=/usr/local/bin sh
RUN arduino-cli core update-index

COPY --from=builder /app/packages/web/dist packages/web/dist
COPY --from=builder /app/packages/shared/src packages/shared/src
COPY --from=builder /app/packages/db/src packages/db/src
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/web/package.json packages/web/
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/db/package.json packages/db/

RUN pnpm install --no-frozen-lockfile --prod

ENV PORT=3000
EXPOSE 3000

CMD ["node", "packages/web/dist/index.js"]
