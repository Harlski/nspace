---
id: "104-play-space-ephemeral-edits"
milestone: M8
depends_on: ["100-play-space-template-bootstrap"]
triage: ready-for-agent
status: done
acceptance:
  - all play space occupants can place move remove and recolor within bounds for the session
  - teleporters and gates cannot be placed in play spaces
  - session edits sync live but never persist to disk or mutate templates/source rooms
  - play space teardown discards all in-memory geometry
verify:
  - "npm run build"
  - "npm test -w server"
  - "manual: two clients co-build in play space; teardown; source room unchanged; guest cannot leave via teleporter"
---

# 104 — Ephemeral session edits in Play Spaces

## Parent

[worldcup/PRD-play-space-templates.md](../PRD-play-space-templates.md)

## What to build

Enable **Ephemeral Session Edits** per [worldcup/CONTEXT.md](../CONTEXT.md): **all occupants**
(creator and Guests) may fully edit within Play Space bounds for the session. Changes sync
over the normal game channel but are **never** persisted to world state, **Play Space
Template**, or **Template Source Room**.

**Server:**

- Invite-lobby rooms become editable (`canEditRoomContent` and related gates).
- Template-seeded blocks are not locked against removal.
- Placement rules still forbid teleporters and gates (guest confinement).
- World persistence excludes invite-lobby room ids (defense in depth).
- Existing teardown clears in-memory geometry on Play Space close.

**Client:**

- Build HUD available in Play Spaces when server grants edit permission.

Regression: Guest confinement to Play Space + Match Pitches unchanged (ADR 0003).

## Acceptance criteria

- [ ] Creator and Guest can place/move/remove/recolor blocks and floor in a Play Space.
- [ ] Edits visible to all occupants in real time.
- [ ] No room geometry files written for invite-lobby ids after edits + persistence tick.
- [ ] Teleporter/gate placement rejected in Play Spaces.
- [ ] After Play Space teardown, template and source room layouts unchanged.
- [ ] Guest still cannot navigate to other rooms via join/catalog.

## Blocked by

- [100-play-space-template-bootstrap](./100-play-space-template-bootstrap.md)
