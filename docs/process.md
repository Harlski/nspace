# Process and conventions

How we extend the game and run it locally. Prefer linking to source files over duplicating magic numbers here.

## Adding a server-synced concept (pattern)

Obstacles are the reference case ([server/src/rooms.ts](../server/src/rooms.ts), [client/src/net/ws.ts](../client/src/net/ws.ts), [client/src/game/Game.ts](../client/src/game/Game.ts)):

1. **Server**: Extend stored props (`PlacedProps`), message handlers (`placeBlock`, `setObstacleProps`, …), and `obstaclesToList` / broadcast payloads.
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
| `FAKE_PLAYER_COUNT` | server | `0`–`32` NPC wanderers per room when humans are present |
| `VITE_DEV_AUTH_BYPASS` | client | `1` shows Dev login |
| `VITE_ADMIN_ENABLED` | client | `true` shows Admin overlay (layout / fog / camera) |
| `VITE_HUB_URL` | client | Nimiq Hub base URL (optional override) |

**Admin HTTP API**: `POST /api/admin/random-layout` is currently **unauthenticated** in [server/src/index.ts](../server/src/index.ts). Do not expose that endpoint publicly without adding a secret or network restriction. The client `.env.development` comment mentioning `ADMIN_SECRET` is misleading unless you add server-side checks.

## Local development

- From repo root: `npm install`, then `npm run dev` — runs Vite (default [http://127.0.0.1:5173](http://127.0.0.1:5173)) and the server with `tsx watch`; Vite proxies `/api` and `/ws` to `3001`.
- [client/.env.development](../client/.env.development) can enable dev login and admin UI; match `DEV_AUTH_BYPASS` on the server for dev login.
- Production: `npm run build` (client + server), then `npm run start -w server` with a strong `JWT_SECRET` and **no** `DEV_AUTH_BYPASS`.

## Testing changes

- Run `npm run build` at the repo root before merging larger changes (builds client and server).
- Exercise WebSocket flows with at least two browser profiles or machines when touching sync or room logic.
