# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

**[NEW] Player Menu** — `client/src/ui/playerMenu.ts` + HUD wiring: bottom-right identicon opens a vertical navigation popover. Full players: **Wardrobe/Shop**/Achievements/Rooms/Return to Hub/Logout (Profile dropped — still on the top-bar identicon); guests keep Profile + Get a Wallet + Leave (no Shop). Reuses existing profile/wardrobe/rooms surfaces; closes Action Wheel on open and vice versa. Domain terms in `CONTEXT.md`.

**[NEW] Daily featured Shop shelf** — `GET /api/cosmetics/wardrobe` adds `featured: ShopEntry[]` (≤5). Server picks a global, day-seeded subset of Published shop entries via pure `selectDailyFeatured` (FNV-1a over `dayKey:sku`) + `listDailyFeaturedShop` (`server/src/cosmeticStore.ts`); per-wallet `owned` annotation. `wardrobePanel.ts` Shop tab renders cards (Buy → `unlock-intent`/`unlock-sync`; Equip for owned passives; Owned + Action-Wheel note for deployables) and a Shaper link.

**[NEW] The Shaper player-facing + Shaper Return** — `isCosmeticGalleryEnabled()` now gated by `SHAPER_ENABLED` (default on) instead of `NODE_ENV`, so room `cosmetic-gallery` (join **SPACER**) is reachable in prod (still unlisted). New constrained WS `returnFromShaper {roomId,x,z}` (`sendReturnFromShaper`): server honors it only while the sender is inside The Shaper, re-applies room access rules (rejects match pitches / invite lobbies, Hub fallback), and clamps the position to a walkable tile via `resolveReturnSpawn`. Client stores the origin (room + approximate tile) in sessionStorage with a 30-min TTL, captured on every entry; Player Menu **Leave the Shaper** + an in-world button (`hud.setInShaper`/`onLeaveShaper`) trigger it.

**[CHANGE] Built-in room display names** — player-facing **Hub** (`chamber` id) and **Commons** (`hub` id); internal ids unchanged. Defaults in `server/src/builtinRoomNames.ts`; top-bar label **Return to Hub**.

**[NEW] Paper-doll Wardrobe UI** — `client/src/cosmetics/wardrobePanel.ts` replaces list-based Owned/Shop tabs; `presetSwatch.ts` for v1 static thumbnails; WoW-inspired slot chrome in `style.css`. Spec: [docs/prd/cosmetic-shop.md](../../../docs/prd/cosmetic-shop.md) § Wardrobe UX.

**[NEW] Wardrobe Preview hooks** — `Game.setSelfCosmeticPreviewSlot`, `revertSelfCosmeticPreviewSlot`, `clearSelfCosmeticPreview`; wired from HUD via `configureCosmeticHandlers({ onPreviewSlot, onRevertAllPreview })`.

**[NEW] Public profile deployables** — `GET /api/player-profile/:address` adds `cosmeticDeployables: { presetId, displayName }[]` for read-only Items strip on other profiles.

**[CHANGE] Action Wheel glyph-only + focus titles** — `actionWheelGeometry.ts` gains an optional `cornerRadius` (seamless quadratic fillets via `roundedPolyPath`) so the hexagon rounds without gaps between Sectors. `hud.ts` drops in-wedge Sector labels in favor of a **Sector Title** (Focused Sector's name, above the wheel) and **Wheel Title** (current sub-wheel name, below the Nav Sector). Touch uses tap-to-reveal then tap-to-activate; the Nav Sector is single-tap (slice `nav` flag). New `CONTEXT.md` terms + ADR `0002`.

**[NEW] Achievements v1** — Code-defined registry (`server/src/achievementDefinitions.ts`); SQLite progress in campaign DB (`achievementStore.ts`); hooks in `rooms.ts` + `PUT /api/cosmetics/loadout`; `GET /api/achievements/me`; profile fields `achievementPoints` / `achievementHighlights`; WS `achievementUnlocked` / `achievementSignal`; client panel `client/src/achievements/` + Player Menu entry. Achievement-only cosmetic SKUs (`ach-*`, collection **Achievements**) grant via `EntitlementSource` `achievement` and are not shop-purchasable.
