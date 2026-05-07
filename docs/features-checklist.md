# Feature checklist

Inventory of major areas as implemented in the repo. Use checkboxes for tracking; not all items may need to stay checked in every fork.

## Payment intents (optional microservice)

- [x] Workspace [`payment-intent-service`](../payment-intent-service/) — Express HTTP API, SQLite ledger, Nimiq `getTransaction` verification for incoming NIM to a configured hot wallet
- [x] Docker image + Compose service `payment-intent` (profile **`payment`**); not wired from the main game server yet (server-to-server integration TBD)
- [x] Pluggable **`featureKind`** handlers (`nspace.test.min` + reserved stubs for usernames, billboard slots, land, teleporter — see `src/features/builtin.ts`)
- [x] `/admin/system` — when `PAYMENT_INTENT_SERVICE_URL` is set on the game server, snapshot includes **health** + optional **authenticated API** probe (`PAYMENT_INTENT_API_SECRET`); see [`server/src/paymentIntentProbe.ts`](../server/src/paymentIntentProbe.ts)

## Auth and session

- [x] `GET /api/auth/nonce` — challenge nonce
- [x] `POST /api/auth/verify` — Nimiq signed message → JWT + address (or dev bypass)
- [x] WebSocket auth via `token` query param
- [x] Client session cache (localStorage) for token + address
- [x] Dev login path when `DEV_AUTH_BYPASS=1` on server and `VITE_DEV_AUTH_BYPASS=1` on client

## Multiplayer

- [x] `welcome` with self, others, room id, bounds, doors, obstacles, extra floor
- [x] Periodic `state` / `stateDelta` with players’ positions and velocities (server tick; delta when only a subset changed)
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

- [x] `placeBlock` / `setObstacleProps` — passable, half, quarter, hex, **pyramid** (+ base scale), **sphere**, **ramp** (+ direction), `colorId`, and related props (see `PlacedProps` / `TerrainProps` in [server/src/rooms.ts](../server/src/rooms.ts))
- [x] `removeObstacle`, `moveObstacle` (props preserved)
- [x] Client: build mode (`B`), placement bar, object edit panel, reposition flow
- [x] Client meshes: box / hex / pyramid / sphere / ramp, heights, palette ([client/src/game/blockStyle.ts](../client/src/game/blockStyle.ts))
- [x] Active **claimable** (minable) blocks: gold styling + additive sparkle particles around the mesh ([client/src/game/Game.ts](../client/src/game/Game.ts) `makeMineableSparklePoints` / `updateMineableBlockSparkles`)

## Billboards & world objects

- [x] In-world **billboards** (slideshow URLs / presets, placement rules, live chart integration) — server `billboards.ts` + client `billboard*.ts`
- [x] **Teleporters** between rooms (`placePendingTeleporter`, `configureTeleporterDestination`, … in [server/src/rooms.ts](../server/src/rooms.ts))
- [x] **Voxel text** labels in-world (`setVoxelText`) — **admin-only**; persisted via `voxelTexts` module

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

Unshipped / backlog ideas: [brainstorm/features-future.md](brainstorm/features-future.md).

Adjust this checklist when you ship features.
