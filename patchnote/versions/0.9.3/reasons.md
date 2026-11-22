# Reasons — 0.9.3 (patch-notes version)

**Patch-notes version:** `0.9.3` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Public Rooms (`directory`) is a hallway of teleporters to public player rooms. The hottest room is the slot closest to the door. Admins can build in the hall, including background and moved teleporters, and those tiles are saved with the world. Each teleporter shows the room name, the owner's identicon, and a person count when the destination has people in it. Outside production, empty rooms show a stable preview count so the chip is visible with no crowd.

Wallet sign-in no longer loops Loading the Hub for accounts that already have a username. Profile lookup ignores spaces in the session address, and a username-required socket close does not reconnect when a name is already set. The admin player dossier shows a 24-hour login history of connected time, active play, and gameplay NIM. Event Log scans use that same compact wallet key, so a spaced session address is the player the digest already named.

---

## By area

### Repo / docs

- [docs/features-checklist.md](../../../docs/features-checklist.md) and [docs/build.md](../../../docs/build.md): Public Directory hall, admin editing, and the occupant chip on teleporter props.

### Client

- [client/src/game/Game.ts](../../../client/src/game/Game.ts): name pill and owner identicon above each directory teleporter; person-count chip when `targetRoomPlayerCount` is greater than 0. The Vite dev client fills an empty count with the same stable preview as the server.
- [client/src/main.ts](../../../client/src/main.ts): directory admins can open the room background control. Close `4009` reconnects only after `saved`.
- [client/src/auth/usernamePromptGate.ts](../../../client/src/auth/usernamePromptGate.ts): gate result is `ready`, `saved`, or `blocked`.

### Server

- [server/src/publicDirectory.ts](../../../server/src/publicDirectory.ts): row-of-three layout, door-distance rebind of saved teleporter slots, and `directoryShownPlayerCount` (real count, or a stable 1-12 preview outside production when the room is empty). Preview counts do not change heat order.
- [server/src/rooms.ts](../../../server/src/rooms.ts): room id `directory` syncs about every 5 seconds. Joins land at `(0, -1)`. Admins can edit the hall, including background. Moved teleporters stay; popularity only rebinds the destination. `obstaclesDelta` can include `roomBounds`. Teleporter props carry `targetRoomDisplayName`, `targetRoomOwnerAddress`, and `targetRoomPlayerCount`.
- [server/src/builtinRoomNames.ts](../../../server/src/builtinRoomNames.ts): display name "Public Rooms", so background hue saves as an official room.
- [server/src/worldPersistence.ts](../../../server/src/worldPersistence.ts): the directory room is saved with the rest of the world, including admin blocks and teleporter positions.
- [server/src/playerProfileStore.ts](../../../server/src/playerProfileStore.ts): `profileWalletKey` strips spaces before every profile read and write.
- [server/src/moderationStore.ts](../../../server/src/moderationStore.ts): username-set ban lookup uses the same compact key as the write path.
- `GET /api/admin/player/activity` (system admin) proxies one wallet's login history from the Analytics Service. `hours` is `24` (default) or `168`.
- `/admin/user/:profile` draws connected vs active spans, an hourly (or daily) column chart, gameplay NIM marks, and a session table. The Activity block's older NIM lines are labeled as payouts sent.

### Analytics service

- `GET /v1/player-activity` scans the Event Log for one address. Connected is `session_start` to `session_end`. Active uses the 5-minute idle cap shared with the hourly digest. Headline totals are unions. Gameplay NIM is `claim_block` / `gameplay_nim_earned`, deduped by `claimId`. An open session extends to the window end only when the game reports the wallet online.
- Wallet match on that scan, on the hourly digest, and on dossier last-visit/today stats strips spaces and uppercases the event-log address before comparing it to the profile key.
- `/admin/user/:profile` shows a small spinner in Login history while that scan is in flight.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
