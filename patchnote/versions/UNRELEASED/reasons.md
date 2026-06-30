# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Paper-doll Wardrobe UX (phase 3b) — self profile equip/shop UI, Wardrobe Preview on avatar, read-only doll on other profiles. **Player Menu** v1 — bottom-right identicon navigation popover; player-facing **Hub** / **Commons** display-name rename (`chamber` / `hub` ids unchanged).

---

## By area

### Repo / docs

- `docs/prd/cosmetic-shop.md` — Wardrobe UX section locked (variant B paper doll).
- `CONTEXT.md` — **Wardrobe Preview** glossary entry; **Wardrobe Preview Backdrop** glossary entry; **Player Menu**, **Hub**, **Commons**, **Return to Hub**, **Avatar Frame** glossary entries; **Focused Sector**, **Sector Title**, **Wheel Title** glossary entries (Action Wheel refinement).
- `docs/adr/0002-action-wheel-glyph-only-focus-titles.md` — ADR for glyph-only Sectors + focus-revealed titles + touch two-tap.
- `docs/features-checklist.md` — Wardrobe bullet updated.

### Client (Action Wheel refinement)

- `client/src/ui/actionWheelGeometry.ts` — `hexSegmentPath` / `hexPolygonPath` take an optional `cornerRadius` (and `hexSegmentPath` a separate `innerCornerRadius`); new `roundedPolyPath` softens corners with seamless quadratic fillets and accepts per-corner radii (radius 0 keeps the old sharp output). Adjacent Sectors round their shared radial corner identically, so the rounded hexagon tiles with no gaps. The inner ring (Avatar Frame) uses a tighter radius than the outer silhouette.
- `client/src/ui/actionWheelGeometry.test.ts` — fillet count, no-arc, and seamless-shared-corner tests.
- `client/src/ui/hud.ts` — Action Wheel now glyph-only (in-wedge text labels removed); **Sector Title** chip above the hexagon shows the **Focused Sector**'s name (hover/keyboard, or first tap on touch); **Wheel Title** chip below the Nav Sector names the current sub-wheel (root = none). Touch is tap-to-reveal then tap-to-activate; the Nav Sector (`nav` flag on Close/Back) is exempt (single tap). Wedges/rim drawn with `ACTION_WHEEL_CORNER` rounding.
- `client/src/style.css` — softer/lighter Sector dividers + rounded line joins; `--focused` highlight; `.action-wheel__sector-title` / `.action-wheel__wheel-title` chips; removed unused `.action-wheel__label`.

### Client

