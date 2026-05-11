# Public patch notes — developers (`0.3.12`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **[NEW]** `welcome` includes **`chatBacklog`**: array of `{ from, fromAddress, text, at }` (same shape as live `chat` minus `bubbleOnly`). Server ring buffer in `server/src/rooms.ts` (`CHAT_BACKLOG_MAX_LINES`, `CHAT_BACKLOG_WINDOW_MS`); filled from **`broadcast` `chat`** when `bubbleOnly` is not set.
- **[FIX]** Bulk **`obstacles`** list: `signboardId` on tiles now matches **`obstaclesDelta`** / `obstacleTileFromPlaced` (lookup by floor `tileKey(x,z)`, not `x,z,y` placed key).
- **[NEW]** Client: `resetRoomChatDom` + backlog replay in `client/src/main.ts`; `appendChat` options `historical` / `skipSystemDedup`; world log trim; signboard tiles with `signboardId` get a shared rasterized **`duotone-document`** sprite in `client/src/game/Game.ts` (bounce + distance opacity; **occlusion** vs stacked tiles / camera ray through `blockMeshes`; **idle vs tooltip-hover** opacity; hidden in build mode; pick-skip like name labels).
- **[NEW]** WebSocket **`serverNotice`**: `{ type: "serverNotice", kind: "restart_pending", etaSeconds, message?, seq }` — broadcast to all rooms; **`seq`** rises when a new announce replaces the previous schedule. Client: `client/src/main.ts` handler + `client/src/ui/hud.ts` top banner + `consumeRestartDisconnectForStatus` for disconnect copy.
- **[NEW]** HTTP **`POST /api/admin/announce-restart`** (`server/src/index.ts`) — validates `etaSeconds`, optional `message` trim/slice, clears/rearms timer, calls **`broadcastRestartPendingNotice`** from `server/src/rooms.ts`, then **`shutdown("ANNOUNCED_RESTART")`** after the delay; **`SIGINT`/`SIGTERM`** clear a pending announce timer before flush.
- **[NEW]** HTTP **`POST /api/hooks/pre-deploy-restart`** — same scheduling as admin announce when **`DEPLOY_RESTART_HOOK_SECRET`** is set (`server/src/config.ts` **`getDeployRestartHookSecret`**); **`Authorization: Bearer`** must match the secret (timing-safe); **404** `not_configured` if unset. [`.github/workflows/deploy-docker.yml`](../../../.github/workflows/deploy-docker.yml) calls it from the VPS before `docker compose stop` when the secret exists in `.env`.
