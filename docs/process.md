# Process and conventions

How we extend the game and run it locally. Prefer linking to source files over duplicating magic numbers here.

## Adding a server-synced concept (pattern)

Obstacles are the reference case ([server/src/rooms.ts](../server/src/rooms.ts), [client/src/net/ws.ts](../client/src/net/ws.ts), [client/src/game/Game.ts](../client/src/game/Game.ts)):

1. **Server**: Extend stored props (`PlacedProps`), message handlers (`placeBlock`, `setObstacleProps`, dedicated intents like `setGateAuthorizedAddresses` when the edit is not a generic prop patch, …), **server →client** notifications (e.g. `gateWalkBlocked` after `openGate`; cross-cutting notices like `serverNotice`), and `obstaclesToList` / broadcast payloads.
2. **Wire types**: Mirror fields on `ObstacleTile` / `ObstacleProps` in `ws.ts`.
3. **Client game**: Parse in `setObstacles`, keep in `placedObjects`, rebuild or update meshes when relevant fields change.
4. **HUD**: If players edit the concept, extend the panel / placement bar and message senders.

Keep server validation strict (clamp enums, reject impossible combos).

## Rate limits and cooldowns

Defined near the top of [server/src/rooms.ts](../server/src/rooms.ts), for example:

- `RATE_MOVE_TO_MS` — throttles `moveTo`
- `RATE_CHAT_MS` — chat
- `CHAT_BACKLOG_MAX_LINES` / `CHAT_BACKLOG_WINDOW_MS` — in-memory room chat replay list included on each `welcome` (`chatBacklog`; not persisted across server restart). Non-empty backlog delivery is also logged as `chat_backlog_delivered` in the daily JSONL for admin audience queries.
- Player chat runs through shared profanity censor ([server/src/profanityFilter.ts](../server/src/profanityFilter.ts)); empty-after-censor sends return WS error `chat_blocked_profanity`. Successful `chat` events log censored `text`, optional `textOriginal`, `audienceLive`, and message `at` for admin history ([server/src/adminChatLog.ts](../server/src/adminChatLog.ts), `/admin/chat`).
- `RATE_PLACE_MS` — placement and obstacle edits

Adjust when tuning feel or abuse resistance.

## WebSocket: optional `claimIntent` on `beginBlockClaim`

Clients may send an optional string field **`claimIntent`** on **`beginBlockClaim`** ([client/src/net/ws.ts](../client/src/net/ws.ts) `sendBeginBlockClaim`). The server normalizes it to lowercase **`[a-z0-9_]`**, max **48** characters, and omits it when empty after normalization ([server/src/rooms.ts](../server/src/rooms.ts)). Each accepted begin is logged to the gameplay JSONL as **`begin_block_claim`** ([`ANALYTICS_EVENT_KINDS.beginBlockClaim`](../server/src/eventLog.ts)) with `claimId`, tile coordinates, and `claimIntent` when present. Current client slugs: **`world_ctx_adjacent`** (Mine from the world context menu while already cardinally beside the block), **`world_ctx_auto_walk`** (Mine from the menu or **primary-click** on the block from farther away; client pathfinds to a cardinal neighbor first), **`direct_adjacent_click`** (primary click on the block while already beside it — default hold duration). For **`world_ctx_adjacent`** and **`world_ctx_auto_walk`** only, the server requires **50% longer** adjacent hold than the default (`BLOCK_CLAIM_HOLD_MS` → **1.5×** in `blockClaimOffered.holdMs` and in the `completeBlockClaim` gate).

## WebSocket: campaign billboard audience stats

