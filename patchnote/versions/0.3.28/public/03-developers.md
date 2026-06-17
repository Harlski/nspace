# Public patch notes — developers (`0.3.28`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [NEW] **Admin Rooms manager** at `/admin/rooms` ([server/src/adminRoomsPage.ts](../../../server/src/adminRoomsPage.ts)) with `requireSystemAdminWallet` APIs:
  - `GET /api/admin/rooms` — all rooms with `category` (`builtin`/`official`/`player`), owner, player count, visibility, background, and `builderAddresses` (built-in and dynamic).
  - `GET /api/admin/rooms/:id/layout` — full non-spatial layout snapshot (`getRoomLayoutSnapshot` in [server/src/rooms.ts](../../../server/src/rooms.ts)); huge spatial rooms (Pixel) return `spatial: true` with floor lists omitted.
  - `GET /api/admin/rooms/:id/thumbnail.png?token=<JWT>` — generic top-down PNG ([server/src/roomThumbnailImage.ts](../../../server/src/roomThumbnailImage.ts)); Pixel reuses `/pixels.png`.
  - `GET /api/admin/users` — known wallets (recent players, custom usernames, owners, builders) with display labels for the builder picker.
  - `PUT /api/admin/rooms/:id` — patch `displayName`, `isPublic`, `backgroundHueDeg`/`backgroundNeutral`, `joinSpawn` (dynamic rooms only), and `builderAddresses` (dynamic **and** built-in rooms).
- [NEW] **Per-room builder allowlist** — `rooms.json` v7 and `builtin-room-names.json` v4 add `builderAddresses` (compact NQ, max 50); `canEditRoomContent()` grants build/edit to listed wallets. For built-ins the allowlist matches admin capability per room (e.g. Chamber unlocks for listed wallets; Hub is already open; Canvas/Pixel stay locked for everyone). Takes effect server-side immediately; an in-room player's build toolbar refreshes on rejoin (capabilities ride `welcome`).
- [NEW] **Standalone 3D room preview** — `client/roomPreview.html` + [client/src/roomPreview.ts](../../../client/src/roomPreview.ts) reuse the Three.js `Game` engine from a layout snapshot (no WebSocket, no avatars); new `roomPreview` Vite rollup entry.
- [NEW] **Admins can place/edit gold mineable blocks** — `canPlaceMineableBlocks()` ([server/src/rooms.ts](../../../server/src/rooms.ts)) now allows `isAdmin` wallets in addition to the reward-wallet allowlist. A new admin-only inline **Gold** toggle in the build dock (next to the rotate controls, [client/src/ui/hud.ts](../../../client/src/ui/hud.ts)) is context-aware: in placement it sets the `claimable` flag on `placeObstacle`; with a plain block **selected** it flips that block's gold state via `setObstacleProps`. `setObstacleProps` now honors `claimable` (on → initializes claim state + forces solid; off → clears it; both gated by `canPlaceMineableBlocks`; otherwise preserved), and `sendSetObstacleProps` sends `claimable`/`active` on the wire.
- No new WS message types; metadata edits broadcast via existing `broadcastRoomCatalogRefresh()`.
