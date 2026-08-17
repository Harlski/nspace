# Movement Watch is an admin-only opt-in WebSocket side channel

Operators need to see click destinations and authoritative paths for pathfinding debug and
botting watch, without putting path payloads on the normal room stream. Room-wide
`moveOrder` (`MOVE_ORDER_BROADCAST`) already exists but fans out to every client in the room.

**Decision:** **Movement Watch** uses a separate opt-in WebSocket side channel. An admin
toggles Watch on; the client subscribes; the server sends a snapshot of in-flight paths, then
live **Click Marker** / **Watch Path** / clear events only to subscribed admins in that room.
Subscribe and fan-out require `isAdmin` (wallet allowlist). Core rejects (`rate_limited`,
`no_path`, blocked/unwalkable goal) emit on this channel only. Preference may persist in
localStorage and resubscribe across reconnect/room join; the regular `state` / `moveOrder`
stream stays unchanged.

Client-only clicks that never become `moveTo` (local `no_path`, mine / empty-mine primary
clicks) are reported as `movementWatchClickIntent` **only while** the room has at least one
subscriber (`movementWatchActive` broadcast to the room). The server validates reason codes and
fans them out as rejected Click Markers - no gameplay change for players.

**Considered options:** enable public `moveOrder` whenever an admin is present — leaks paths
to players and couples ops tooling to a playback feature; always push path debug to every
connected admin — wastes bandwidth when Watch is off; client-only prediction of remotes —
wrong for authority and cannot show server rejects.

Future readers should not fold Movement Watch into `MOVE_ORDER_BROADCAST` or welcome/state
snapshots.

**See also:** [0017](0017-movement-watch-click-interval.md) — Click Interval stamped on
`movementWatchClick`.