Clients sample every **~1s** while the game tab is visible, the player is not AFK (**2 minutes** without pointer/keyboard input), and not in the wallet-send away flow (`nimSendIntent`). When within **7 floor tiles** of a rotation billboard whose active slide maps to a funded campaign (`slideCampaignIds`), the client batches **`campaignImpression`** messages `{ items: [{ campaignId, visibleMs }] }` ([client/src/game/campaignBillboardVisibility.ts](../client/src/game/campaignBillboardVisibility.ts), [server/src/rooms.ts](../server/src/rooms.ts)). The server ignores impressions when **`nimSendIntent`** is active (tab hidden / wallet flow). Each accepted impression line **debits** `balance_luna` by `lunaPerSecond × visibleMs / 1000` ([server/src/campaignVisibilityEconomics.ts](../server/src/campaignVisibilityEconomics.ts) `lunaDrainForVisibleMs`) for **approved** campaigns; at zero balance the campaign **expires** and is removed from rotation sets. **Time left** in `/advertise` and `/admin/campaign` is derived from **remaining balance** at the on-screen rate (not a calendar estimate). Confirmed billboard **Visit** navigations send **`campaignLinkClick`**. Aggregates per wallet land in SQLite **`campaign_viewer_stats`** ([server/src/campaignAnalyticsStore.ts](../server/src/campaignAnalyticsStore.ts)). Legacy rows with `expires_at_ms` may still be expired by the hourly `tickExpiredCampaignBillboards` job until drained-only expiry applies to all campaigns.

## Tick loop

`startRoomTick` runs on a fixed interval (`TICK_MS`):

- Advances each connected client’s `pathQueue` into `player` x/z and vx/vz.
- Advances **fake players** the same way, then runs idle / random-destination logic for NPCs.
- Broadcasts `{ type: "state", players }` when positions changed **and** at least one real client is in the room (NPCs alone do not need network traffic).

## Environment variables

