# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [CHANGE] The phone QR page renders `placeCode` from `GET /api/auth/qr-login/:ticketId/challenge` on the sign-in screen, before `preview` or `complete`. The confirm card still titles itself **Sign in on {code}?** and hides that larger code.
- `welcome.canReturnToLastRoom` is set when the open socket arrived through a teleporter into a different room. The client then sends `returnToLastRoom` instead of opening a new Hub connection.
- The server keeps the departure room and tile on that connection. The return lands on the tile when a configured teleporter is still the top block and the tile is walkable. Otherwise it uses that room's join spawn. A missing room falls back to the Hub. `joinRoom` clears the remembered tile.
- Player rooms and other custom rooms use `PLAYER_ROOM_MAX_ZOOM_FRUSTUM` (18.7) as both the room zoom and the frustum cap. Commons, Hub, Canvas, Pixel, Public Rooms, Tutorial, The Shaper, Play Spaces, and Match Pitches are left on their existing zoom.
- Public Directory welcome includes `directoryRanking` (`nextAtMs`, `serverNowMs`, `intervalMs`). The same payload is broadcast as `directoryRanking` each time the hall rebinds (about every 5 seconds). The hint strip counts down from that clock and does not use `aria-live` while the countdown is showing.
