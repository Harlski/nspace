# syntax=docker/dockerfile:1
# Build from repository root: docker build -f analytics-service/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY payment-intent-service/package.json payment-intent-service/
COPY payout-service/package.json payout-service/
COPY analytics-service/package.json analytics-service/
COPY scripts/postinstall.cjs scripts/
COPY patches/ patches/

RUN npm ci -w analytics-service && node scripts/postinstall.cjs

COPY analytics-service/tsconfig.json analytics-service/
COPY analytics-service/src analytics-service/src
RUN npm run build -w analytics-service \
  && npm prune -w analytics-service --omit=dev

FROM node:22-bookworm-slim AS run
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/analytics-service/package.json ./analytics-service/
COPY --from=build /app/analytics-service/dist ./analytics-service/dist

WORKDIR /app/analytics-service
ENV NODE_ENV=production
ENV PORT=3092
ENV HOST=0.0.0.0
EXPOSE 3092
CMD ["node", "dist/index.js"]