| Variable | Where | Notes |
|----------|--------|--------|
| `JWT_SECRET` | server | Required for real auth; dev script uses a placeholder |
| `DEPLOY_RESTART_HOOK_SECRET` | server | Optional. When set (≥16 chars), enables **`POST /api/hooks/pre-deploy-restart`** with `Authorization: Bearer …` for CI/VPS scripts (see [deploy-github-docker.md](deploy-github-docker.md)) |
| `TERMS_PRIVACY_ACCEPTANCE_STORE_FILE` | server | Optional JSON path for per-wallet Terms/Privacy acknowledgement (default `server/data/terms-privacy-acceptance.json`; merged read with legacy `legal-consent.json` when unset) |
| `PLAYER_LAST_SESSION_STORE_FILE` | server | Optional JSON path for last disconnect room/tile per wallet (default `server/data/player-last-sessions.json`; used by `resume=1` reconnect within **10 minutes**) |
| `FEEDBACK_STORE_FILE` | server | Optional JSON path for player feedback tickets (default `server/data/feedback/tickets.json`) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | server | Optional — ping on **new** feedback tickets, **username set** (`Name Update: wallet -> name`), connect notices, and the **end-of-day stats report** (not the authoritative store) |
| `DAILY_STATS_TELEGRAM_ENABLED` | server | Optional toggle for the **end-of-day stats Telegram report** (UTC). Defaults **on** when Telegram is configured; `0`/`false` disables, `1`/`true` forces on. Sent shortly after 00:00 UTC for the day that just ended: unique sign-ins, new users, **Nimiq Pay vs other**, NIM paid out, **NIM still pending in the payout queue plus a combined "Total NIM (sent + pending)"** so all NIM earned that day is counted, and **active in-game time** (capped-gap estimate, excludes long AFK). The pending NIM is snapshotted and reported **before** the end-of-day payout flush runs (see `NIM_PAYOUT_DAILY_FLUSH_ENABLED`), so the day's stats are not split across midnight. Manual trigger: `POST /api/admin/daily-stats/send?day=YYYY-MM-DD&send=1` (analytics admin wallet); manual sends report the live pending queue but never flush it. **`/admin/system`** also has a **Send last 24h to Telegram** button (rolling 24h window; `POST /api/admin/system/daily-stats/send`, `preview=1` to preview only; system admin wallet) |
| `DAILY_STATS_TELEGRAM_CHAT_ID` | server | Optional — send the daily stats report to a different chat than `TELEGRAM_CHAT_ID` |
| `DAILY_STATS_LOOKBACK_DAYS` | server | Optional — days of event logs scanned to decide **new users** (first-ever `session_start`); default **400** |
| `NIM_PAYOUT_DAILY_FLUSH_ENABLED` | server | Optional — at the **end of each UTC day** (from the daily-stats scheduler, ~00:02 UTC, **after** the stats report is sent), trigger the Payout Service to combine each recipient's pending jobs into one on-chain transfer (same path as admin **Payout in full**). Runs even when the Telegram report is off. Defaults **on** when `PAYOUT_SERVICE_*` is configured; `0`/`false` disables, `1`/`true` forces on |
| `PAYOUT_SERVICE_URL` | server | Base URL of the Payout Service sidecar (compose default: `http://payout:3091`) |
| `PAYOUT_SERVICE_API_SECRET` | server + payout | Shared Bearer secret for `/v1/*` routes |
| `NIM_PAYOUT_PRIVATE_KEY` | payout only | Hot-wallet signer key — **never** on the game server |
| `LEGAL_CONSENT_STORE_FILE` | server | Deprecated alias — same override as **`TERMS_PRIVACY_ACCEPTANCE_STORE_FILE`** |
| `DEV_AUTH_BYPASS` | server | `1` = skip signature verification (development only) |
| `STREAM_OBSERVER_ADDRESSES` | server | Comma-separated Nimiq wallets allowed for cinema `?stream=1` observer sessions (full-board tile sync). **Merged** with wallets saved in **`/admin/settings`** (runtime JSON). **Unset everywhere = stream observer disabled for everyone.** Spaces inside an address are optional. |
| `NODE_ENV` | server | `development` enables bypass flag pairing in some setups |
| `PORT` | server | HTTP + WebSocket listen port (default `3001`) |
| `FAKE_PLAYER_COUNT` | server | `0`–`32` NPC wanderers per room (default **2**; display names prefixed with `[NPC]`; set `0` to disable) |
| `VITE_DEV_AUTH_BYPASS` | client | `1` shows Dev login |
| `VITE_ADMIN_ENABLED` | client | `true` shows Admin overlay (layout / fog / camera / avatar / voxel; **Layout** includes build HUD **inspector preview** per-profile scale + ground-plane pan — **default** (blocks, gates, signposts, terrain thumbs), **billboard**, **teleporter** — persisted as JSON `localStorage` key `nspace_inspector_preview_layouts_v2`; legacy `nspace_inspector_preview_display_scale` / `_pan_*` migrate into **default** only) |
| `VITE_HUB_URL` | client | Nimiq Hub base URL (optional override) |
| `VITE_API_BASE_URL` | client | API origin when SPA and API differ. Prefer full URL (`https://api.example.com`). Host-only (`api.example.com`) is normalized to `https://…` so it is not treated as a path on the SPA host. |
| `VITE_WS_BASE_URL` | client | Optional WebSocket origin (`wss://…` or host-only); otherwise derived from resolved API base or page |
| `EVENT_LOG_DIR` | server | Directory for append-only JSONL replay logs (`events-*.jsonl`); default `server/data/events` |
| `PIXEL_PAINT_LOG_FILE` | server | Append-only Pixel room paint history for timelapse (`paint` + one-time `baseline` records); default `server/data/pixel/paint-log.jsonl` |
| `PLACE_RADIUS_BLOCKS` | server | Max horizontal distance for block place/edit/move actions (default `9`) |
| `PAYMENT_INTENT_API_SECRET` | payment-intent-service | Required when running the sidecar; `Authorization: Bearer …` on `/v1/*` |
| `PAYMENT_INTENT_RECIPIENT_ADDRESS` | payment-intent-service | Hot wallet (incoming NIM) user-friendly address |
| `PAYMENT_INTENT_SQLITE_PATH` | payment-intent-service | SQLite path (default `./data/payment-intents.sqlite`; Docker compose uses `/data/payment-intents.sqlite`) |
| `PAYMENT_INTENT_TTL_MS` | payment-intent-service | Intent expiry (default 30 minutes; minimum 60 seconds) |
| `PAYMENT_INTENT_MIN_CONFIRMATIONS` | payment-intent-service | Minimum confirmations before verify succeeds (default `1`) |
| `NIM_NETWORK` | payment-intent-service | Same network id as the game server (`testalbatross`, `mainalbatross`, …) |
| `NIM_CLIENT_LOG_LEVEL` | payment-intent-service | Nimiq client log level (default `warn`) |
| `PAYMENT_INTENT_SERVICE_URL` | server | Base URL of the payment-intent sidecar for `/admin/system` probes (e.g. `http://127.0.0.1:3090` or `http://payment-intent:3090` in Compose) |
| `PAYMENT_INTENT_API_SECRET` | server | Same secret as the sidecar; when set on the game server, `/admin/system` also probes `GET /v1/meta/features` |
| `DIRECT_INVITE_ENABLED` | server | Optional — enable Play Space / guest invite flow (defaults to **`WORLDCUP_ENABLED`** when unset) |
| `DIRECT_INVITE_TTL_MS` | server | Backstop TTL in ms for **abandoned** Play Space creates (default **900000** = 15 minutes). While a space is **open**, the join code stays valid until everyone leaves and it closes; TTL does not cut off active sessions. |
| `DIRECT_INVITE_MAX_OCCUPANTS` | server | Max occupants per Play Space — creator + guests (default **8**) |
| `GUEST_SESSION_TTL_SEC` | server | Guest JWT lifetime in seconds (default **14400** = 4 hours) |

