# Reasons — 0.3.26 (patch-notes version)

**Patch-notes version:** `0.3.26` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

**Room-load camera zoom** — entering a non-canvas room starts at max zoom-out for that room; chamber max zoom raised to **18.9** ortho half-height; removed `nspace_zoom_non_maze_frustum` restore path.

---

## By area

### Repo / docs

- _(none in this change set)_

### Client

- **`client/src/main.ts`:** On WebSocket `welcome`, non-canvas rooms call `game.setZoomFrustumSize(game.getZoomBounds().max)` instead of restoring prior frustum from `nonMazeFrustum` / `localStorage` (`LS_ZOOM_NON_MAZE_FRUSTUM` removed). Canvas maze still locks zoom to min.
- **`client/src/game/roomLayouts.ts`:** `CHAMBER_MAX_ZOOM_FRUSTUM = 18.9`.
- **`client/src/game/Game.ts`:** `zoomMaxForRoomBounds(bounds, roomId?)` returns chamber constant when `roomId === chamber`; `syncRoomZoomMaxFromBounds` passes `this.roomId`.

### Server

- _(none in this change set)_

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- Client-only release; redeploy static client / game server bundle as usual. No env or migration changes.