- `client/src/cosmetics/wardrobePanel.ts` — paper-doll Wardrobe + Shop tabs; slot dropdowns; `mountWardrobeReadOnly`.
- `client/src/cosmetics/presetSwatch.ts` — swatch classes + doll VFX CSS hooks.
- `client/src/cosmetics/loadoutVfx.ts` — stash bubble preset on group userData.
- `client/src/game/wardrobePreviewBackdrop.ts` / `wardrobePreviewBackdrop.test.ts` — **Wardrobe Preview Backdrop**: snapshot room sky + 4×4 floor patch (void = water); spawn fallback; stacked blocks at every Y level except camera-side occluders and the avatar tile; preview camera stays at the original tight zoom (not widened for patch size).
- `client/src/game/Game.ts` — `bindWardrobeAvatarPreviewCanvas` / `updateWardrobeAvatarPreviewCosmetics` (isometric tile + avatar WebGL, same idiom as `/advertise` preview); preview uses backdrop module above.
- `client/src/ui/hud.ts` — mount new wardrobe; revert preview on profile close; **Player Menu** (`createPlayerMenu`), logout/leave handlers, Action Wheel mutual close, identicon sync from player bar.
- `client/src/ui/playerMenu.ts` — bottom-right identicon trigger + vertical popover list + inline logout/leave confirm.
- `client/src/ui/playerMenu.test.ts` — guest/full item label tests.
- `client/src/style.css` — `.player-menu*` chrome; hide during build dock / stream cinema; Pay landscape rail offset.
- `client/src/main.ts` — Player Menu logout/leave → `disposeToMenu` + session cache clear; player-facing Hub/Commons loading + display-name fallbacks; idle return copy.
- `server/src/builtinRoomNames.ts` — default display names: `chamber` → Hub, `hub` → Commons.
- `server/src/roomLayouts.ts` — builtin catalog fallback display names aligned.
- `server/src/rooms.ts` — canvas evacuation chat copy references Commons (destination `hub` id).
- `client/src/style.css` / `client/src/cosmetics/wardrobePanel.ts` — fix: narrow/portrait viewports (e.g. the Nimiq Pay webview) hid `.wardrobe-doll__grid` via `display:none` and swapped in a slots-only mobile grid, so the WebGL avatar canvas had zero size and never rendered (and the read-only other-player doll vanished entirely). Now the grid **reflows** at ≤560px (preview on top, slots 2×2 below), keeping the single preview canvas visible; the duplicate `wardrobe-doll__mobile-grid` is removed. Breakpoint widened from 420→560px so common portrait widths (e.g. 430px) no longer fall into the 3-column desktop grid, where the read-only profile's negative `margin-right` pushed the left/right cosmetic columns off the dialog edge (that margin is also cancelled in the reflow).
- `client/src/game/Game.ts` / `client/src/game/identiconTexture.ts` — wardrobe/profile preview crispness: the preview renderer now calls `setPixelRatio(min(dpr, 2))` (was 1×, upscaled and blurry on high-DPR phones), the identicon raster bumped 128→256px, and name pills (`createNameLabelSprite`) render at a 2× supersample with `LinearFilter` so the identicon and text stay sharp.

### Server

- `server/src/index.ts` — `cosmeticDeployables` on player profile JSON.
- `server/src/cosmeticGallery.ts` — dev-only **Preset Gallery** room (`cosmetic-gallery`, join **SPACER**); `cosmeticGallery` welcome payload (one showcase per Preset).
- `server/src/roomLayouts.ts` / `server/src/rooms.ts` — gallery bounds, spawn, no NPCs/build; join resolution.
- `server/test/cosmeticGallery.test.ts` — join code + payload tests.

### Client (Preset Gallery)

- `client/src/cosmetics/galleryTypes.ts` — wire types for gallery showcases.
- `client/src/game/Game.ts` — `setCosmeticGallery` showcase entities (labels, chat bubble demo, trail pace, deployable VFX, floor plaques).
- `client/src/game/Game.ts` — gallery polish: trail showcases emit a fading wake (`spawnGalleryTrailPuff` / `updateGalleryTrailPuffs`) since the real cosmetic trail is a single faint sphere that is invisible at gallery zoom; head labels (`layoutGalleryHeadLabel`) and floor plaques now use a constant text height (height-locked instead of width-locked) so long preset names stay readable instead of shrinking.
- `client/src/game/Game.ts` — chat bubble readability (real bubbles **and** the gallery demo): on-screen bubble height now tracks the full canvas height instead of `th * 0.5`, so multi-line messages keep each line at a constant readable size rather than shrinking the text as more lines wrap (`syncChatBubbleScaleAndPosition`, `layoutGalleryChatBubble`).
- `client/src/net/ws.ts` / `client/src/main.ts` — welcome `cosmeticGallery` handling.

### Repo / docs (Preset Gallery)

- `CONTEXT.md` — **Preset Gallery** glossary entry.
- `docs/features-checklist.md` — Preset Gallery bullet.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_

### Achievements v1

- `server/src/achievementDefinitions.ts` — code registry (onboarding + Commons build + mining ladders); seeded `ach-*` reward SKUs.
- `server/src/achievementStore.ts` — campaign SQLite counters/completions; idempotent unlock; `grantEntitlement` source `achievement`.
- `server/src/cosmeticStore.ts` — `EntitlementSource` `achievement`; shop excludes **Achievements** collection; `validateUnlockIntent` rejects `ach-*`.
- `server/src/rooms.ts` — gameplay hooks + WS `achievementUnlocked`; inbound `achievementSignal`.
- `server/src/index.ts` — `GET /api/achievements/me`; profile summary fields; loadout equip event; `initAchievementStore`.
- `client/src/achievements/` — API + achievements panel UI.
- `client/src/ui/playerMenu.ts`, `client/src/ui/hud.ts`, `client/src/main.ts`, `client/src/net/ws.ts` — Player Menu entry, profile AP/highlights, unlock toast, WS wiring.
- `server/test/achievementStore.test.ts` — counter, reward grant, public summary tests.
- `docs/features-checklist.md` — Achievements section.

