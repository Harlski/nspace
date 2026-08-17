# Reasons — 0.7.4 (patch-notes version)

**Patch-notes version:** `0.7.4` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Occupied-room presence is one-player `stateDelta` (pose omitted for grid Path Playback walkers). `moveOrder` stamps analytic pose + `serverNowMs`. Clients never rewind after drain except intentional snaps.

---

## By area

### Repo / docs

- Recorded decision: [docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md) occupied-room presence vs Path Playback; [docs/reasons/reason_847293.md](../../../docs/reasons/reason_847293.md).
- [docs/features-checklist.md](../../../docs/features-checklist.md), [docs/process.md](../../../docs/process.md), [docs/build.md](../../../docs/build.md) updated for presence `stateDelta` and `moveOrder.serverNowMs`.

### Client

- [client/src/game/moveOrderPlayback.ts](../../../client/src/game/moveOrderPlayback.ts) — `playbackNowMs`, `remainingAlongPath` (prefix-aware), `moveOrderPlaybackActive` / `moveOrderPlaybackFinished`, `playbackSameWalk`, `shouldAdvancePlaybackSample`, `shouldAdoptReplacementMoveOrder`.
- [client/src/game/Game.ts](../../../client/src/game/Game.ts) — hold last Path Playback pose; ignore behind snapshots; server-domain clock from `serverNowMs`; `selfPathPlaybackActive`; camera snap only clears stale order on room entry.
- [client/src/game/cameraSelfSync.ts](../../../client/src/game/cameraSelfSync.ts) — do not snap (and drop Path Playback) when follow is not ready but a walk is active.
- [client/src/net/mergeStateDeltaPlayer.ts](../../../client/src/net/mergeStateDeltaPlayer.ts) — keep prev pose when delta omits `x/y/z/vx/vz`.
- [client/src/net/ws.ts](../../../client/src/net/ws.ts) — optional `moveOrder.serverNowMs`.

### Server

- [server/src/cutMovementStream.ts](../../../server/src/cutMovementStream.ts) — `presenceDeltaPlayers` / pose omit for CUT-eligible walkers.
- [server/src/rooms.ts](../../../server/src/rooms.ts) — `broadcastPresenceStateDelta` for typing, NIM-send, challenge, country, rename, chat-clear-typing, stale-challenge sweep, level-up; copy analytic pose onto `conn.player` before `moveTo` pathfind; `maybeBroadcastMoveOrder` stamps from `moveOrderStartFromGameplay`.
- [server/src/moveOrderBroadcast.ts](../../../server/src/moveOrderBroadcast.ts) — `serverNowMs` on `moveOrder`.
- [server/src/playerPathPose.ts](../../../server/src/playerPathPose.ts) — `applyPoseToPlayer`, `moveOrderStartFromGameplay`.
- `nimSendIntent` equality-guards unchanged `active`.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- No new env vars. `MOVE_ORDER_BROADCAST=0` remains the Path Playback kill switch.

