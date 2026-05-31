# Public patch notes — developers (`0.3.22`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a dump of [../reasons.md](../reasons.md).

---

## Pixel room

- [NEW] Builtin **`pixel`** — **500×500** bounds; Hub door `(0,12)`; spawn `(0,-11)`; floor-only via `canRecolorFloorInRoom` / `applyPlaceExtraFloorAtTile` early path; implicit checkerboard + center black spawn square ([`pixelImplicitFloorColorRgb`](../../../server/src/blockColors.ts), client mirror [`pixelFloorColors.ts`](../../../client/src/game/pixelFloorColors.ts)).
- [NEW] Spatial interest sync (32×32 chunks): welcome and `baseFloorColorDelta` scoped to subscribed chunks; non-admins capped at **±96** tiles; admins and stream observers up to **±400**.
- [NEW] Append-only paint log ([`server/src/pixelPaintLog.ts`](../../../server/src/pixelPaintLog.ts)): `baseline` + `paint` JSONL records (`ts`, `x`, `z`, `colorRgb`, `address`).
- [NEW] Live raster ([`server/src/pixelBoardImage.ts`](../../../server/src/pixelBoardImage.ts)): `GET /pixels.png` (**1000×1000**, `PIXEL_BOARD_PNG_SCALE = 2`), in-memory cache invalidated on Pixel paints.
- [CHANGE] Floor paint WS payload may include **`brushSize`** (`1` | `2`) for N×N recolor batches.

## Stream cinema

- [NEW] Client stream presentation (`Game.setStreamPresentationActive`, detached camera, pan, zoom, 3×3 top-down avatars → 1×1 on spotlight).
- [NEW] [`streamDirector.ts`](../../../client/src/stream/streamDirector.ts) — overview ↔ random player spotlight; `noScroll` disables overview pan; **`onFollowBar`** drives HUD **Following {name}** drain bar.
- [NEW] Server **`streamObserver`** session flag; allowlist from env + admin runtime settings ([`streamObserverAllowlist.ts`](../../../server/src/streamObserverAllowlist.ts)); unauthorized stream → WS **4403**.
- [CHANGE] `recolor_base_floor` gameplay events now include **`colorRgb`** in payload.

## Client UX

- [NEW] `beginRoomTransition()` — instant loading overlay + progress on room join, door travel, and reconnect welcome.
