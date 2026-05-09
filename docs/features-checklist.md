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
- [x] **Wallet rooms:** configurable default **entry spawn** (persisted in `rooms.json` v6+); used when a player has no saved position in that room; `updateRoom` with `joinSpawn`, `welcome` / `roomJoinSpawn` wire updates; build-mode floor ring + **Entry spawn** tool ([server/src/roomRegistry.ts](../server/src/roomRegistry.ts), [server/src/rooms.ts](../server/src/rooms.ts), [client/src/main.ts](../client/src/main.ts))

## Movement

- [x] `moveTo` — server pathfinding over walkable tiles, obstacles blocking non-passable cells
- [x] Path queue + movement tick (`MOVE_SPEED`, arrival epsilon)
- [x] Walk bounds expanded when extra floor exists (see `walkBounds` in rooms)

## Building — blocks / obstacles

- [x] `placeBlock` / `setObstacleProps` — passable, half, quarter, hex, **pyramid** (+ base scale), **sphere**, **ramp** (+ direction), `colorId`, and related props (see `PlacedProps` / `TerrainProps` in [server/src/rooms.ts](../server/src/rooms.ts))
- [x] `removeObstacle`, `moveObstacle` (props preserved)
- [x] Client: build mode (`B`), placement bar, object edit panel, reposition flow — **translucent hover ghost** for valid move targets (gates: ghost + exit/front tints + frozen source opening; billboards: footprint + interact ghost; other obstacles: `makeBlockMesh` ghost; see [docs/THE-LARGER-SYSTEM.md](THE-LARGER-SYSTEM.md))
- [x] Client meshes: box / hex / pyramid / sphere / ramp, heights, palette ([client/src/game/blockStyle.ts](../client/src/game/blockStyle.ts))
- [x] Active **claimable** (minable) blocks: gold styling + additive sparkle particles around the mesh ([client/src/game/Game.ts](../client/src/game/Game.ts) `makeMineableSparklePoints` / `updateMineableBlockSparkles`)

## Billboards & world objects

- [x] In-world **billboards** (slideshow URLs / presets, placement rules, live chart integration) — server `billboards.ts` + client `billboard*.ts`
- [x] **Teleporters** between rooms (`placePendingTeleporter`, `configureTeleporterDestination`, … in [server/src/rooms.ts](../server/src/rooms.ts))
- [x] **Gates** — `placePendingGate` (`exitDir`, optional **`colorId`** → persisted `gate` + `colorId`; `faceDir` ignored, **`rampDir` 0** for new gates; hinge animation follows **exit side** on the client), `openGate` (in **hub** / `lobby`, ACL not required to open or to use an open gate for movement); **`gateWalkBlocked`** to opener when the gate **visually opens** but exit/front is unwalkable or there is no path (client float: **You can't walk into that**); **green/red floor tint** on exit vs front neighbors while placing or moving a gate (walkability/blocking **feedback**; **placement** allows unwalkable exit/front; server still blocks hub spawn tiles, signpost on the gate tile, or other players on gate/exit/front (editor may stand on exit/front while rotating); obstacle `gate` wire includes `adminAddress` + `authorizedAddresses` (up to 5, legacy single-address migrated); **`setGateAuthorizedAddresses`** (gate owner or server admin; non-admins may only add wallets currently in the room); **gate ACL editor** in HUD (identicon rows, remove; **add opener** list shows identicon + name); **Permissions** button on the object panel opens the ACL editor; **context menu** lists **Open gate** for every viewer (unauthorized → client floating **You can't open that** with gentle spring motion); **double-click** the gate in walk mode when cardinally adjacent (within place radius) opens if allowed (non-hub: ACL; **hub**: anyone; same denial float if not); thin hinged client mesh (palette `colorId`); walk goal is the neighbor across the gate from the opener; **object panel** edits **opening direction** + **color** via `setObstacleProps` (`gateExitDir`; gate **`rampDir` 0** on save); while **moving** a gate, a **semi-transparent ghost** shows the preview at the hover tile, tints follow the preview, and the **placed** mesh at the source keeps its **original** opening until the move ends; **terrain/pathfind** does not treat a gate as a layer-1 “block top” stance (passage only), so when `gateOpen` ends the snap-to-grid step moves standers to nearby walkable floor instead of the door’s upper surface ([server/src/rooms.ts](../server/src/rooms.ts), [server/src/grid.ts](../server/src/grid.ts), [client/src/game/gateAuth.ts](../client/src/game/gateAuth.ts), [client/src/game/Game.ts](../client/src/game/Game.ts), [client/src/ui/hud.ts](../client/src/ui/hud.ts), [client/src/main.ts](../client/src/main.ts), [client/src/net/ws.ts](../client/src/net/ws.ts))
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

- [x] **Patch notes** — main-menu version label links to **`/patchnotes`**, which lists frozen semver releases from `patchnote/versions/<x.y.z>/public/*.md` (bundled at client build time); newest release expanded by default; optional list tags **`[NEW]`**, **`[FIX]`**, **`[CHANGE]`**, **`[PERF]`**, **`[OPS]`**, **`[SEC]`** render as badges ([`client/src/patchnotes/`](../client/src/patchnotes/), editorial guide [patchnotes-release.md](patchnotes-release.md))
- [x] In-game **header marquee** — streak ticker: seamless duplicated strip (`translateX` `0` → `-50%` of track), duration from measured half-width; **per-chunk invisible fill** when text is shorter than the ticker so a full loop covers the **visible width** on large screens; `ResizeObserver` + image load/error remeasure (identicons). With announcements, next line after **one full horizontal loop** (`animationiteration`); server **`marqueeStreakSeconds`** is safety fallback; message dwell **`marqueeMessageSeconds`** (`GET /api/header-marquee`, `/admin/header`, persisted JSON stores)
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
