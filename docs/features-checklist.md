# Feature checklist

Inventory of major areas as implemented in the repo. Use checkboxes for tracking; not all items may need to stay checked in every fork.

## Auth and session

- [x] `GET /api/auth/nonce` — challenge nonce
- [x] `POST /api/auth/verify` — Nimiq signed message → JWT + address (or dev bypass)
- [x] WebSocket auth via `token` query param
- [x] Client session cache (localStorage) for token + address
- [x] Dev login path when `DEV_AUTH_BYPASS=1` on server and `VITE_DEV_AUTH_BYPASS=1` on client

## Multiplayer

- [x] `welcome` with self, others, room id, bounds, doors, obstacles, extra floor
- [x] Periodic `state` with all players’ positions and velocities (server tick)
- [x] `playerJoined` / `playerLeft`
- [x] `chat` broadcast with rate limit

## Rooms and travel

- [x] Hub (`hub` / legacy `lobby`) and chamber (`chamber`) with distinct base bounds
- [x] Doors on base grid; client reconnects with spawn hint when crossing
- [x] “Return to hub” when not in hub (client-driven room change)

## Movement

- [x] `moveTo` — server pathfinding over walkable tiles, obstacles blocking non-passable cells
- [x] Path queue + movement tick (`MOVE_SPEED`, arrival epsilon)
- [x] Walk bounds expanded when extra floor exists (see `walkBounds` in rooms)

## Building — blocks / obstacles

- [x] `placeBlock` with style: `half`, `quarter`, `hex`, `colorId`
- [x] `setObstacleProps` — `passable`, `half`, `quarter`, `hex`, `colorId`
- [x] `removeObstacle`, `moveObstacle` (props preserved)
- [x] Client: build mode (`B`), placement bar, object edit panel, reposition flow
- [x] Client meshes: box / hex prism, heights, palette ([client/src/game/blockStyle.ts](../client/src/game/blockStyle.ts))

## Floor

- [x] `placeExtraFloor` / `removeExtraFloor` (rules: connectivity, not on core base removal incorrectly)
- [x] Floor expand mode (`F`) on client
- [x] `POST /api/admin/random-layout` — random extra-tile growth (no auth in current server; see [server/src/index.ts](../server/src/index.ts))

## Replay / telemetry

- [x] Server JSONL event log per day (`EVENT_LOG_DIR`, `events-*.jsonl`) — session boundaries, moves, builds, chat
- [x] `GET /api/replay/players`, `/api/replay/sessions`, `/api/replay/session/:id/events` (Bearer JWT)
- [x] Main menu “Session replay” — pick player, session, action timeline (**localhost only**; hidden on public origins)
- [x] Server-side max distance for block actions (`PLACE_RADIUS_BLOCKS`, default 5 world units on XZ)

## UI / shell

- [x] Letterboxed 16∶9 HUD, status line, chat log + input
- [x] Fullscreen toggle
- [x] Input shell to reduce accidental browser shortcuts (best-effort)
- [x] Admin overlay (when `VITE_ADMIN_ENABLED=true`): random layout, fog tuning, zoom limits

## NPCs (fake players)

- [x] `FAKE_PLAYER_COUNT` env — server-side wanderers merged into `PlayerState` snapshots
- [x] Display names chosen from a curated list ([server/src/guestNames.ts](../server/src/guestNames.ts)); duplicates get a numeric suffix
- [x] Idle up to 2s between choosing new random destinations; cleared when room has no real clients

## Client-only / polish

- [x] Identicon texture on spheres; fallback if load fails (e.g. NPC addresses)
- [x] Fog-of-war tuning via admin or constants

---

## Future / not in scope (stub)

- [ ] Textured floor tiles (see [tile.md](../tile.md)); current floor is solid-colored planes
- [ ] Persistent world database — room state is in-memory per server process
- [ ] Mobile-targeted UI
- [ ] Production hardening of admin APIs (e.g. auth on `random-layout` if exposed publicly)

Adjust this list when adding features.
