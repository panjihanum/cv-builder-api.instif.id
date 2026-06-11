FROM node:24-alpine AS base
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true

FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
RUN apk add --no-cache git openssl && npm ci --ignore-scripts

FROM base AS builder
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM base AS prod-deps
COPY package*.json ./
RUN apk add --no-cache git openssl && npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM base AS production
ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
RUN apk add --no-cache \
    openssl \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji \
    dumb-init
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nodeapp \
    && mkdir -p uploads .wwebjs_auth .wwebjs_cache \
    && chown -R nodeapp:nodejs /app
USER nodeapp
EXPOSE 3011
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/index.js"]
