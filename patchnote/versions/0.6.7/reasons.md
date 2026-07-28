# Reasons — 0.6.7 (patch-notes version)

**Patch-notes version:** `0.6.7` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Admin **Movement Watch**: opt-in side channel for Click Markers + Watch Paths (pathfinding debug / botting watch). Client-only intents (`no_path`, mine clicks) while `movementWatchActive`.

---

## By area

### Repo / docs

- [CONTEXT.md](../../../CONTEXT.md) — **Movement Watch**, **Click Marker**, **Watch Path** glossary terms
- [docs/adr/0013-movement-watch-admin-side-channel.md](../../../docs/adr/0013-movement-watch-admin-side-channel.md) — admin-only opt-in WS side channel (not `MOVE_ORDER_BROADCAST`); client `movementWatchClickIntent` while room active
- [docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md) + [docs/reasons/reason_583720.md](../../../docs/reasons/reason_583720.md) — admin side-channel principle
- [docs/features-checklist.md](../../../docs/features-checklist.md), [docs/process.md](../../../docs/process.md) — Movement Watch behavior + `NSPACE_MOVEMENT_WATCH`

### Client

- [client/src/game/movementWatchView.ts](../../../client/src/game/movementWatchView.ts) — Click Markers (~5s) + Watch Paths
- [client/src/game/Game.ts](../../../client/src/game/Game.ts) — apply snapshot/click/clear; report unwalkable + mine intents
- [client/src/ui/adminOverlay.ts](../../../client/src/ui/adminOverlay.ts) — Admin **Watch** tab (allowlist admins only)
- [client/src/net/ws.ts](../../../client/src/net/ws.ts), [client/src/main.ts](../../../client/src/main.ts) — `sendMovementWatch` / `sendMovementWatchClickIntent`; `movementWatchActive` gate

### Server

- [server/src/movementWatch.ts](../../../server/src/movementWatch.ts) — builders, marker throttle, recipient filter, client intent reasons
- [server/src/rooms.ts](../../../server/src/rooms.ts) — subscribe, `movementWatchActive` room flag, snapshot, accepted/rejected fan-out, `movementWatchClickIntent`
- [server/test/movementWatch.test.ts](../../../server/test/movementWatch.test.ts)

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
