# Public patch notes — developers (`0.5.6`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

## Move-order broadcast (optional rollout)

When **`MOVE_ORDER_BROADCAST=1`** ([`server/src/moveOrderBroadcast.ts`](../../../../server/src/moveOrderBroadcast.ts)):

- **Server → client `moveOrder`:** `{ address, path[], startX, startZ, startAtMs, speed }` once per validated walk (grid pathfinding or World Cup pitch free-move).
- **Server → client `moveAbort`:** authoritative snap when a path is cut short (manual stop, teleport, kickoff freeze, terrain snap, gate denial, etc.) — see [`moveAbortBroadcast.ts`](../../../../server/src/moveAbortBroadcast.ts).
- **Tick deltas:** [`cutMovementStream.ts`](../../../../server/src/cutMovementStream.ts) omits **pose** from `stateDelta` for active grid walkers; non-movement fields (typing, flags, …) still delta. Pitch free-move keeps velocity snapshots.
- **Authority pose:** [`playerPathPose.ts`](../../../../server/src/playerPathPose.ts) resolves grid-walker position analytically along the queue (also used for ball kicks, claim range, etc. when stepping is skipped).

Client playback: [`moveOrderPlayback.ts`](../../../../client/src/game/moveOrderPlayback.ts) for remotes; [`Game.ts`](../../../../client/src/game/Game.ts) `selfMoveOrder` + `refreshSelfMoveOrderTarget` for the local avatar when pose is omitted from deltas (pitch free-move still follows `stateDelta`).

Shared path math: [`pathPosition.ts`](../../../../server/src/pathPosition.ts) (server) and [`client/src/game/pathPosition.ts`](../../../../client/src/game/pathPosition.ts).

## World Cup goalie sync

- **`goalieState`** is sent to a conn on welcome/teleport (`worldcupSendGoalieStateToConn`).
- Room broadcasts are change-only + throttled via **`WORLDCUP_GOALIE_BROADCAST_MIN_MS`** ([`worldcup/config.ts`](../../../../server/src/worldcup/config.ts) `GOALIE_STATE_BROADCAST_MIN_MS`).
- **`kickoffRemainingMs`** exported from [`worldcup/match.ts`](../../../../server/src/worldcup/match.ts) for kickoff-freeze timing helpers.

## Floor build UX

- **Eyedropper:** [`Game.ts`](../../../../client/src/game/Game.ts) `setFloorEyedropperActive`, hover/sample handlers; wired from [`hud.ts`](../../../../client/src/ui/hud.ts) (Alt key + dock button).
- **Hex popover on label:** [`attachPaletteHueHexTrigger`](../../../../client/src/ui/paletteHueHexPopover.ts) on the floor hex label (same popover as hue-ring center).

## Play Space invite lobby

- **`buildPlaySpaceXShareUrl`** in [`shareUrl.ts`](../../../../client/src/invite/shareUrl.ts) — X compose intent with join link.
- Share row markup in [`lobbyOverlay.ts`](../../../../client/src/invite/lobbyOverlay.ts).

## Player menu

- New **`feedback`** item id; **`setFeedbackUnread(hasUnread)`** toggles unread dot on the Feedback row ([`playerMenu.ts`](../../../../client/src/ui/playerMenu.ts)).

## Payout analytics bridge wiring

- Game server: **`POST /internal/v1/payout-analytics-events`** + boot hooks in [`index.ts`](../../../../server/src/index.ts) calling [`payoutAnalyticsBridge.ts`](../../../../server/src/payoutAnalyticsBridge.ts).
- Payout-service posts the same path via [`payout-service/src/analyticsCallback.ts`](../../../../payout-service/src/analyticsCallback.ts) when **`GAME_SERVER_INTERNAL_URL`** is set.