### Achievements v3 — worldcraft (slice 2)

- `server/src/worldcraftAchievementEvaluator.ts` — pure rules for palette eligibility, hue buckets, shape keys, room-maker-deluxe progress.
- `server/src/achievementDefinitions.ts` — `worldcraft` category (10 achievements).
- `server/src/achievementStore.ts` — floor recolor, shapes, prefab, signpost, gate, room deluxe record APIs.
- `server/src/rooms.ts` — production hooks; `achievementSignal` `open_signboard` with server signboard lookup.
- `client/src/achievements/panelData.ts` — Worldcraft navigator label.
- `client/src/net/ws.ts`, `client/src/ui/hud.ts`, `client/src/main.ts` — Signpost Reader client signal on modal open.
- `server/test/worldcraftAchievementEvaluator.test.ts`, `server/test/achievementStore.test.ts` — worldcraft unit/store tests.
- `docs/features-checklist.md` — v3 exploration/worldcraft section.

### Player Menu Shop + The Shaper return

- `client/src/ui/playerMenu.ts` — full-player menu drops **Profile**, adds **Shop**; new `shaperOnly` **Leave the Shaper** entry + `setInShaper`; `playerMenuItemLabelsForMode` gains an `inShaper` arg.
- `client/src/cosmetics/wardrobePanel.ts` — Shop tab is now a daily featured shelf (Buy via `createUnlockIntent`/`syncUnlockPayment`, Equip for owned passives, Owned + "use from Action Wheel → Items" for deployables) plus a **Go to The Shaper** link; removed the link-only placeholder.
- `client/src/cosmetics/api.ts` — `WardrobeResponse.featured`.
- `client/src/cosmetics/galleryTypes.ts` — `COSMETIC_SHOP_ROOM_ID` + `isCosmeticShopRoomId`.
- `server/src/cosmeticStore.ts` — pure `selectDailyFeatured` (FNV-1a day-seeded), `utcDayKey`, `listDailyFeaturedShop`.
- `server/src/index.ts` — `GET /api/cosmetics/wardrobe` returns `featured`.
- `server/src/cosmeticGallery.ts` — `isCosmeticGalleryEnabled` now driven by `SHAPER_ENABLED` (default on), making **The Shaper** player-facing in all environments.
- `client/src/ui/hud.ts` — Player Menu `shop` / `return-from-shaper` actions; `setInShaper` toggles an in-world **Leave the Shaper** button; `onLeaveShaper` handler.
- `client/src/main.ts` — sessionStorage Shaper return target (room + approximate tile, 30-min TTL) captured on every entry for loading UX; `onLeaveShaper` sends parameterless `returnFromShaper`; `shaperReturnFailed` dismisses loading overlay; `setInShaper` on welcome.
- `client/src/net/ws.ts` — `sendReturnFromShaper` (no client coords).
- `server/src/rooms.ts` — server-side `shaperReturnOrigins` recorded on Shaper entry; `returnFromShaper` consumes that origin only (not client-supplied room/coords), with `resolveReturnSpawn` walkability clamp + Hub fallback; `shaperReturnFailed` when not in Shaper.
- `server/.env.example`, `docs/process.md`, `docs/features-checklist.md`, `CONTEXT.md` — `SHAPER_ENABLED`, The Shaper as player-facing, Player Menu wording.
- `server/test/cosmeticStore.test.ts`, `server/test/cosmeticGallery.test.ts`, `client/src/ui/playerMenu.test.ts` — daily featured selection, Shaper enablement, menu item shape.
