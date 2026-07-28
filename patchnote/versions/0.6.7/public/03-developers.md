# Public patch notes — developers (`0.6.7`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

[NEW] **Movement Watch** admin side channel (ADR 0013):

- Client → server: `{ type: "movementWatch", enabled }` (`isAdmin` or `admin_required`); `{ type: "movementWatchClickIntent", x, z, layer?, reason }` with `reason` in `no_path` | `mine` | `mine_empty` (only while room watchers exist).
- Server → subscribed admins: `movementWatchSnapshot`, `movementWatchClick`, `movementWatchClear`.
- Server → room: `movementWatchActive` when subscriber count crosses zero.
- Do not fold this into `MOVE_ORDER_BROADCAST` / public `moveOrder`. Details: `server/src/movementWatch.ts`, `client/src/game/movementWatchView.ts`.
