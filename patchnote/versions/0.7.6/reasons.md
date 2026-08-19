# Reasons — 0.7.6 (patch-notes version)

**Patch-notes version:** `0.7.6` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Same-WS room entry (Private Room / Play Space, Pixel) now lands at Join Spawn and hard-snaps the local avatar. Pixel Collaborator uses occupants of the room you are in now, not the connect-time Hub map. Profile username edit field no longer collapses to padding-only width.

---

## By area

### Repo / docs

- _(none yet)_

### Client

- Profile username edit field was collapsing to padding-only width (`width: 0` + `min-width: 0` in a non-growing name row). Inline input now sizes for the 12-character cap and the name block expands while editing (`client/src/style.css`, `client/src/ui/hud.ts`).
- Same-WS room welcome now hard-snaps the local avatar. Hub spawn `(-5, 0)` to lounge center `(0, 0)` is under the 6-tile jump threshold, so the mesh (and debug overlay) could keep the previous room's coordinates (`client/src/game/cameraSelfSync.ts`, `client/src/game/Game.ts`). `applyRoomFromWelcome` clears `selfTargetPos` and sets `pendingRoomWelcomeSnap`.
- Camera look-at hitch regression: after Path Playback drain, a late `walking=false` heartbeat behind the last sample must not rewind the local pose (`client/src/game/selfCameraRubberband.test.ts`).

### Server

- `joinRoom` into a Play Space now seeds the template layout *before* resolving Join Spawn, so the host lands on the template teleporter / Join Spawn tile instead of lounge center `(0, 0)` (`server/src/rooms.ts`). Regression: `server/test/privateRoomJoinSpawn.test.ts` (Hub standing tile / Hub default spawn `(-5, 0)` must not be reused).
- Pixel Collaborator (and tile occupancy) now uses occupants of `currentRoomId`, not the connect-time `room` map that stayed Hub/Chamber after `joinRoom` (`server/src/rooms.ts`). Occupant-set helper lives in `otherPresentWalletsFromOccupants` (`server/src/miningPixelAchievementEvaluator.ts`). Painting inside a foreign 10x10 interior only unlocks with co-presence in the current room (`server/test/miningPixelAchievementEvaluator.test.ts`, `server/test/achievementStore.test.ts`).

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
