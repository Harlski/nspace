# Ephemeral per-Match pitches for 1v1 soccer

When a Challenge is accepted, the server spins up a fresh **Match Pitch** room from a
template (reusing the Free Play Field's bounds, goals, and ball physics), teleports both
players in, and tears the room down when it empties. We chose this over a fixed pool of
pre-built arenas or reusing the shared field.

## Why

- Rooms are already created on demand (`teleportPlayer` → `rooms.set`) and the ball
  registry is per-room and lazily materialised, so ephemeral rooms cost almost no new
  infrastructure.
- Isolation is the whole point of a 1v1: each Match needs its own ball, goals, goalies,
  score, and stands. A shared room cannot provide that; a fixed pool caps concurrency and
  leaves dead rooms around.

## Consequences

- Match Pitches must be excluded from world-state persistence (they are transient).
- A Match must have a guaranteed end (timer + golden-goal cap + abandonment) so pitches are
  reliably reclaimed; a server restart simply drops in-flight Matches.
- Each entrant's origin room+position is snapshotted on entry so players and spectators are
  returned to where they came from when the Match ends.
