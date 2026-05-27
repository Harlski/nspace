# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **[FIX]** **Main menu** — single `#main-menu-terms-privacy-row` reparented between `#main-menu-terms-privacy-host-default` and `#main-menu-terms-privacy-host-account`; expired-session Re-login sets `expiredReloginTermsPrompt` before `requireTermsChecked()` / `runNimiqWalletSignIn()` (no reset of `termsPrivacyCb` on repeat clicks).
- **[FIX]** **Rendering** — `canUsePlainCubeInstancing` returns false when any `cubeRotX/Y/Z` is set; instanced plain-cube batches keyed by `wyLevel` with `placedBlockStackRenderOrder` and upper-layer `polygonOffset`; selection outline uses `applyPlainCubeMeshRotation` for plain cubes.
- **[NEW]** **Prefab dock** — `prefabDockPicker.ts` library overlay + `localStorage` `nspace-prefab-dock-v1` (per wallet); **LIBRARY** / **CREATE** action column; themed scrollbar; form fields ignore build shortcuts (`B`/`F`/dock rotate keys).
- **[CHANGE]** **`placeDesignInRoom`** — allowed wherever `canEditRoomContent` / `allowPlaceBlocks` (server `rooms.ts`; client `canPlacePrefabInRoom` in `main.ts`); publish modal omits price (`priceNim: "0"`).
- **[FIX]** **Extra-floor placement** — client `walkBoundsForRoom` + `Game.isPrefabPlaceValidAt`; server `placeDesignInRoom` uses `walkBounds(roomId)` instead of base bounds only.
- **[NEW]** **Build dock walk-through** — `buildDockWalkThroughBtn` toggles `passable` via existing `setObstacleProps` (`eye` / `eyeslash` icons); handler uses `pointerdown` only (no duplicate `click`).
- **[FIX]** **Prefab tool teardown** — `Game.setBuildMode(false)` / `syncObjectPrefabModes` clear placement ghost when exiting build.
