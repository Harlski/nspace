# syntax=docker/dockerfile:1
# Build from repository root: docker build -f payout-service/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY payment-intent-service/package.json payment-intent-service/
COPY payout-service/package.json payout-service/
COPY scripts/postinstall.cjs scripts/
COPY patches/ patches/

RUN npm ci -w payout-service && node scripts/postinstall.cjs

COPY payout-service/tsconfig.json payout-service/
COPY payout-service/src payout-service/src
RUN npm run build -w payout-service \
  && npm prune -w payout-service --omit=dev

FROM node:22-bookworm-slim AS run
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/payout-service/package.json ./payout-service/
COPY --from=build /app/payout-service/dist ./payout-service/dist

WORKDIR /app/payout-service
ENV NODE_ENV=production
ENV PORT=3091
ENV HOST=0.0.0.0
EXPOSE 3091
CMD ["node", "dist/index.js"]
