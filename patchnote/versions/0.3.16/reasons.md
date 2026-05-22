# Reasons — 0.3.16 (patch-notes version)

**Patch-notes version:** `0.3.16` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

**[NEW]** Block and gate colors use **`colorRgb`** end-to-end (build dock **hue ring** + shared **hex popover** on ring center); legacy **`colorId`** migrated on server load. **Hex thickness** and **sphere size** use ± steppers (25–100%). **Room background** editing uses the same hue ring + hex popover; low-saturation hex maps to neutral sky (black/white/gray) instead of hue 0° red.

**[FIX]** Placement hex popover no longer closes on each keystroke (`previewPlacementColorRgb` avoids `placementStyleHandler` → `syncBuildHud` during live preview). Dock prism steppers (height / hex thickness / sphere size) no longer snap back from stale server echoes while ± is held. Debug stats overlay hidden by default (profile identicon toggle). Room BG `#000` no longer tints the scene red.

**[CHANGE]** Removed preset **recent color** swatches and main-menu floating NIM logo layer. Build dock **context-mods** column grows with content (no inner vertical scroll on that column).

---

## By area

### Repo / docs

- [docs/features-checklist.md](../../../docs/features-checklist.md) — `colorRgb`, hue ring + hex, hex/sphere steppers.
- [docs/build.md](../../../docs/build.md), [docs/build_menu.md](../../../docs/build_menu.md) — hue ring hex popover, dock params.
- [docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md) — build dock: `colorRgb`, hex popover, live-preview without full HUD resync; [docs/reasons/reason_284651.md](../../../docs/reasons/reason_284651.md).

### Client

- [client/src/game/blockStyle.ts](../../../client/src/game/blockStyle.ts) — `colorRgb` helpers (`tryParseColorRgbHex`, `previewColorRgbHex`, hue ↔ RGB); room BG neutral mapping (`roomBgColorFromRgb`, `ROOM_BG_NEUTRAL_RGB`).
- [client/src/ui/paletteHueHexPopover.ts](../../../client/src/ui/paletteHueHexPopover.ts) — shared hex dialog (`onRgbPreview` / `onRgbCommit`, outside `click` dismiss, `isPaletteHueHexPopoverTyping`).
- [client/src/ui/paletteHueRing.ts](../../../client/src/ui/paletteHueRing.ts) — core hex trigger hookup.
- [client/src/ui/hud.ts](../../../client/src/ui/hud.ts) — hue rings (placement, selection, room BG); hex/sphere steppers; `syncPlacementColorRgbUi` vs `applyPlacementColorRgb` / `previewPlacementColorRgb` (preview → `setPlacementBlockStyle` only); room BG popover; debug panel toggle; main-menu NIM layer removed from wiring.
- [client/src/ui/mainMenu.ts](../../../client/src/ui/mainMenu.ts) — removed floating NIM logo spawn.
- [client/src/ui/recentColors.ts](../../../client/src/ui/recentColors.ts) — **deleted**.
- [client/src/ui/buildDockContextParams.ts](../../../client/src/ui/buildDockContextParams.ts) — `hex-width` / `sphere-size` param visibility.
- [client/src/game/Game.ts](../../../client/src/game/Game.ts) — meshes/tints from `colorRgb`; hex radius / sphere radius scales; room scene background from room BG style.
- [client/src/game/grid.ts](../../../client/src/game/grid.ts) — placement style includes `colorRgb`, scales.
- [client/src/net/ws.ts](../../../client/src/net/ws.ts) — wire `colorRgb`, `hexRadiusScale`, `sphereRadiusScale` on place/set props.
- [client/src/main.ts](../../../client/src/main.ts) — placement/room-bg handlers; hex typing skips global build hotkeys; debug HUD gated on `isDebugPanelVisible()`.
- [client/src/style.css](../../../client/src/style.css) — hue hex popover, stepper rows, room BG wheel pad, dock context layout.

### Server

- [server/src/blockColors.ts](../../../server/src/blockColors.ts) — palette constants, `resolveBlockColorRgb`, legacy `colorId` migration.
- [server/src/rooms.ts](../../../server/src/rooms.ts) — `PlacedProps.colorRgb`, `hexRadiusScale`, `sphereRadiusScale`; wire parse `colorRgbFromWire`; accepts scales on place/set.
- [server/src/grid.ts](../../../server/src/grid.ts) — benchmark/types aligned with `colorRgb` + scales.

### payment-intent-service

- _(no changes)_

### Deploy / ops

- Ship **client and server** from the same release: persisted worlds and WS messages expect **`colorRgb`** (legacy `colorId` still read on load). No new environment variables.
