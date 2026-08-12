# --- Build stage -----------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# build-essential/python3 are needed to compile bcrypt's native binding if no
# prebuilt binary matches this image's platform. openssl is required by
# Prisma's query engine to detect the correct libssl version.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
# prisma.config.ts requires DATABASE_URL to resolve just to load the config,
# even for `generate` (which doesn't actually connect to the DB). Real secrets
# are intentionally excluded from the build context (see .dockerignore) and
# are supplied at container runtime instead, so a placeholder is enough here.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate
RUN npm run build

# --- Runtime stage -----------------------------------------------------------
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# prisma.config.ts (not schema.prisma) is where datasource.url is defined in
# Prisma 7 — needed at runtime for `prisma migrate deploy` to resolve DATABASE_URL.
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY package*.json ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3000)+'/api/v1/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
