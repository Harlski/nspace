# Reasons — 0.3.4 (patch-notes version)

**Patch-notes version:** `0.3.4` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Gate builder polish (reposition ghost + frozen source mesh, panel/ACL HUD), header marquee, wallet **entry spawn**, and related server gate / hub movement rules ship together in this semver freeze.

---

## By area

### Repo / docs

- **Reposition previews:** `docs/THE-LARGER-SYSTEM.md` — principle **Reposition ghost previews (authoring)** + recorded subsection; companion [docs/reasons/reason_927415.md](../../../docs/reasons/reason_927415.md).

### Client

- Main menu / wallet login: **`APP_DISPLAY_VERSION`** (`client/src/appVersion.ts`, `vite.config.ts` `define` → root `package.json` `version`) replaces hard-coded `v0.3.0` in `mainMenu.ts`.
- Build mode: **reposition ghost** for non-gate **obstacles** at valid empty-tile hovers (`tryGenericObstacleMoveHoverTile`, `syncRepositionObstacleGhost`, `clearRepositionObstacleGhost` in `client/src/game/Game.ts`) — same translucent `makeBlockMesh` path as new-block placement preview.
- Gates: **swing-side** controls removed; hinge uses **exit side** only; **green/red** translucent overlays on exit vs front neighbor tiles while **placing** or **moving** a gate (walkability/blocking feedback; **server** no longer requires walkable exit/front for placement); `placePendingGate` still accepts `faceDir` on the wire but it is ignored (`server/src/rooms.ts` stores `rampDir` **0** for new gates) (`client/src/game/grid.ts`, `client/src/game/Game.ts`, `client/src/ui/hud.ts`, `client/src/main.ts`).
- In-game header marquee: streak ticker (scroll from right, dedupe labels) + rotating `newsMessages[]` with server-driven dwell seconds (`client/src/ui/headerMarquee.ts`, styles).
- Gates: thin hinged panel (~90° open), optional `faceDir` on `placePendingGate`, swing-side controls in gate tool; **placement** sends `colorId` with `placePendingGate` (build bar hue ring); gate context menu shows **Open gate** for everyone (unauthorized → floating **You can't open that** above the gate); walk mode **double-click** the gate when orthogonally adjacent (within place radius) opens for authorized users, same denial float otherwise; plain floating text uses a **gentler spring** motion (low vertical travel); **R** rotates exit when Gate tool is active (including when the object panel is open); gate tool takes **R** before billboard yaw; **placed gates** stay editable in the object panel (exit + swing + color, same `setObstacleProps` wire as placement); **gate ACL modal** (identicon + label per wallet, remove row, add from in-room players, save → `setGateAuthorizedAddresses`) plus object-panel **Edit access…** for gate owner / admin (`client/src/game/Game.ts`, `client/src/game/gateAuth.ts`, `client/src/ui/hud.ts`, `client/src/net/ws.ts`, `client/src/main.ts`).
- Wallet rooms: **Entry spawn** build tool + pulsing floor ring (build mode only); `sendUpdateRoom` `joinSpawn` patch; `roomJoinSpawn` message (`client/src/main.ts`, `client/src/ui/hud.ts`, `client/src/game/Game.ts`, `client/src/net/ws.ts`).
- Gate **reposition:** semi-transparent **ghost** mesh at valid hover; exit/front **tint** uses hover + live object-panel gate (`resolveGateRepositionPreviewAtHover`, `syncRepositionGateGhost`); `refreshGateRepositionPreviewsFromStoredPointer()` after `emitPanelProps` / inspector preview so tints update when rotating opening **without** moving the pointer (`lastPointerClientPixels`); **placed** block at the source tile renders with **frozen** `gate.exitX`/`exitZ` from move start until reposition ends (`repositionGatePlacedVisualFreeze`, `gateRepositionPlacedRenderMeta` in `syncBlockMeshes`) (`client/src/game/Game.ts`, `client/src/ui/hud.ts`).
- Gate **object panel / ACL:** removed long “neighbor colors…” copy; removed nonfunctional generic **Edit** button (billboard **Edit** unchanged); **Edit access…** → **Permissions**; ACL “add someone” uses a scrollable **button list** with **identicon + name** per in-room player instead of a native `<select>` (`client/src/ui/hud.ts`, `client/src/style.css`).
- Gates / **movement:** `level1SurfaceOpen` and `inferTerrainStartLayer` treat gate obstacles as **passage-only** (no layer-1 block-top stance), matching server — avoids snapping to the top of the door mesh when `gateOpen` expires while someone is still on the tile (`client/src/game/grid.ts`).

### Server

- `placePendingGate`: `faceDir` argument ignored; new gates always persist `rampDir` **0** (hinge handedness comes from exit side on the client) (`server/src/rooms.ts`).
- Gates: **neighbor floor walkability** no longer required for `placePendingGate` or gate exit direction in `setObstacleProps`; hub spawn / signboard-on-gate / player-on-tile rules unchanged (`server/src/rooms.ts`).
- Gates: placer/editor **ignored on exit/front tiles** for neighbor occupancy so rotating opening direction works while standing beside the gate (`server/src/rooms.ts`, `client/src/game/Game.ts`).
- `placePendingGate` accepts optional `colorId` (clamped like other blocks; default **7** if omitted); stored on the placed obstacle instead of a fixed palette index (`server/src/rooms.ts`).
- **Hub** (`hub` / legacy `lobby`): any player may **`openGate`** without being on the gate ACL; while the gate is open, **pathfinding treats the gap as passable for everyone in the hub** (matches client `isGatePassableForMover` + `floorWalkableTerrainForMover` with `roomId`) (`server/src/rooms.ts`, `server/src/grid.ts`, `client/src/game/grid.ts`, `client/src/game/Game.ts`, `client/src/game/gateAuth.ts`, `client/src/main.ts`).
- Gates: if exit/front floor is **not walkable** or there is **no path** across, server still **broadcasts `gateOpen`** (hinge animation) then sends **`gateWalkBlocked`** to the opener; client shows floating **You can't walk into that** (no chat spam) (`server/src/rooms.ts`, `client/src/net/ws.ts`, `client/src/main.ts`).
- Header marquee store: `newsMessages[]`, `marqueeStreakSeconds`, `marqueeMessageSeconds`; leaderboard label disambiguation; `GET /api/header-marquee` / admin `/admin/header` (`headerMarqueeSettingsStore.ts`, `adminHeaderPage.ts`, `index.ts`). Streak top list dedupes normalized wallet keys (`loginStreakStore.ts`).
- Gates: `placePendingGate` accepts `faceDir` (persisted as obstacle `rampDir`); `openGate` path goal is the **opposite** neighbor when the opener stands on the exit tile; requires walkable **front** tile; path length 1 no longer cancels an open; `GATE_OPEN_PASS_MS` **1s** (was 9s); `setObstacleProps` on an existing gate uses `gateExitDir` + `rampDir` (swing) with shared exit-neighbor validation; stored `gate` uses `adminAddress` + `authorizedAddresses` (max 5, normalized in `grid.ts`); **`setGateAuthorizedAddresses`** handler (owner/admin ACL edits; non-admin add-only from in-room humans); canvas maze `obstacles` broadcast uses `obstaclesToList` so wire payloads stay normalized (`server/src/rooms.ts`, `server/src/grid.ts`).
- Wallet rooms: persisted `joinSpawnX` / `joinSpawnZ` in room registry (file v6); default visitor placement after URL spawn hint + per-wallet saved spawn; `joinRoom` + first-connect resolution; `updateRoom` `joinSpawn` + `roomJoinSpawn` broadcast (`server/src/roomRegistry.ts`, `server/src/rooms.ts`).
- Gates / **movement:** `level1SurfaceOpen` returns false for **gate** bases; `inferTerrainStartLayer` returns floor layer (`0`) when the snapped tile is a closed gate — so idle `resolveNearestTerrainNode` / `snapPlayerToTerrainGrid` after `gateOpen` expiry picks **adjacent walkable floor** instead of `waypointY` on the gate column (`server/src/grid.ts`).

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- Vercel rewrites: `/admin/header` → API host (root + `client/vercel.json`).
