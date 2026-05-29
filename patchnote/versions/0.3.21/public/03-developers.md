# Public patch notes — developers (`0.3.21`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **[CHANGE]** **`placeDesignInRoom`** — allowed when `canEditRoomContent` (same as block place); server walk bounds use `walkBounds(roomId)` so extra-floor tiles validate. Client `walkBoundsForRoom` + `Game.isPrefabPlaceValidAt` match.
- **[NEW]** **Prefab dock** — `prefabDockPicker` persists `nspace-prefab-dock-v1` per wallet; `syncPrefabCategoryToolStrip` drives CREATE / LIBRARY / design cards; legacy `hud-prefab-dock` mode row hidden.
- **[NEW]** **Capture & thumbnails** — client `captureDesignSnapshot` / `fitDesignPreviewRootInInspectorFrame`; capture preview bound to dock satellite; bbox clamp 6×6; publish modal compact layout without price field.
- **[NEW]** **Touch placement** — `prefabPlaceArmedAnchor` + tap-to-preview / confirm on `!canShowPointerHoverTiles()`; HUD **Place** / **Cancel** wired via `setPrefabPlacePreviewChangeHandler`; ghost mesh rebuilt in `syncPrefabPlaceGhostAtAnchor` after cancel.
- **[CHANGE]** **`server/src/designs.ts`** — `DESIGN_OBJECT_NAME_MAX_LENGTH = 12`; `name_too_long` on publish.
- **[FIX]** **`clearObjectPrefabToolVisuals`** on build exit; `resetBuildDockCategoryToTerrain` when leaving walk mode.
- **[CHANGE]** **Prefab place preview (client)** — `prefabPlaceSuppressFloorKeys` hides placed meshes and plain-cube instances in the rotated footprint during hover; preview meshes are solid (`ghost: false`). Anchor uses `pickFloor` only (`resolvePrefabPlaceAnchorFromPick`) so suppression cannot shift the tile; build-mode `pointermove` handles prefab place before block-hover early return.
- **[NEW]** **Dock satellite** — `syncPrefabPlaceSelectionPreview` bakes the selected design into `#tile-inspector-prefab-capture-preview-img` via `getPrefabDesignThumbnailDataUrls`; refreshed on design change and after snapshot load in `main.ts`.
- **[NEW]** **Floor brush** — `placeExtraFloor` optional **`brushSize`** (`1` default, `2`); server `floorBrushTiles` + `applyPlaceExtraFloorAtTile` batch loop; client `Game.setFloorBrushSize`, multi-tile preview, HUD **Size** dropdown.
