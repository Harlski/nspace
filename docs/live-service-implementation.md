# Live service implementation plan

This document defines how to launch `nspace` as a public live service with:

- Frontend hosted separately as a SPA (Vercel).
- Backend hosted as a Dockerized Node service.
- Action/event logging that supports historical replay.
- Launch rule: players can build/edit/delete obstacles, but cannot create new walkable floor tiles.

## 1) Target deployment architecture

### Frontend (Vercel)

- Build and host the `client` workspace as a static SPA.
- Configure environment variables at build time for API and WebSocket base URLs.
- Example public URLs:
  - SPA: `https://nspace.example.com`
  - API + WS: `https://api.nspace.example.com`

### Backend (Docker on VPS)

- Run `server` in Docker behind a reverse proxy (Nginx or Caddy).
- Expose only `80/443` publicly at the proxy layer.
- Keep Node service private to Docker network or localhost-equivalent.

### Data/logging

- Persist world state and logs to mounted volumes.
- Keep logs append-only for audit/replay use.

## 2) Required decoupling changes (client -> backend URLs)

Current client auth and websocket code uses relative paths (`/api`, `/ws`), which assumes same-origin hosting.
For Vercel SPA + separate backend, move to explicit runtime-configured base URLs.

### Add client env variables

- `VITE_API_BASE_URL` (e.g. `https://api.nspace.example.com`)
- `VITE_WS_BASE_URL` (e.g. `wss://api.nspace.example.com`)

### Update client networking

- In `client/src/auth/nimiq.ts`:
  - Replace `fetch("/api/auth/nonce")` with `fetch(`${API_BASE}/api/auth/nonce`)`.
  - Replace `fetch("/api/auth/verify")` similarly.
- In `client/src/ui/adminOverlay.ts`:
  - Replace `fetch("/api/admin/random-layout")` with base URL variant.
- In `client/src/net/ws.ts`:
  - Build websocket URL from `VITE_WS_BASE_URL` (fallback to current-origin for local dev).

### Keep local developer experience

- Preserve current relative-path behavior when env vars are absent.
- Example fallback approach:
  - `API_BASE = import.meta.env.VITE_API_BASE_URL || ""`
  - `WS_BASE = import.meta.env.VITE_WS_BASE_URL || autoFromLocation()`

## 3) Backend containerization plan

### Dockerfile (server-focused)

- Build TypeScript in a builder stage.
- Run `node dist/index.js` in a slim runtime stage.
- Include only production dependencies in final image.
- Run with `NODE_ENV=production`.

### Suggested runtime env

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT=3001`
- `JWT_SECRET=<strong random secret>`
- `WORLD_STATE_DIR=/data/world`
- `EVENT_LOG_DIR=/data/events`
- `CORS_ALLOWED_ORIGINS=https://nspace.example.com` (comma-separated if needed)
- `ALLOW_EXTRA_FLOOR_PLACE=0` (new flag for launch rule)

### Volume mounts

- `/data/world` for world state (`world-state.json`).
- `/data/events` for append-only gameplay events.

## 4) Launch gameplay policy

For first public deploy:

- Allow obstacle creation/edit/removal/move:
  - `placeBlock`
  - `setObstacleProps`
  - `removeObstacle`
  - `moveObstacle`
- Disallow creation of new walkable floor:
  - block `placeExtraFloor`
- Optional decision:
  - either keep `removeExtraFloor` enabled (strictly matches "cannot create new"),
  - or also disable removal to reduce griefing.

### Implementation detail

In `server/src/rooms.ts`, guard `placeExtraFloor` handling with an env flag:

- `const ALLOW_EXTRA_FLOOR_PLACE = process.env.ALLOW_EXTRA_FLOOR_PLACE === "1";`
- If false, ignore or respond with `{ type: "error", code: "floor_place_disabled" }`.

## 5) Public security baseline (must-do)

- Require `JWT_SECRET` in production; fail startup if missing or weak.
- Remove permissive default CORS; enforce allowlist.
- Protect or disable `POST /api/admin/random-layout` in production.
- Keep `DEV_AUTH_BYPASS` disabled in all non-dev environments.
- Add reverse-proxy rate limiting and request body limits.

## 6) Event logging for replay/time-travel

Replay support requires an authoritative event stream plus periodic snapshots.

### 6.1 Event model

Create a normalized server event envelope:

- `ts` (server timestamp, ms)
- `roomId`
- `actor` (wallet address or system)
- `type` (move/chat/build/floor/roomJoin/roomLeave/etc)
- `payload` (validated event-specific fields)
- `seq` (monotonic sequence per room or global)

Suggested event types:

- `player_joined`
- `player_left`
- `move_to_requested`
- `position_tick` (or sampled movement points)
- `block_placed`
- `block_updated`
- `block_removed`
- `block_moved`
- `extra_floor_placed` (if feature enabled later)
- `extra_floor_removed`
- `chat_sent`

### 6.2 Write path

- Log events from the server authority (`rooms.ts` + tick loop).
- Do not trust client-reported states as final truth.
- Use append-only JSONL files (daily rotation), for example:
  - `/data/events/2026-04-10.jsonl`

### 6.3 Snapshots

- Persist room snapshots every N seconds (e.g. 10-30s) or every M events.
- Snapshot includes:
  - players
  - placed obstacles
  - extra floor set
  - room metadata

### 6.4 Replay API

Add read-only APIs on server:

- `GET /api/replay/rooms/:roomId?from=<ts>&to=<ts>`
- `GET /api/replay/snapshot/:roomId?at=<ts>`

These endpoints provide snapshot + event range for a replay viewer.

### 6.5 Replay viewer modes

- Live speed (`1x`) with event timestamps.
- Fast-forward (`2x`, `4x`, `8x`).
- Scrub to timestamp and reconstruct world state from nearest snapshot + events.

### 6.6 Storage evolution path

Phase 1:

- JSONL + periodic snapshot JSON files on disk.

Phase 2:

- Move to Postgres (events table + snapshot table) for indexing/query performance.

## 7) Suggested implementation phases

### Phase A: Decouple hosting (required for first split deploy)

1. Add API/WS base envs in client.
2. Update fetch/ws callsites.
3. Add CORS allowlist env parsing in server.
4. Validate Vercel build with production backend URL.

### Phase B: Backend packaging and operations

1. Add Dockerfile + `.dockerignore`.
2. Add `docker-compose.yml` (app + reverse proxy optional).
3. Add healthcheck route use in container/orchestrator.
4. Mount persistent volumes for world and event data.

### Phase C: Launch policy toggles

1. Add `ALLOW_EXTRA_FLOOR_PLACE` gate in message handler.
2. (Optional) add `ALLOW_EXTRA_FLOOR_REMOVE`.
3. Document production env defaults.

### Phase D: Logging and replay foundations

1. Add event logger utility + JSONL writer.
2. Emit events from room authority and tick loop.
3. Add periodic snapshot writer.
4. Add replay read APIs.
5. Build lightweight replay UI (admin-only first).

## 8) Acceptance criteria for first public launch

- SPA loads from Vercel and connects to separate backend domain.
- Wallet auth works across origins.
- WebSocket gameplay sync stable under normal user load.
- Players can build/edit/delete obstacles.
- Players cannot place new extra floor tiles.
- World state persists across backend restarts.
- Event logs are persisted and can reconstruct at least one room session.

