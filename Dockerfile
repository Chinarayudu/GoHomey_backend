# --- Build stage -----------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# build-essential/python3 are needed to compile bcrypt's native binding if no
# prebuilt binary matches this image's platform.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# --- Runtime stage -----------------------------------------------------------
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3000)+'/api/v1/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
