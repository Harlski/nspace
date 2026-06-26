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
- `CONTEXT.md` — **Wardrobe Preview** glossary entry; **Player Menu**, **Hub**, **Commons**, **Return to Hub**, **Avatar Frame** glossary entries.
- `docs/features-checklist.md` — Wardrobe bullet updated.

### Client

- `client/src/cosmetics/wardrobePanel.ts` — paper-doll Wardrobe + Shop tabs; slot dropdowns; `mountWardrobeReadOnly`.
- `client/src/cosmetics/presetSwatch.ts` — swatch classes + doll VFX CSS hooks.
- `client/src/cosmetics/loadoutVfx.ts` — stash bubble preset on group userData.
- `client/src/game/Game.ts` — `bindWardrobeAvatarPreviewCanvas` / `updateWardrobeAvatarPreviewCosmetics` (isometric tile + avatar WebGL, same idiom as `/advertise` preview).
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
