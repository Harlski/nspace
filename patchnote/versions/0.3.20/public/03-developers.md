# Public patch notes — developers (`0.3.20`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **[CHANGE]** **`placeDesignInRoom`** — allowed when `canEditRoomContent` (same as block place); server walk bounds use `walkBounds(roomId)` so extra-floor tiles validate. Client `walkBoundsForRoom` + `Game.isPrefabPlaceValidAt` match.
- **[NEW]** **Prefab dock** — `prefabDockPicker` persists `nspace-prefab-dock-v1` per wallet; `syncPrefabCategoryToolStrip` drives CREATE / LIBRARY / design cards; legacy `hud-prefab-dock` mode row hidden.
- **[NEW]** **Capture & thumbnails** — client `captureDesignSnapshot` / `fitDesignPreviewRootInInspectorFrame`; capture preview bound to dock satellite; bbox clamp 6×6; publish modal compact layout without price field.
- **[NEW]** **Touch placement** — `prefabPlaceArmedAnchor` + tap-to-preview / confirm on `!canShowPointerHoverTiles()`; HUD **Place** / **Cancel** wired via `setPrefabPlacePreviewChangeHandler`; ghost mesh rebuilt in `syncPrefabPlaceGhostAtAnchor` after cancel.
- **[CHANGE]** **`server/src/designs.ts`** — `DESIGN_OBJECT_NAME_MAX_LENGTH = 12`; `name_too_long` on publish.
- **[FIX]** **`clearObjectPrefabToolVisuals`** on build exit; `resetBuildDockCategoryToTerrain` when leaving walk mode.
