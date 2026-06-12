# Public patch notes — developers (`0.3.26`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **[CHANGE]** Room welcome zoom — [`client/src/main.ts`](../../../../client/src/main.ts): non-canvas `welcome` sets `game.setZoomFrustumSize(game.getZoomBounds().max)`; removed `LS_ZOOM_NON_MAZE_FRUSTUM` / `nonMazeFrustum` restore. Canvas maze still `setZoomLocked(true, zoomMin)`.
- **[CHANGE]** Chamber max zoom — [`client/src/game/roomLayouts.ts`](../../../../client/src/game/roomLayouts.ts): `CHAMBER_MAX_ZOOM_FRUSTUM = 18.9`; [`client/src/game/Game.ts`](../../../../client/src/game/Game.ts): `zoomMaxForRoomBounds(bounds, roomId?)` returns that constant for `chamber`.
