# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
# postinstall runs patch-package; needs these before npm ci
COPY scripts/postinstall.cjs scripts/
COPY patches/ patches/

RUN npm ci

COPY client/ client/
COPY server/ server/

# Vite embeds VITE_* at build time. Set in repo root .env for `docker compose build` substitution.
ARG VITE_NIM_CHART_API_URL=
ENV VITE_NIM_CHART_API_URL=${VITE_NIM_CHART_API_URL}

RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS run
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/client/package.json ./client/
COPY --from=build /app/server/package.json ./server/
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

WORKDIR /app/server
ENV NODE_ENV=production

# JWT_SECRET must be provided at runtime via environment variable
# The server will refuse to start without it for security
# See docker-compose.yml or pass via: docker run -e JWT_SECRET=<your-secret>

EXPOSE 3001
CMD ["node", "dist/index.js"]
