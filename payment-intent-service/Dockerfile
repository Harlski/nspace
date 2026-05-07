# syntax=docker/dockerfile:1
# Build from repository root: docker build -f payment-intent-service/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY payment-intent-service/package.json payment-intent-service/
COPY scripts/postinstall.cjs scripts/
COPY patches/ patches/

RUN npm ci -w payment-intent-service

COPY payment-intent-service/tsconfig.json payment-intent-service/
COPY payment-intent-service/src payment-intent-service/src
RUN npm run build -w payment-intent-service \
  && npm prune -w payment-intent-service --omit=dev

FROM node:22-bookworm-slim AS run
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/payment-intent-service/package.json ./payment-intent-service/
COPY --from=build /app/payment-intent-service/dist ./payment-intent-service/dist

WORKDIR /app/payment-intent-service
ENV NODE_ENV=production
ENV PORT=3090
EXPOSE 3090
CMD ["node", "dist/index.js"]
