# Public patch notes — developers (`0.5.0`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

## Player Menu and profile shell

**[NEW] Player Menu** — `client/src/ui/playerMenu.ts` + HUD wiring: bottom-right identicon opens a vertical navigation popover. Full players: Wardrobe/Shop/Achievements/Rooms/Return to Hub/Logout (Profile on top-bar identicon only); guests keep Profile + Get a Wallet + Leave (no Shop). **Long-press** on identicon/name pill fires `onPlayerMenuLongPress` → Action Wheel. Closes Action Wheel on open and vice versa (`abortLongPressGesture`). Domain terms in `CONTEXT.md`.

**[NEW] Profile bottom tabs** — Self profile drives `wardrobePanel` via bottom tab bar (Wardrobe / Shop / Achievements); sheet mode on narrow viewports. `overlayBackStack.ts` integrates browser Back with profile, achievements window, and related overlays.

## Achievements

**[NEW] Achievements v1** — Code-defined registry (`achievementDefinitions.ts`); SQLite progress (`achievementStore.ts`); hooks in `rooms.ts` + loadout equip; `GET /api/achievements/me`; profile fields `achievementPoints` / `achievementHighlights`; WS `achievementUnlocked` / `achievementCelebration` / inbound `achievementSignal`. Client: `client/src/achievements/` panel + banner + `celebrationPolicy.ts` in-world VFX. Achievement-only SKUs (`ach-*`, collection **Achievements**) via `EntitlementSource` `achievement`; shop rejects them.

**[NEW] Achievements v3 slices** — Exploration (`explorationAchievementEvaluator.ts`), Worldcraft (`worldcraftAchievementEvaluator.ts`), Social, Football match extensions (`matchAchievementEvaluator.ts`), Free Play Field extensions (`fieldGoalAchievementEvaluator.ts`). Signpost Reader client signal on modal open.

**[NEW] Achievements Window** — Category Navigator (sidebar desktop, bottom drop-up portrait); Summary view (recent + progress overview); opens via Player Menu, profile tab, banner tap, or `Y`.

## Cosmetics

**[NEW] Shop gate** — `server/src/shopAccess.ts` + `client/src/cosmetics/shopAccess.ts`: `SHOP_ENABLED` / `VITE_SHOP_ENABLED` must be `1` for featured shelf, unlock intents, and Shaper joins; COMING SOON UI when closed.

**[NEW] Daily featured Shop shelf** — `GET /api/cosmetics/wardrobe` adds `featured: ShopEntry[]` (≤5). Server: `selectDailyFeatured` (FNV-1a day-seeded) + `listDailyFeaturedShop`.

**[NEW] Paper-doll Wardrobe UI** — `wardrobePanel.ts`; `wardrobeSlotTip.ts` for hover/long-press slot labels; `presetSwatch.ts`; Wardrobe Preview hooks on `Game.ts`; backdrop module `wardrobePreviewBackdrop.ts`.

**[NEW] Prefab renderer v2** — Kenney particle pack + declarative prefab registry/factory for aura/trail VFX.

**[NEW] The Shaper + Shaper Return** — `cosmeticGallery.ts`; `returnFromShaper` WS (server-validated origin from `shaperReturnOrigins`, not client coords); sessionStorage return target (30-min TTL).

**[NEW] Public profile deployables** — `GET /api/player-profile/:address` adds `cosmeticDeployables`.

## Action Wheel

**[CHANGE] Glyph-only + focus titles** — `actionWheelGeometry.ts` optional `cornerRadius`; `hud.ts` drops in-wedge labels for Sector Title / Wheel Title chips. Touch: tap-to-reveal then tap-to-activate; Nav Sector single-tap. ADR `docs/adr/0002-action-wheel-glyph-only-focus-titles.md`.

## Room naming

**[CHANGE] Built-in display names** — player-facing **Hub** (`chamber` id) and **Commons** (`hub` id); internal ids unchanged. `server/src/builtinRoomNames.ts`.
