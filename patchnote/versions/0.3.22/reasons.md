# Reasons — 0.3.22 (patch-notes version)

**Patch-notes version:** `0.3.22` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Pixel builtin room (500×500 floor-only paint, checkerboard implicit base + center black spawn square, spatial chunk sync, 1×1/2×2 floor brush) + stream cinema (`?stream=1`, follow spotlight bar, optional chat/noScroll/debug) + forward-only pixel paint log + public `/pixels.png` snapshot (1000×1000) + admin stream observer allowlist + room-transition loading UX.

---

## By area

### Repo / docs

- [docs/features-checklist.md](../../../docs/features-checklist.md), [docs/getting-started.md](../../../docs/getting-started.md), [docs/process.md](../../../docs/process.md) — Pixel, stream flags, paint log, `/pixels.png`.
- [docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md) + [docs/reasons/reason_482901.md](../../../docs/reasons/reason_482901.md) — pixel history + snapshot principle.

### Client

- [client/src/main.ts](../../../client/src/main.ts) — pixel build gating, stream query params, presentation wiring, non-admin map caps, room transition loading.
- [client/src/game/Game.ts](../../../client/src/game/Game.ts), [client/src/game/pixelFloorColors.ts](../../../client/src/game/pixelFloorColors.ts) — stream camera, pan, bubbles, avatar scale, floor preview/brush, chunk floor sync, implicit checkerboard tint.
- [client/src/stream/streamDirector.ts](../../../client/src/stream/streamDirector.ts) — overview ↔ spotlight cycle; follow bar callbacks; `noScroll` disables overview pan.
- [client/src/ui/hud.ts](../../../client/src/ui/hud.ts), [client/src/style.css](../../../client/src/style.css) — cinema HUD, broadcast overlay (+ pixels URL line), stream follow bar, floor brush UI scoped to floor paint mode.
- [client/vite.config.ts](../../../client/vite.config.ts), [client/vercel.json](../../../client/vercel.json), [vercel.json](../../../vercel.json) — `/pixels.png` proxy/rewrite to API host.

### Server

- [server/src/roomLayouts.ts](../../../server/src/roomLayouts.ts), [server/src/builtinRoomNames.ts](../../../server/src/builtinRoomNames.ts) — pixel builtin + Hub door + default spawn.
- [server/src/blockColors.ts](../../../server/src/blockColors.ts) — `pixelImplicitFloorColorRgb`; migrations in [worldPersistence.ts](../../../server/src/worldPersistence.ts) (`.pixel-checkerboard-v3`).
- [server/src/rooms.ts](../../../server/src/rooms.ts) — pixel floor-only handlers, stream observer session, spatial interest, paint log + PNG cache hooks, N×N floor brush.
- [server/src/interestChunks.ts](../../../server/src/interestChunks.ts) — chunk sync + non-admin cap.
- [server/src/config.ts](../../../server/src/config.ts), [server/src/streamObserverAllowlist.ts](../../../server/src/streamObserverAllowlist.ts), [server/src/walletAddresses.ts](../../../server/src/walletAddresses.ts) — stream allowlist (env + admin settings).
- [server/src/adminRuntimeSettingsStore.ts](../../../server/src/adminRuntimeSettingsStore.ts), [server/src/adminSettingsPage.ts](../../../server/src/adminSettingsPage.ts) — stream wallet in `/admin/settings`.
- [server/src/pixelPaintLog.ts](../../../server/src/pixelPaintLog.ts) — append-only paint JSONL + baseline.
- [server/src/pixelBoardImage.ts](../../../server/src/pixelBoardImage.ts) — 1000×1000 PNG raster + cache (`PIXEL_BOARD_PNG_SCALE = 2`).
- [server/src/index.ts](../../../server/src/index.ts) — `GET /pixels.png`.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- Optional **`PIXEL_PAINT_LOG_FILE`**, **`STREAM_OBSERVER_ADDRESSES`** (merged with `/admin/settings` runtime JSON).
- Split-hosting + local dev: rewrite/proxy **`/pixels.png`** to game API.
