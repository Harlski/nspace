# Reasons — 0.3.21 (patch-notes version)

**Patch-notes version:** `0.3.21` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Prefab library, capture, and stamp placement; solid in-world place preview with footprint suppression; dock selection thumbnail; walk-through dock toggle; auth re-login UX; plain-cube stack rendering fixes; floor paintbrush (1×1 / 2×2).

---

## By area

### Repo / docs

- _(none in this change set)_

### Client

- **`client/src/ui/prefabDockPicker.ts`** — per-wallet dock favorites (`nspace-prefab-dock-v1`); library picker UI.
- **`client/src/ui/objectPrefabAuthoring.ts`** — CREATE / place catalog; capture stats; publish modal (12-char name, no price field); save preview host binding.
- **`client/src/ui/hud.ts`** — prefab dock strip (CREATE, LIBRARY, design cards); touch Place/Cancel chrome; walk-through eye toggle; `syncPrefabPlaceSelectionPreview` for selected-design satellite thumbnail; prefab place `pointermove` before block-hover branch.
- **`client/src/game/Game.ts`** — `captureDesignSnapshot`, `fitDesignPreviewRootInInspectorFrame`, prefab thumbnails; `placeDesignInRoom` client validation on extra-floor tiles; armed tap-to-confirm on coarse pointers; **`prefabPlaceSuppressFloorKeys`** + solid place preview meshes; floor-plane anchor picking (no block-ray flicker); `clearObjectPrefabToolVisuals` on build exit.
- **`client/src/main.ts`** — prefab snapshot cache, design-change / snapshot-load HUD refresh.
- **Auth / rendering** — expired-account re-login shows Terms checkbox; stacked / rotated plain-cube seam and outline fixes.
- **`client/src/game/grid.ts`** — `FloorBrushSize` (`1 | 2`), `floorBrushTiles`.
- **`client/src/game/Game.ts`** — floor brush size state, multi-tile hover preview, batch placement handler.
- **`client/src/ui/hud.ts`** — Floor tab **Size:** dropdown (1×1 / 2×2) left of hue ring; `onFloorBrushSize`.
- **`client/src/net/ws.ts`** / **`client/src/main.ts`** — optional `brushSize` on `placeExtraFloor`.
- **`client/src/style.css`** — floor parameter row layout (size left, color right).

### Server

- **`server/src/designs.ts`** — `DESIGN_OBJECT_NAME_MAX_LENGTH = 12`; `name_too_long` on publish.
- **`server/src/designPlacement.ts`** / **`server/src/rooms.ts`** — `placeDesignInRoom` when `canEditRoomContent`; walk bounds include extra-floor tiles; `placeExtraFloor` batch brush via optional `brushSize`.
- **`server/src/grid.ts`** — `floorBrushTiles` shared with client.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- Ship client and server together; no new env vars or migrations.
