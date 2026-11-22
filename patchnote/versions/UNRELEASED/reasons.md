# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

_Add a one-line roll-up here when the buffer gets long._

---

## By area

### Repo / docs

- _(none yet)_

### Client

- Top bar and Player Menu rename to **Return to last room** when `welcome.canReturnToLastRoom` is set. The click sends `returnToLastRoom` on the open socket. Catalog joins clear the label until the next welcome. Loading-overlay and idle Hub returns are unchanged.
- Player rooms and other custom rooms use a fixed zoom-out frustum of **18.7** (`PLAYER_ROOM_MAX_ZOOM_FRUSTUM`), both as the room zoom and as the frustum cap. Commons, Hub, Canvas, Pixel, Public Rooms, Tutorial, The Shaper, Play Spaces, and Match Pitches are excluded.

### Server

- A successful `enterPortal` into a different room stores the departure room and tile on the connection. `returnToLastRoom` lands on that tile when a configured teleporter is still the top block and the tile is walkable; otherwise that room's normal join spawn. A missing room falls back to the Hub spawn. `joinRoom` clears the remembered tile. Both welcome payloads include `canReturnToLastRoom`.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
