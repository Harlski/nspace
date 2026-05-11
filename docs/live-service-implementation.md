# Split hosting and live deployment (today)

This document describes how **Nimiq Space** is structured for production-style hosting: static SPA, API/WebSocket backend, Docker, and persistence. For backlog ideas (extra-floor launch flags, richer replay APIs, CORS allowlists), see [brainstorm/live-service-future.md](brainstorm/live-service-future.md).

## Architecture

- **SPA (e.g. Vercel):** Build the `client` workspace. Repo-root [`vercel.json`](../vercel.json) runs `npm run build -w client` with `outputDirectory: client/dist` and rewrites `/api/*`, `/nim-chart-api/*`, and selected routes to the production API host (`https://api.nimiq.space/...` in this repo’s config). **`/patchnotes`** (and `/patchnotes/`) rewrite to **`/index.html`** so the static host does not 404 on that client-only route. If Vercel **Root Directory** is `client`, use [`client/vercel.json`](../client/vercel.json) instead and avoid conflicting dashboard overrides.
- **Backend:** Node `server` behind TLS (Caddy/Nginx). [`docker-compose.yml`](../docker-compose.yml) builds the app image from the repo root, publishes `nspace` on `127.0.0.1:3001`, and runs optional **`nim-chart`** on `127.0.0.1:3080` for price chart data (see [deploy-github-docker.md](deploy-github-docker.md)).
- **Payment intents (optional):** Compose service `payment-intent` (profile **`payment`**) builds [`payment-intent-service`](../payment-intent-service/) as its own image, listens on `127.0.0.1:3090`, and persists SQLite under host `./data/payment-intent/`. Intended for server-to-server use (Bearer `PAYMENT_INTENT_API_SECRET`); the main game server does not call it yet. Details: [docker-deployment.md](docker-deployment.md).
- **Admin monitoring:** When `PAYMENT_INTENT_SERVICE_URL` is set on the game server, `GET /api/admin/system/snapshot` probes the sidecar’s `/health` and (if `PAYMENT_INTENT_API_SECRET` is also set on the game server) `GET /v1/meta/features`; `/admin/system` renders the result.
- **Data:** Compose mounts host `./data` → `/app/server/data` for `world-state.json`, `signboards.json`, `canvas-claims.json`, JSONL under `events/`, and the Nim payout queue (`nim-payout-pending.json` under the same tree unless overridden with `NIM_PAYOUT_DATA_DIR`; see [docker-deployment.md](docker-deployment.md)). Override paths with `WORLD_STATE_DIR` / `EVENT_LOG_DIR` when not using defaults.

## Client ↔ API when origins differ

- **`VITE_API_BASE_URL`** — API origin; empty means same-origin (Vite dev proxy or single-host prod). Implemented in [`client/src/net/apiBase.ts`](../client/src/net/apiBase.ts) (`apiUrl()`).
- **`VITE_WS_BASE_URL`** — WebSocket origin override; otherwise derived from the page / API base. See [`client/src/net/ws.ts`](../client/src/net/ws.ts).
- **Build-time chart URL:** Docker build args / Vercel env may set `VITE_NIM_CHART_API_URL` (see compose `args` and deploy docs).

## Auth and security (as implemented)

- **JWT:** In production, [`server/src/index.ts`](../server/src/index.ts) requires `JWT_SECRET` and rejects the dev placeholder. Development may use `JWT_SECRET=dev-insecure-change-me` with `npm run dev -w server` (see [server/.env.example](../server/.env.example)).
- **CORS:** Express uses `cors({ origin: true, credentials: true })` — permissive. Tightening with an allowlist is still recommended for hardened public deployments (tracked in [brainstorm/live-service-future.md](brainstorm/live-service-future.md)).
- **Admin HTTP:** `POST /api/admin/random-layout` remains sensitive if exposed; see [process.md](process.md) and [features-checklist.md](features-checklist.md).

## Replay and telemetry

- **JSONL** append-only logs under `EVENT_LOG_DIR` (default `server/data/events`).
- **Replay HTTP API** (Bearer JWT): `GET /api/replay/players`, `GET /api/replay/sessions`, `GET /api/replay/session/:sessionId/events` in [`server/src/index.ts`](../server/src/index.ts).
- **Session replay UI** in the client main menu is shown only on localhost; see [process.md](process.md).

## Deploy automation

GitHub Actions workflow [`.github/workflows/deploy-docker.yml`](../.github/workflows/deploy-docker.yml): on push to `main`, SSH to the server; if **`DEPLOY_RESTART_HOOK_SECRET`** is in host `.env`, **`curl`** `POST /api/hooks/pre-deploy-restart` (60s notice) then **`sleep 60`**; then `docker compose stop`, tarball of host `data/` under `backups/`, then `git fetch` + `git reset --hard origin/main`, `docker compose build`, and `docker compose up -d`. Setup: [deploy-github-docker.md](deploy-github-docker.md).

## Extra floor “launch policy”

There is **no** `ALLOW_EXTRA_FLOOR_PLACE` environment flag in server code yet. If product needs to block `placeExtraFloor` in production, implement the gate in `server/src/rooms.ts` and document the env in [process.md](process.md) — design notes live under [brainstorm/live-service-future.md](brainstorm/live-service-future.md).
