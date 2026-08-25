# syntax=docker/dockerfile:1.7

# =========================
# Base
# =========================
FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Enable exact pnpm version
RUN corepack enable && \
    corepack prepare pnpm@10.8.1 --activate

RUN node --version && \
    pnpm --version

WORKDIR /app


# =========================
# Dependencies
# =========================
FROM base AS deps

COPY backend/package.json backend/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile


# =========================
# Build
# =========================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules

COPY backend/package.json ./
COPY backend/pnpm-lock.yaml ./
COPY backend/ ./

RUN pnpm build


# =========================
# Production dependencies
# =========================
FROM base AS prod-deps

COPY backend/package.json backend/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prod


# =========================
# Production runner
# =========================
FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app

RUN mkdir -p /app/data /app/uploads

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

EXPOSE 4000

CMD ["node", "dist/main.js"]