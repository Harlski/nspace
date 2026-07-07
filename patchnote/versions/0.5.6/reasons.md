# Reasons — 0.5.6 (patch-notes version)

**Patch-notes version:** `0.5.6` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

**Movement move-order broadcast rollout** (optional `MOVE_ORDER_BROADCAST=1`): dual-send `moveOrder` + `moveAbort`, analytic path pose for authority, tick `stateDelta` omits pose for active grid walkers, client remote + **self** path playback. **World Cup:** goalie `goalieState` on room join/teleport, change-only broadcasts, `WORLDCUP_GOALIE_BROADCAST_MIN_MS`. **Build UX:** floor tile eyedropper (Alt or dock button) + hex label opens custom color popover. **Play Space:** invite lobby Copy link + Share on X row. **Player menu:** Feedback item with unread admin-reply dot. **Ops:** wire payout analytics bridge on game-server boot (`POST /internal/v1/payout-analytics-events`).

---

## By area

### Repo / docs

- **`docs/features-checklist.md`**, **`docs/process.md`:** `moveOrder` / `moveAbort` dual-send, `MOVE_ORDER_BROADCAST`, `ANALYTIC_PATH_SKIP_STEPPING`, cut movement stream from `stateDelta`.

### Client

- **`client/src/net/ws.ts`:** `moveOrder`, `moveAbort` server message types.
- **`client/src/main.ts`:** route `moveOrder` / `moveAbort` to `Game`.
- **`client/src/game/pathPosition.ts`**, **`moveOrderPlayback.ts`**, **`moveAbortPlayback.ts`:** shared path math + remote playback helpers (+ unit tests).
- **`client/src/game/Game.ts`:** `applyMoveOrder` / `applyMoveAbort` for remotes; **self** grid-walk playback via `selfMoveOrder` when tick pose is omitted (World Cup pitch free-move still uses `stateDelta`); `refreshSelfMoveOrderTarget` in render loop; floor **eyedropper** mode (`setFloorEyedropperActive`, hover/sample handlers, `getLogicalFloorPaintColorAt`).
- **`client/src/ui/hud.ts`:** floor eyedropper dock button + Alt modifier; hex label under hue ring; `attachPaletteHueHexTrigger` on hex label; player menu `setFeedbackUnread`; Feedback menu action opens feedback overlay.
- **`client/src/ui/paletteHueHexPopover.ts`:** `attachPaletteHueHexTrigger` helper (click anchor to open hex popover).
- **`client/src/ui/playerMenu.ts`**, **`playerMenu.test.ts`:** `feedback` menu item; unread dot via `setFeedbackUnread`.
- **`client/src/invite/shareUrl.ts`**, **`shareUrl.test.ts`:** `buildPlaySpaceXShareUrl` (X compose intent).
- **`client/src/invite/lobbyOverlay.ts`:** share row (Copy link + Share on X) below QR.
- **`client/src/style.css`:** floor eyedropper / hex label dock styles; invite lobby share row; player menu unread dot + tighter item padding.

### Server

- **`server/src/pathPosition.ts`**, **`playerPathPose.ts`:** analytic pose along queued paths (grid + pitch free-move).
- **`server/src/moveOrderBroadcast.ts`**, **`moveAbortBroadcast.ts`:** wire builders + `MOVE_ORDER_BROADCAST` flag.
- **`server/src/cutMovementStream.ts`:** omit pose from tick `stateDelta` for active path walkers when move-order broadcast is on.
- **`server/src/rooms.ts`:** emit `moveOrder` on validated walks; `moveAbort` on path cuts (stop, teleport, kickoff freeze, terrain snap, gate block); integrate analytic pose for gameplay queries; World Cup goalie state — `worldcupSendGoalieStateToConn` on welcome/teleport, `worldcupMaybeBroadcastGoalieState` (change-only + throttle).
- **`server/src/worldcup/config.ts`:** `GOALIE_STATE_BROADCAST_MIN_MS` from `WORLDCUP_GOALIE_BROADCAST_MIN_MS` (default 250).
- **`server/src/worldcup/match.ts`:** `kickoffRemainingMs` helper.
- **`server/src/index.ts`:** register `POST /internal/v1/payout-analytics-events`; call `initPayoutAnalyticsBridgeForRuntime()` + `startPayoutAnalyticsBackfillSync()` on boot.
- **`server/test/*`:** `pathPosition`, `analyticPathGameplay`, `moveOrderBroadcast`, `moveAbortBroadcast`, `cutMovementStream`, `worldcup-match` tests.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- Optional **`MOVE_ORDER_BROADCAST=1`** — enables dual-send + cut movement pose from tick deltas (default **off**).
- Optional **`ANALYTIC_PATH_SKIP_STEPPING=1`** — also auto-on when move-order broadcast is enabled.
- Optional **`WORLDCUP_GOALIE_BROADCAST_MIN_MS`** — goalie position broadcast throttle (default **250** ms).
- Payout analytics bridge now starts on game-server boot; payout-service posts to **`POST /internal/v1/payout-analytics-events`** (bearer **`PAYOUT_SERVICE_API_SECRET`**). Ensure **`GAME_SERVER_INTERNAL_URL`** on payout-service points at the game server. Optional **`PAYOUT_ANALYTICS_BACKFILL_SINCE_MS`**, **`PAYOUT_ANALYTICS_SYNC_DIR`**. No migrations.
