# ---- Build stage ----
FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/web/package.json packages/web/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @droidvibe/web...

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/db/ packages/db/
COPY packages/web/ packages/web/

# Build
RUN pnpm --filter @droidvibe/web build

# ---- Runtime stage ----
FROM node:20-slim AS runner
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/web/package.json packages/web/

# Install only production deps
RUN pnpm install --prod --filter @droidvibe/web...

# Copy built artifacts
COPY --from=builder /app/packages/web/dist packages/web/dist
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/db/dist packages/db/dist

EXPOSE 3001
CMD ["node", "packages/web/dist/index.js"]
