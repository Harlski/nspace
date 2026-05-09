# Process and conventions

How we extend the game and run it locally. Prefer linking to source files over duplicating magic numbers here.

## Adding a server-synced concept (pattern)

Obstacles are the reference case ([server/src/rooms.ts](../server/src/rooms.ts), [client/src/net/ws.ts](../client/src/net/ws.ts), [client/src/game/Game.ts](../client/src/game/Game.ts)):

1. **Server**: Extend stored props (`PlacedProps`), message handlers (`placeBlock`, `setObstacleProps`, dedicated intents like `setGateAuthorizedAddresses` when the edit is not a generic prop patch, …), **server →client** notifications (e.g. `gateWalkBlocked` after `openGate`), and `obstaclesToList` / broadcast payloads.
2. **Wire types**: Mirror fields on `ObstacleTile` / `ObstacleProps` in `ws.ts`.
3. **Client game**: Parse in `setObstacles`, keep in `placedObjects`, rebuild or update meshes when relevant fields change.
4. **HUD**: If players edit the concept, extend the panel / placement bar and message senders.

Keep server validation strict (clamp enums, reject impossible combos).

## Rate limits and cooldowns

Defined near the top of [server/src/rooms.ts](../server/src/rooms.ts), for example:

- `RATE_MOVE_TO_MS` — throttles `moveTo`
- `RATE_CHAT_MS` — chat
- `RATE_PLACE_MS` — placement and obstacle edits

Adjust when tuning feel or abuse resistance.

## Tick loop

`startRoomTick` runs on a fixed interval (`TICK_MS`):

- Advances each connected client’s `pathQueue` into `player` x/z and vx/vz.
- Advances **fake players** the same way, then runs idle / random-destination logic for NPCs.
- Broadcasts `{ type: "state", players }` when positions changed **and** at least one real client is in the room (NPCs alone do not need network traffic).

## Environment variables

| Variable | Where | Notes |
|----------|--------|--------|
| `JWT_SECRET` | server | Required for real auth; dev script uses a placeholder |
| `DEV_AUTH_BYPASS` | server | `1` = skip signature verification (development only) |
| `NODE_ENV` | server | `development` enables bypass flag pairing in some setups |
| `PORT` | server | HTTP + WebSocket listen port (default `3001`) |
| `FAKE_PLAYER_COUNT` | server | `0`–`32` NPC wanderers per room (default **2**; display names prefixed with `[NPC]`; set `0` to disable) |
| `VITE_DEV_AUTH_BYPASS` | client | `1` shows Dev login |
| `VITE_ADMIN_ENABLED` | client | `true` shows Admin overlay (layout / fog / camera) |
| `VITE_HUB_URL` | client | Nimiq Hub base URL (optional override) |
| `VITE_API_BASE_URL` | client | API origin when SPA and API differ. Prefer full URL (`https://api.example.com`). Host-only (`api.example.com`) is normalized to `https://…` so it is not treated as a path on the SPA host. |
| `VITE_WS_BASE_URL` | client | Optional WebSocket origin (`wss://…` or host-only); otherwise derived from resolved API base or page |
| `EVENT_LOG_DIR` | server | Directory for append-only JSONL replay logs (`events-*.jsonl`); default `server/data/events` |
| `PLACE_RADIUS_BLOCKS` | server | Max horizontal distance for block place/edit/move actions (default `5`) |
| `PAYMENT_INTENT_API_SECRET` | payment-intent-service | Required when running the sidecar; `Authorization: Bearer …` on `/v1/*` |
| `PAYMENT_INTENT_RECIPIENT_ADDRESS` | payment-intent-service | Hot wallet (incoming NIM) user-friendly address |
| `PAYMENT_INTENT_SQLITE_PATH` | payment-intent-service | SQLite path (default `./data/payment-intents.sqlite`; Docker compose uses `/data/payment-intents.sqlite`) |
| `PAYMENT_INTENT_TTL_MS` | payment-intent-service | Intent expiry (default 30 minutes; minimum 60 seconds) |
| `PAYMENT_INTENT_MIN_CONFIRMATIONS` | payment-intent-service | Minimum confirmations before verify succeeds (default `1`) |
| `NIM_NETWORK` | payment-intent-service | Same network id as the game server (`testalbatross`, `mainalbatross`, …) |
| `NIM_CLIENT_LOG_LEVEL` | payment-intent-service | Nimiq client log level (default `warn`) |
| `PAYMENT_INTENT_SERVICE_URL` | server | Base URL of the payment-intent sidecar for `/admin/system` probes (e.g. `http://127.0.0.1:3090` or `http://payment-intent:3090` in Compose) |
| `PAYMENT_INTENT_API_SECRET` | server | Same secret as the sidecar; when set on the game server, `/admin/system` also probes `GET /v1/meta/features` |

**Admin HTTP API**: `POST /api/admin/random-layout` is currently **unauthenticated** in [server/src/index.ts](../server/src/index.ts). Do not expose that endpoint publicly without adding a secret or network restriction. The client `.env.development` comment mentioning `ADMIN_SECRET` is misleading unless you add server-side checks.

**Replay HTTP API** (requires `Authorization: Bearer <JWT>`): `GET /api/replay/players`, `GET /api/replay/sessions?address=…`, `GET /api/replay/session/:id/events`. The main menu “Session replay” panel is shown **only when the page is opened on localhost** (`127.0.0.1`, `::1`, etc.); production builds on public hosts do not expose that UI (APIs remain callable with a valid JWT for tooling).

**Today:** `remove_obstacle` JSONL rows store tile coordinates; see [brainstorm/features-future.md](brainstorm/features-future.md) for optional richer logging ideas.

## Local development

- From repo root: `npm install`, then `npm run dev` — runs Vite (default [http://127.0.0.1:5173](http://127.0.0.1:5173)) and the server with `tsx watch`; Vite proxies `/api` and `/ws` to `3001`.
- Optional payment intent sidecar: `npm run dev:payment-intent` (requires `PAYMENT_INTENT_*` and `NIM_NETWORK`; see [docker-deployment.md](docker-deployment.md)).
- [client/.env.development](../client/.env.development) can enable dev login and admin UI; match `DEV_AUTH_BYPASS` on the server for dev login.
- Production: `npm run build` (client + server), then `npm run start -w server` with a strong `JWT_SECRET` and **no** `DEV_AUTH_BYPASS`.

## Testing changes

- Run `npm run build` at the repo root before merging larger changes (builds client and server).
- Exercise WebSocket flows with at least two browser profiles or machines when touching sync or room logic.
