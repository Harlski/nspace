# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

**[NEW] Player Menu** — `client/src/ui/playerMenu.ts` + HUD wiring: bottom-right identicon opens a vertical navigation popover (Profile/Wardrobe/Rooms/Return to Hub/Logout; guest variant). Reuses existing profile/wardrobe/rooms surfaces; closes Action Wheel on open and vice versa. Domain terms in `CONTEXT.md`.

**[CHANGE] Built-in room display names** — player-facing **Hub** (`chamber` id) and **Commons** (`hub` id); internal ids unchanged. Defaults in `server/src/builtinRoomNames.ts`; top-bar label **Return to Hub**.

**[NEW] Paper-doll Wardrobe UI** — `client/src/cosmetics/wardrobePanel.ts` replaces list-based Owned/Shop tabs; `presetSwatch.ts` for v1 static thumbnails; WoW-inspired slot chrome in `style.css`. Spec: [docs/prd/cosmetic-shop.md](../../../docs/prd/cosmetic-shop.md) § Wardrobe UX.

**[NEW] Wardrobe Preview hooks** — `Game.setSelfCosmeticPreviewSlot`, `revertSelfCosmeticPreviewSlot`, `clearSelfCosmeticPreview`; wired from HUD via `configureCosmeticHandlers({ onPreviewSlot, onRevertAllPreview })`.

**[NEW] Public profile deployables** — `GET /api/player-profile/:address` adds `cosmeticDeployables: { presetId, displayName }[]` for read-only Items strip on other profiles.
