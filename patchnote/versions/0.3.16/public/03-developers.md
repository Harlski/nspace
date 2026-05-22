# Public patch notes — developers (`0.3.16`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a dump of `reasons.md` (that stays in [../reasons.md](../reasons.md)).

---

- **[CHANGE]** **Block color wire format** — prefer **`colorRgb`** (`number`, `#RRGGBB`) on `placeBlock`, `setObstacleProps`, gates, and related payloads; [server/src/blockColors.ts](../../../../server/src/blockColors.ts) resolves legacy **`colorId`** at load. Client palette/recent-color modules removed in favor of [client/src/ui/paletteHueHexPopover.ts](../../../../client/src/ui/paletteHueHexPopover.ts) + [client/src/ui/paletteHueRing.ts](../../../../client/src/ui/paletteHueRing.ts).
- **[NEW]** **`hexRadiusScale`** / **`sphereRadiusScale`** (clamped 0.25–1) on server `PlacedProps` and client placement style; server accepts **`hexHeightScale`** as a read alias for hex radius.
- **[FIX]** [client/src/ui/hud.ts](../../../../client/src/ui/hud.ts) — `previewPlacementColorRgb` updates UI + `Game.setPlacementBlockStyle` only; `applyPlacementColorRgb` calls `placementStyleHandler` (avoids `syncBuildHud` per hex keystroke). Stepper busy guards for hex width / sphere size mirror height/pyramid base.
- **[FIX]** [client/src/main.ts](../../../../client/src/main.ts) — `isPaletteHueHexPopoverTyping()` early-outs global build hotkeys; debug stats RAF only when `hud.isDebugPanelVisible()`; `?debug` still opens panel on load.
- **[NEW]** Room BG — `roomBgColorFromRgb` / neutral preview+commit handlers in [client/src/main.ts](../../../../client/src/main.ts); scene tint in [client/src/game/Game.ts](../../../../client/src/game/Game.ts).

Full inventory: [../reasons.md](../reasons.md).
