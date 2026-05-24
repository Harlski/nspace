# Reasons — 0.3.17 (patch-notes version)

**Patch-notes version:** `0.3.17` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

**[NEW]** **Per-tile floor color** — Room scope → **Floor** tab: shared **hue ring** tints hover preview; **left-click** places extra floor or **recolors** existing core/extra tiles (`colorRgb` on `placeExtraFloor`). **Right-click** (desktop) removes extra floor. Recolor works **under placed blocks**. Server persists **`extraFloor`** as tile → `colorRgb` and new **`baseFloorColors`** for core-grid tints; **`baseFloorColorDelta`** on the wire. Legacy extra-floor strings / `{ tile }` / split-file gaps merge from **`world-state.json`**.

**[NEW]** Plain **cube rotation** (`cubeRotX` / `cubeRotY` / `cubeRotZ`, 0–3 = 90° per axis; visual only). Dock **Rot X/Y/Z** steppers when Cube is active; **↺ ↻** / **R** spin Y. Legacy `cubePitch` migrates to one X step.

**[FIX]** Floor expand / recolor no longer blocked when blocks sit on the tile (client `canPaintFloorTileAt`; server base-floor recolor path). HUD floor hue row visibility stack overflow fixed. Build dock mode sync when switching Floor tab.

**[FIX]** Floor rendering — instanced lit top quads (match block `roughness` / `metalness`), single color batch + `instanceColor`, antialiasing; reduced tile overlap default (1.01) to cut seam artifacting.

---

## By area

### Repo / docs

- [docs/features-checklist.md](../../../docs/features-checklist.md) — floor `colorRgb`, recolor under blocks, cube rotation.
- [docs/build_menu.md](../../../docs/build_menu.md) — `build-dock-floor-hue-row`, floor context layout.
- [docs/build.md](../../../docs/build.md) — `baseFloorColorDelta`, welcome `baseFloorColorTiles`.
- [docs/tile.md](../../../docs/tile.md) — walkable floor instanced top quads (reference sizes).
- [docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md) — floor hue ring + per-tile floor color in build dock / tiles direction; [docs/reasons/reason_392847.md](../../../docs/reasons/reason_392847.md).

### Client

- [client/src/ui/hud.ts](../../../client/src/ui/hud.ts) — floor hue ring row, floor tab context, cube Rot X/Y/Z steppers, `syncHueDockVisibility` guard, floor placement color handler.
- [client/src/ui/buildDockContextParams.ts](../../../client/src/ui/buildDockContextParams.ts) — floor context params.
- [client/src/style.css](../../../client/src/style.css) — floor hue row / floor context chrome.
- [client/src/game/Game.ts](../../../client/src/game/Game.ts) — floor instanced visuals (`instanceColor`, lit material), recolor/pick under blocks, desktop right-click remove; cube mesh rotation; `baseFloorColorByKey` / deltas.
- [client/src/game/blockStyle.ts](../../../client/src/game/blockStyle.ts) — `cubeRotX/Y/Z`, `cubeRotationForPlainCube`, legacy `cubePitch` migration helpers.
- [client/src/game/grid.ts](../../../client/src/game/grid.ts) — placement style cube rotation fields.
- [client/src/net/ws.ts](../../../client/src/net/ws.ts) — `placeExtraFloor` `colorRgb`; welcome / `baseFloorColorDelta` / `extraFloorDelta` shapes.
- [client/src/main.ts](../../../client/src/main.ts) — floor color + base-floor delta handlers.
- [client/src/ui/adminOverlay.ts](../../../client/src/ui/adminOverlay.ts) — tile quad scale range (seam tuning).

### Server

- [server/src/rooms.ts](../../../server/src/rooms.ts) — `roomExtraFloor` → `Map<tileKey,colorRgb>`; `roomBaseFloorColors`; `placeExtraFloor` recolor paths; `tileHasPlacedBlocks` fix for placed-map keys; `baseFloorColorDelta` broadcast; obstacle wire includes cube rotation.
- [server/src/worldPersistence.ts](../../../server/src/worldPersistence.ts) — `baseFloorColors` persist; extra-floor load formats + legacy merge from monolithic world state.
- [server/src/blockColors.ts](../../../server/src/blockColors.ts) — `DEFAULT_EXTRA_FLOOR_COLOR_RGB`, `resolveExtraFloorColorRgb`.
- [server/src/grid.ts](../../../server/src/grid.ts) — `ExtraWalkableRef`, cube rotation on `PlacedProps` / migration.
- [server/test/world-persistence-extra-floor.test.ts](../../../server/test/world-persistence-extra-floor.test.ts) — legacy merge + entry formats.
- [server/scripts/worldStateBenchmarkLib.ts](../../../server/scripts/worldStateBenchmarkLib.ts) — payload size baselines after `colorRgb` on wire.

### payment-intent-service

- _(no changes)_

### Deploy / ops

- Ship **client and server** together: welcome / deltas include optional **`colorRgb`** on extra floor and **`baseFloorColorTiles`**; persisted room JSON may include **`baseFloorColors`**. Load accepts legacy extra-floor string lists (default green). No new environment variables.
