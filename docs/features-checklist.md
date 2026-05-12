# Feature checklist

Inventory of major areas as implemented in the repo. Use checkboxes for tracking; not all items may need to stay checked in every fork.

## Payment intents (optional microservice)

- [x] Workspace [`payment-intent-service`](../payment-intent-service/) — Express HTTP API, SQLite ledger, Nimiq `getTransaction` verification for incoming NIM to a configured hot wallet
- [x] Docker image + Compose service `payment-intent` (profile **`payment`**); not wired from the main game server yet (server-to-server integration TBD)
- [x] Pluggable **`featureKind`** handlers (`nspace.test.min` + reserved stubs for usernames, billboard slots, land, teleporter — see `src/features/builtin.ts`)
- [x] `/admin/system` — when `PAYMENT_INTENT_SERVICE_URL` is set on the game server, snapshot includes **health** + optional **authenticated API** probe (`PAYMENT_INTENT_API_SECRET`); see [`server/src/paymentIntentProbe.ts`](../server/src/paymentIntentProbe.ts)

## Auth and session

- [x] `GET /api/auth/nonce` — challenge nonce
- [x] `POST /api/auth/verify` — Nimiq signed message → JWT + address (or dev bypass); first-time wallets must send `acceptedTermsPrivacyVersion` matching server `termsPrivacyVersion` until ack is recorded in server data (`terms-privacy-acceptance.json`; optional **`TERMS_PRIVACY_ACCEPTANCE_STORE_FILE`** / legacy **`LEGAL_CONSENT_STORE_FILE`**)
- [x] WebSocket auth via `token` query param
- [x] Client session cache (localStorage) for token + address
- [x] Dev login path when `DEV_AUTH_BYPASS=1` on server and `VITE_DEV_AUTH_BYPASS=1` on client

## Multiplayer

- [x] `welcome` with self, others, room id, bounds, doors, obstacles, extra floor
- [x] **`chatBacklog` on `welcome`** — bounded per-room buffer of recent non-bubble `chat` lines (reconnect / room switch)
- [x] Periodic `state` / `stateDelta` with players’ positions and velocities (server tick; delta when only a subset changed)
- [x] `playerJoined` / `playerLeft`
- [x] `chat` broadcast with rate limit
- [x] **`serverNotice` / `restart_pending`** — game-admin **`POST /api/admin/announce-restart`** (`etaSeconds` 5–7200, optional `message`) broadcasts a maintenance countdown on **all** game WebSockets, then exits via the normal shutdown path; optional **`POST /api/hooks/pre-deploy-restart`** (Bearer **`DEPLOY_RESTART_HOOK_SECRET`**, same body) for **GitHub Actions → VPS** deploy ([`.github/workflows/deploy-docker.yml`](../.github/workflows/deploy-docker.yml): 60s notice + wait before `docker compose stop`); client **HUD banner** + friendlier **disconnect** status line ([server/src/index.ts](../server/src/index.ts), [server/src/config.ts](../server/src/config.ts), [server/src/rooms.ts](../server/src/rooms.ts), [client/src/net/ws.ts](../client/src/net/ws.ts), [client/src/main.ts](../client/src/main.ts), [client/src/ui/hud.ts](../client/src/ui/hud.ts))

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
- [x] Active **claimable** (minable) blocks: gold styling + additive sparkle particles around the mesh ([client/src/game/Game.ts](../client/src/game/Game.ts) `makeMineableSparklePoints` / `updateMineableBlockSparkles`); **start claim** via **primary click on the block** (adjacent or pathfind-to-neighbor) or **right-click → Mine** on the unified world context menu. **Mine** menu row shows **`(50% ↑ time)`** in red (longer server hold for context-menu paths `world_ctx_*`). Inactive (cooldown) claimable blocks: primary click shows **“There's no NIM left here :(”** at the avatar (`showSelfPlayerActionMessage`). **Walk here** on an empty walkable tile (same menu, walk mode only; `Game.setWorldTileContextOpener` / `hud.showWorldTileContextMenu` in [client/src/main.ts](../client/src/main.ts)). **Mine** from the menu **pathfinds to a cardinal neighbor** when needed, then runs the same claim UI; **Walk here** with no valid path shows **“I can't move here”** as the same **floating world text** used for gate denial and mining rewards (`Game.showSelfPlayerActionMessage` → `showFloatingText`). **`beginBlockClaim.claimIntent`** (`world_ctx_adjacent`, `world_ctx_auto_walk`, `direct_adjacent_click`) is logged as **`begin_block_claim`** in gameplay JSONL for analytics.

## Billboards & world objects

- [x] **Signposts** (message signs on passable half-slabs) — server `signboards.ts`; client HUD tooltip + **floating `duotone-document` hint** (`nimiq-icons`) above tiles with `signboardId` in `obstacles` / `obstaclesDelta` ([client/src/game/Game.ts](../client/src/game/Game.ts)); subtle bounce; hidden in build mode; **hint hidden when stacked blocks sit on the tile or another placed mesh blocks the segment from the camera to the icon** (per-frame ray vs `blockMeshes`, skipping the signpost’s own group); **softer hint when idle, more solid while that signpost is tooltip-hovered**; uniform screen-space scale/vertical anchor across signpost blocks; sprite uses the same pick-skip pattern as name labels
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

- [x] **Patch notes** — main-menu version label links to **`/patchnotes`**, which shows frozen semver releases from `patchnote/versions/<x.y.z>/public/*.md` (bundled at client build time); **version** and **audience** dropdowns pick release and tier (**Brief** / **Players** / **Operators** / **Developers** / optional **Hotfix** when `04-hotfix.md` exists), with newest release selected by default; optional list tags **`[NEW]`**, **`[FIX]`**, **`[CHANGE]`**, **`[PERF]`**, **`[OPS]`**, **`[SEC]`** render as badges ([`client/src/patchnotes/`](../client/src/patchnotes/), editorial guide [patchnotes-release.md](patchnotes-release.md))
- [x] In-game **header marquee** — streak ticker: seamless duplicated strip (`translateX` `0` → `-50%` of track), duration from measured half-width; **per-chunk invisible fill** when text is shorter than the ticker so a full loop covers the **visible width** on large screens; `ResizeObserver` + image load/error remeasure (identicons); streak names open that player’s profile card. With announcements, next line after **one full horizontal loop** (`animationiteration`); server **`marqueeStreakSeconds`** is safety fallback; message dwell **`marqueeMessageSeconds`** (`GET /api/header-marquee`, `/admin/header`, persisted JSON stores). **Client:** after the player has seen every announcement line once (streak+news or news-only), the marquee **fades out** and stays hidden for **10 minutes** unless **`/admin/header`** lines change (signature match in `localStorage` key `nspace.headerMarquee.newsSuppress`); **streak-only** (no lines) is unchanged
- [x] In-game **player profiles** — profile card shows display name, wallet actions, description, recent aliases, Nimiq Pay session badge, and up to 3 owned rooms from `GET /api/player-profile/:address` (public rooms for everyone; private rooms only to the owner or admins). Server and client treat visibility as **`isPublic === true`** for non-owner, non-admin viewers so private or ambiguous entries never appear on someone else’s card. Each `rooms[]` entry includes a live **`playerCount`**; the server returns the three busiest rooms first (by real players online). Rows show **room name + live count** with the Nimiq **`person-1`** icon (`i-nimiq:person-1`, inline SVG via `nimiq-icons`) instead of join codes. Room rows open a join confirmation; admin-only controls use inline username edit + Actions dropdown for clear / ban / mute. The HUD **players** pill shows **in this room / online total** when those numbers differ.
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
