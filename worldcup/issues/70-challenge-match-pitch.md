---
id: "70-challenge-match-pitch"
milestone: M7
depends_on: []
triage: ready-for-agent
status: todo
acceptance:
  - a player can raise/cancel an open Challenge bubble above their avatar (not in field/pitches)
  - another nearby player accepts by clicking the bubble; first-accept-wins clears the Challenge
  - both players are teleported into a freshly-created ephemeral Match Pitch (field geometry/goals/ball)
  - each entrant's origin room+position is snapshotted; leaving/disconnect ends the Match and returns them
  - the Match Pitch is torn down when empty and is never persisted to world state
verify:
  - "npm run build"
  - "npm test -w server"
  - "manual: raise a challenge, have a second client accept, both land in a private pitch, kick around, leaving returns both; pitch is gone afterwards"
---

# 70 — Challenge → ephemeral Match Pitch (kick-around)

## What to build

The thin end-to-end plumbing for 1v1s, per
[ADR 0001](../adr/0001-ephemeral-match-pitches.md), **without** rules yet (no clock or
score — that's `71`).

A player raises an open **Challenge** that floats above their avatar (a HUD toggle,
mirroring the existing ephemeral-intent pattern), allowed anywhere **except** the Free Play
Field and Match Pitches. Any nearby player accepts by clicking/tapping the bubble;
**first-accept-wins** and the Challenge clears. On accept, the server creates an ephemeral
**Match Pitch** (reusing the field's bounds, goals, and ball physics) and teleports both
players in. Each entrant's origin room + position is snapshotted on entry. If either player
leaves or disconnects, the Match ends, the remaining player is returned, and the empty pitch
is torn down. Match Pitches are never persisted.

Include the prefactor here since it's first to need it: an ephemeral-room lifecycle +
origin-snapshot/return helper that `71` and `80` will reuse.

## Acceptance criteria

- [ ] A Challenge can be raised and cancelled from the HUD and renders as a clickable
      bubble on the avatar for everyone in the room.
- [ ] Challenges cannot be raised inside the Free Play Field or a Match Pitch, nor by a
      player already in a Match.
- [ ] Clicking/tapping a Challenge accepts it; concurrent accepts resolve to exactly one
      opponent (first-accept-wins) and the Challenge clears.
- [ ] Both players are moved into a new ephemeral Match Pitch with a working ball and goals.
- [ ] Leaving/disconnecting ends the Match and returns players to their snapshotted origin;
      the pitch is reclaimed when empty and never appears in persisted world state.
- [ ] Touch and mouse both work for raising and accepting.
- [ ] `npm run build` and `npm test -w server` pass.

## Blocked by

None - can start immediately.