**Game admin** (`ADMIN_ADDRESSES` JWT, `Authorization: Bearer`): `POST /api/admin/announce-restart` in [server/src/index.ts](../server/src/index.ts) — JSON `{ "etaSeconds": number, "message"?: string }` with **`etaSeconds` in 5…7200**; broadcasts **`serverNotice`** / **`restart_pending`** to every connected game WebSocket ([server/src/rooms.ts](../server/src/rooms.ts) `broadcastRestartPendingNotice`), then calls the normal **`shutdown`** flush path when the countdown ends. Posting again replaces the previous scheduled exit.

**Deploy hook** (optional, no JWT): `POST /api/hooks/pre-deploy-restart` with **`Authorization: Bearer <DEPLOY_RESTART_HOOK_SECRET>`** — same JSON body and broadcast behavior as **`announce-restart`**, but enabled only when **`DEPLOY_RESTART_HOOK_SECRET`** is set in the server environment (≥16 characters). Returns **404** with `{ "error": "not_configured" }` when unset so the route does not advertise itself. Intended for the VPS host / [`.github/workflows/deploy-docker.yml`](../.github/workflows/deploy-docker.yml) to warn players before `docker compose stop`.

**Admin HTTP API**: `POST /api/admin/random-layout` is currently **unauthenticated** in [server/src/index.ts](../server/src/index.ts). Do not expose that endpoint publicly without adding a secret or network restriction. The client `.env.development` comment mentioning `ADMIN_SECRET` is misleading unless you add server-side checks.

**Admin Rooms manager** (`ADMIN_ADDRESSES` JWT, `Authorization: Bearer`, all gated by `requireSystemAdminWallet`): the `/admin/rooms` page ([server/src/adminRoomsPage.ts](../server/src/adminRoomsPage.ts)) lets admins browse rooms (Official / Player Owned tabs), preview them, edit properties, and manage a per-room **builder allowlist**. A **Play Space templates** tab creates templates from room snapshots, sets the default, resyncs from the source room (future spaces only), and archives retired templates. Template records persist in `play-space-templates.json` under `WORLD_STATE_DIR` (default `server/data/`). Endpoints in [server/src/index.ts](../server/src/index.ts) and [server/src/playSpaceTemplate/routes.ts](../server/src/playSpaceTemplate/routes.ts):
- `GET /api/admin/rooms` — every room with `category` (`builtin` / `official` / `player`), owner, player count, visibility, background, and `builderAddresses` (built-in and dynamic).
- `GET /api/admin/users` — known wallets (recent players, custom usernames, owners, builders) with display labels, used to populate the builder picker.
- `GET /api/admin/rooms/:id/layout` — full non-spatial layout snapshot ([server/src/rooms.ts](../server/src/rooms.ts) `getRoomLayoutSnapshot`) consumed by the standalone 3D preview page (`/roomPreview.html`, [client/src/roomPreview.ts](../client/src/roomPreview.ts)). Huge spatial rooms (Pixel) return `spatial: true` with floor lists omitted.
- `GET /api/admin/rooms/:id/thumbnail.png?token=<JWT>` — top-down 2D PNG ([server/src/roomThumbnailImage.ts](../server/src/roomThumbnailImage.ts); Pixel reuses `/pixels.png`). Token is taken from the query so an `<img>` can authenticate; still admin-only.
- `PUT /api/admin/rooms/:id` — patch `displayName`, `isPublic`, `backgroundHueDeg`/`backgroundNeutral`, `joinSpawn` (dynamic rooms only), and `builderAddresses` (dynamic **and** built-in rooms); routes to `updateDynamicRoomMetadata` / `patchBuiltinRoomSettings`, persists, then `broadcastRoomCatalogRefresh()`.
- `GET /api/admin/play-space-templates` — list templates (`?includeArchived=1` for archived).
- `POST /api/admin/play-space-templates` — create from `{ sourceRoomId, displayName, description? }` (Build Shell snapshot).
- `GET /api/admin/play-space-templates/:id` — template metadata + stored shell.
- `PATCH /api/admin/play-space-templates/:id` — `{ setDefault: true }`, `{ archived: true|false }`, `{ reassignSourceRoomId }`, or metadata `{ displayName, description }`.
- `POST /api/admin/play-space-templates/:id/resync` — refresh stored shell from source room (future Play Spaces only).

