# Reasons — 0.3.28 (patch-notes version)

**Patch-notes version:** `0.3.28` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Admin Rooms manager (`/admin/rooms`): browse Official / Player Owned rooms, preview each (2D thumbnail + interactive 3D), edit room properties, and manage a per-room builder allowlist controlling who may build/edit. Built-in rooms (Hub, Chamber, Canvas, Pixel) support the same builder allowlist; for restricted built-ins (Chamber) this grants build/edit to listed wallets, matching admin capability.

---

## By area

### Repo / docs

- [docs/process.md](../../../docs/process.md): documented the admin rooms HTTP API, the `rooms.json` v7 builder allowlist, and its capability propagation behavior.
- [docs/features-checklist.md](../../../docs/features-checklist.md): added the Admin Rooms manager entry.

### Client

- New Vite MPA entry `client/roomPreview.html` + [client/src/roomPreview.ts](../../../client/src/roomPreview.ts): standalone interactive 3D room preview that reuses the Three.js `Game` engine, fed by a layout snapshot (no WebSocket join, no avatars). Registered `roomPreview` in [client/vite.config.ts](../../../client/vite.config.ts) rollup input.
- [client/src/ui/mainSiteNav.ts](../../../client/src/ui/mainSiteNav.ts): added the system-admin **Rooms** nav item.

### Server

- [server/src/roomRegistry.ts](../../../server/src/roomRegistry.ts): `rooms.json` bumped to **v7** with a per-room `builderAddresses` array (compact NQ keys, max 50, validated/deduped); new `getDynamicRoomBuilderAddresses` / `isDynamicRoomBuilder` / `normalizeBuilderAddressesPatch`; `updateDynamicRoomMetadata` accepts `builderAddresses` (admin-only).
- [server/src/builtinRoomNames.ts](../../../server/src/builtinRoomNames.ts): `builtin-room-names.json` bumped to **v4** with a per-room `builderAddresses` map (compact NQ keys, validated/deduped via the shared sanitizer); new `getBuiltinRoomBuilderAddresses` / `isBuiltinRoomBuilder`; `patchBuiltinRoomSettings` accepts `builderAddresses`.
- [server/src/rooms.ts](../../../server/src/rooms.ts): `canEditRoomContent()` now grants build/edit to builder-allowlist wallets (dynamic rooms and restricted built-ins like Chamber); new exports `getRoomLayoutSnapshot` (full non-spatial welcome-equivalent; `spatial: true` for huge rooms), `getRoomFloorColorMapForThumbnail`, and `broadcastRoomCatalogRefresh`.
- [server/src/roomThumbnailImage.ts](../../../server/src/roomThumbnailImage.ts): new generic top-down PNG rasterizer (floor colors + block tops) generalizing the Pixel board image.
- [server/src/adminRoomsPage.ts](../../../server/src/adminRoomsPage.ts): new server-rendered `/admin/rooms` page (Official / Player tabs, cards, property + builder editor, 3D preview modal).
- [server/src/index.ts](../../../server/src/index.ts): new `requireSystemAdminWallet` routes — `GET /api/admin/rooms` (now exposes builder allowlists for built-ins too), `GET /api/admin/rooms/:id/layout`, `GET /api/admin/rooms/:id/thumbnail.png` (query-token auth for `<img>`), `GET /api/admin/users` (builder picker), `PUT /api/admin/rooms/:id` (accepts `builderAddresses` for built-in and dynamic rooms); plus the `/admin/rooms` page route.
- [server/src/mainSiteNav.ts](../../../server/src/mainSiteNav.ts): added the `rooms` admin nav item + visibility rule.

### Gold mineable blocks (admin placement)

- [server/src/rooms.ts](../../../server/src/rooms.ts): `canPlaceMineableBlocks()` now also allows `isAdmin` wallets (previously only the hardcoded reward-wallet allowlist), so admins can place claimable/gold blocks; rejection message updated.
- [client/src/ui/hud.ts](../../../client/src/ui/hud.ts): new inline **Gold** toggle (`buildDockClaimToggle`) in the build bottom dock beside the rotate-scope controls, visible only to admins. Context-aware: in placement it mirrors the advanced-popover claim toggle (shared `applyClaimToggleUi`); with a plain block **selected** (`buildDockClaimSelectionApplicable`) it flips that block's gold state via `setObstacleProps` and forces it solid. `buildLivePanelObstacleProps` now always emits an explicit `claimable`/`active`.
- [client/src/net/ws.ts](../../../client/src/net/ws.ts): `sendSetObstacleProps` now sends `claimable`/`active` on the wire (previously client-only).
- [server/src/rooms.ts](../../../server/src/rooms.ts): `setObstacleProps` honors `msg.claimable` — turning gold **on** (initializes `active`/`cooldownMs`, forces `passable: false`) or **off** (clears claim state) is gated by `canPlaceMineableBlocks`; omitted/unchanged `claimable` preserves existing claim state.
- [client/src/style.css](../../../client/src/style.css): gold styling for the dock toggle (`.hud-build-bottom-dock__rotate--claim` / `--claim-active`).

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- No new env vars or compose changes. `rooms.json` migrates **v6 → v7** and `builtin-room-names.json` migrates **v3 → v4** automatically on load (existing rooms default to an empty builder allowlist).
- [vercel.json](../../../vercel.json) + [client/vercel.json](../../../client/vercel.json): added a `/admin/rooms` → `https://api.nimiq.space/admin/rooms` rewrite so the new server-rendered admin page is reachable on the split SPA host. The admin APIs are already covered by `/api/:path*`, and the 3D preview (`/roomPreview.html`) is a static client build artifact.
