# Reasons — 0.3.14 (patch-notes version)

**Patch-notes version:** `0.3.14` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

**Bottom build dock** overhaul: dark glass chrome, **Terrain / Props / Buildings** + **Objects/Room** on the tab row, **docked GL previews** and **PNG thumbnails**, compact **two-column context** (modifiers + hue). **Room** scope: **Floor** / **Room settings** tabs; **room background hue** in the **context column**; **mobile** Objects/Room **overlay** (not native select); **reset to Objects** when closing or reopening build. **Teleporter** same-room **bidirectional pairs** (server authority + dock destination UI). Docs: **THE-LARGER-SYSTEM**, **build_menu.md**, **build.md**, **features-checklist**.

---

## By area

### Repo / docs

- [docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md) — **Authoring HUD: bottom build dock** recorded decision (chrome, mobile scope overlay, Room settings in context, scope reset); changelog + [docs/reasons/reason_906712.md](../../../docs/reasons/reason_906712.md), [docs/reasons/reason_917384.md](../../../docs/reasons/reason_917384.md).
- [docs/build_menu.md](../../../docs/build_menu.md) — **new** build dock component reference (placement vs selection, Room tabs, mobile scope picker).
- [docs/build.md](../../../docs/build.md) — **Build mode HUD (client)** subsection.
- [docs/features-checklist.md](../../../docs/features-checklist.md) — build dock, teleporter pairs, checklist alignment.
- [docs/README.md](../../../docs/README.md), [docs/getting-started.md](../../../docs/getting-started.md), [docs/process.md](../../../docs/process.md) — pointers / controls copy where touched.

### Client

- [client/src/ui/hud.ts](../../../client/src/ui/hud.ts) — bottom build dock (tabs, **Objects/Room** scope, **edit-kind overlay** on mobile, **context grid**, **room settings** in `build-dock-context-mods`, **`resetBuildEditScopeToObjects`** on walk/close/open); teleporter **destination `<select>`** in dock context; selection satellite / deselect **×**; room BG popover; shared [paletteHueRing.ts](../../../client/src/ui/paletteHueRing.ts).
- [client/src/ui/buildDockContextParams.ts](../../../client/src/ui/buildDockContextParams.ts) — **new** visibility rules for dock context param rows (`height`, `pyramid-base`, `billboard-edit`).
- [client/src/style.css](../../../client/src/style.css) — `.hud-build-bottom-dock*`, dark glass tokens, edit-kind popover, room settings in context, teleporter dock styling.
- [client/src/game/Game.ts](../../../client/src/game/Game.ts) — dock / terrain **thumbnail bakes**; floor dock thumb; inspector selection teleporter preview; obstacle **`teleporter.pairedPeerKey`** on wire.
- [client/src/main.ts](../../../client/src/main.ts) — **`sendPlaceTeleporterBidirectionalPair`**, teleporter HUD pairing, build dock wiring.
- [client/src/net/ws.ts](../../../client/src/net/ws.ts) — **`sendPlaceTeleporterBidirectionalPair`**.
- [client/src/game/blockStyle.ts](../../../client/src/game/blockStyle.ts) — **`pairedPeerKey`** on configured teleporter.
- [client/src/ui/adminOverlay.ts](../../../client/src/ui/adminOverlay.ts) — minor alignment with HUD/build paths where touched.

### Server

- [server/src/grid.ts](../../../server/src/grid.ts) — **`pairedPeerKey`** on configured `teleporter` props type.
- [server/src/rooms.ts](../../../server/src/rooms.ts) — **`placeTeleporterBidirectionalPair`** inbound; **`placeBidirectionalTeleporterPairAt`**, linked delete on **`removeObstacle`**, peer clear on **`configureTeleporterDestination`**; destination tile range on **`configureTeleporter`**.

### payment-intent-service

- _(no changes in this change set)_

### Deploy / ops

- _(no changes in this change set)_
