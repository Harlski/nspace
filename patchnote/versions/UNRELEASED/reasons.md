# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

**[FIX]** Expired cached-account **Re-login** — terms consent moves into the account panel (replaces **Expired** on first Re-login click); full Terms/Privacy label with reserved red asterisk; second click respects checkbox and starts wallet sign-in (no forced uncheck).

**[FIX]** Plain-cube visuals — rotated cubes stay on individual meshes (not instanced batch); stacked instanced cubes bias depth so the lower block keeps its color at overlap; selection outline follows cube rotation.

**[NEW]** **Prefab authoring & dock** — library overlay to curate which designs appear in the build dock strip (`nspace-prefab-dock-v1` per wallet); size filter from catalog footprints; stacked **LIBRARY** / **CREATE** actions; themed scrollbar; no footprint dimensions under cards; publish modal always free (price field removed).

**[CHANGE]** **Prefab placement scope** — `placeDesignInRoom` / client place mode allowed in any room with `canEditRoomContent` (same as block place), not wallet-room-only.

**[FIX]** **Extra-floor prefab placement** — walk bounds include extra floor on client (`walkBoundsForRoom`, `Game.isPrefabPlaceValidAt`) and server (`placeDesignInRoom` uses `walkBounds` not `getRoomBaseBounds`).

**[FIX]** **Prefab ghost on exit build** — `clearObjectPrefabToolVisuals` / `syncObjectPrefabModes` when build mode closes.

**[NEW]** **Build dock walk-through** — eye / eyeslash toggle next to rotate/delete for selected objects; `setObstacleProps` `passable`; `pointerdown` only (removed duplicate `click` that double-toggled).

---

## By area

### Repo / docs

- [docs/features-checklist.md](../../../docs/features-checklist.md) — prefab place scope note (`canEditRoomContent`).

### Client

- [client/src/ui/mainMenu.ts](../../../client/src/ui/mainMenu.ts) — movable terms row (`#main-menu-terms-privacy-host-default` / `#main-menu-terms-privacy-host-account`); `expiredReloginTermsPrompt`; `discloseExpiredReloginTerms` / `shouldShowExpiredAccountTerms`; Re-login validates checkbox then `runNimiqWalletSignIn`; removed tooltip error copy.
- [client/src/style.css](../../../client/src/style.css) — account-panel terms host, `--needs-ack` checkbox highlight, asterisk reserved via `visibility` (no layout shift); prefab dock scrollbar theme, library overlay, prefab-actions column.
- [client/src/game/Game.ts](../../../client/src/game/Game.ts) — exclude rotated plain cubes from instancing; per-`wyLevel` instance batches + `polygonOffset` on upper layers; selection outline rotation for plain cubes; `walkBoundsForRoom` for prefab validity; `clearObjectPrefabToolVisuals` on build exit.
- [client/src/game/grid.ts](../../../client/src/game/grid.ts) — `walkBoundsForRoom` merges base bounds + extra floor keys.
- [client/src/ui/hud.ts](../../../client/src/ui/hud.ts) — `buildDockWalkThroughBtn` + `syncBuildDockWalkThroughBtn`; `pointerdown`-only handler; prefab strip scroll/layout fixes.
- [client/src/ui/prefabDockPicker.ts](../../../client/src/ui/prefabDockPicker.ts) — library overlay, footprint size filter options, `nspace-prefab-dock-v1` persistence.
- [client/src/ui/objectPrefabAuthoring.ts](../../../client/src/ui/objectPrefabAuthoring.ts) — publish modal without price; shortcut guard while typing in inputs.
- [client/src/main.ts](../../../client/src/main.ts) — `canPlacePrefabInRoom`; `syncObjectPrefabModes` on B/Escape/walk.

### Server

- [server/src/rooms.ts](../../../server/src/rooms.ts) — `placeDesignInRoom` uses `walkBounds(roomId)`; placement allowed under `canEditRoomContent` (not wallet-room-only).

### payment-intent-service

- _(none)_

### Deploy / ops

- **Client + server** for prefab scope and extra-floor placement validation; earlier login/rendering fixes are client-only if cherry-picked. No new env vars or migrations.
