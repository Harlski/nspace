# Public patch notes — developers (`0.3.14`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **[NEW]** WebSocket **`placeTeleporterBidirectionalPair`** — same-room reciprocal teleporters with **`teleporter.pairedPeerKey`**; linked removal in [server/src/rooms.ts](../../../../server/src/rooms.ts).
- **[NEW]** [client/src/ui/buildDockContextParams.ts](../../../../client/src/ui/buildDockContextParams.ts) — dock context param visibility by tool/shape.
- **[NEW]** [client/src/ui/paletteHueRing.ts](../../../../client/src/ui/paletteHueRing.ts) — shared hue ring helper for dock / room BG popover.
- **[CHANGE]** [client/src/ui/hud.ts](../../../../client/src/ui/hud.ts) — bottom build dock; **`resetBuildEditScopeToObjects`** on walk and when opening build; mobile **`#hud-build-edit-kind-popover`**; room settings in **`build-dock-context-mods`**.
- **[CHANGE]** [client/src/game/Game.ts](../../../../client/src/game/Game.ts) — dock thumbnail bakes (`getDockStripThumbnailDataUrls`, terrain shape URLs, floor dock thumb).
- **[DOCS]** [docs/build_menu.md](../../../../docs/build_menu.md), [docs/THE-LARGER-SYSTEM.md](../../../../docs/THE-LARGER-SYSTEM.md) (reasons [906712](../../../../docs/reasons/reason_906712.md), [917384](../../../../docs/reasons/reason_917384.md)).

Full file-level inventory: [../reasons.md](../reasons.md).