**Play Space create:** `POST /api/invite/create` accepts optional `templateId` for system admins; non-admins always receive the default template.

**Builder allowlist**: per-room `builderAddresses` (compact NQ keys, max 50) is stored in `rooms.json` **v7** for dynamic rooms ([server/src/roomRegistry.ts](../server/src/roomRegistry.ts)) and in `builtin-room-names.json` **v4** for built-in rooms ([server/src/builtinRoomNames.ts](../server/src/builtinRoomNames.ts)). `canEditRoomContent()` ([server/src/rooms.ts](../server/src/rooms.ts)) grants build/edit to wallets on that list. For built-ins the allowlist matches admin capability per room: it unlocks restricted rooms (e.g. Chamber) for listed wallets, while Hub stays open to everyone and Canvas/Pixel remain locked for all. The flag takes effect immediately server-side; an in-room player's build toolbar appears the next time they (re)enter the room (capability flags ship in `welcome`).

**Replay HTTP API** (requires `Authorization: Bearer <JWT>`): `GET /api/replay/players`, `GET /api/replay/sessions?address=…`, `GET /api/replay/session/:id/events`. The main menu “Session replay” panel is shown **only when the page is opened on localhost** (`127.0.0.1`, `::1`, etc.); production builds on public hosts do not expose that UI (APIs remain callable with a valid JWT for tooling).

**Today:** `remove_obstacle` JSONL rows store tile coordinates; see [brainstorm/features-future.md](brainstorm/features-future.md) for optional richer logging ideas.

## Local development

- From repo root: `npm install`, then `npm run dev` — runs Vite (default [http://127.0.0.1:5173](http://127.0.0.1:5173)) and the server with `tsx watch`; Vite proxies `/api`, `/ws`, and server-rendered main-site HTML (`/analytics`, `/advertise`, `/advertise/how-it-works`, `/admin`, `/payouts`, …) to `3001`.
- Optional payment intent sidecar: `npm run dev:payment-intent` (requires `PAYMENT_INTENT_*` and `NIM_NETWORK`; see [docker-deployment.md](docker-deployment.md)).
- [client/.env.development](../client/.env.development) can enable dev login and admin UI; match `DEV_AUTH_BYPASS` on the server for dev login.
- **The Shaper** (in-world cosmetic showroom): join room code **SPACER** to open `cosmetic-gallery` (all Presets in a line; not in the public room list). **Shop is closed by default** — set `SHOP_ENABLED=1` (server) and `VITE_SHOP_ENABLED=1` (client build) to show the profile Shop shelf, purchases, and Shaper navigation. Set `SHAPER_ENABLED=0` to hide the room entirely while unfinished. When open, reachable from **Player Menu → Shop → Go to The Shaper**; leaving returns the player to the room (and approximate tile) they came from.
- Production: `npm run build` (client + server), then `npm run start -w server` with a strong `JWT_SECRET` and **no** `DEV_AUTH_BYPASS`.

## Testing changes

- Run `npm run build` at the repo root before merging larger changes (builds client and server).
- Exercise WebSocket flows with at least two browser profiles or machines when touching sync or room logic.
