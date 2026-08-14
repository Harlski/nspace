---
id: "04-worldcraft-rooms-pack"
parent: .scratch/achievements-wave/PRD.md
triage: done
status: done
depends_on:
  - "03-level-ladder-reward-catalog"
---

# 04 — Worldcraft rooms pack

## Parent

[`.scratch/achievements-wave/PRD.md`](../PRD.md)

**What to build:** Worldcraft rows **Open House** (first public owned room, Simple Frame
`ach-*` nameplate), **Room to Room** (Teleporter Set from a room you own to a different
room you own, Dark Sharp `ach-*` chat bubble), **Two Keys** (two persisted owned rooms),
**Extra Hands** (add another wallet as builder), **Company** and **Housewarming** (1 and 3
unique other wallets entering a public room you own). Silent catch-up for reconstructable
state (public, two rooms, existing builder). Visitor ladder and Room to Room are live-only.

**Blocked by:** 03 — Level ladder + reward catalog

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Open House on first public persisted player room (create or toggle); not Play Space
      or official rooms.
- [ ] Room to Room on owned-to-owned Teleporter Set; not same-room pairs, Hub/Commons/The
      Shaper, or Play Spaces; one-way is enough.
- [ ] Two Keys at two non-deleted persisted owned rooms (not Play Space/official).
- [ ] Extra Hands on adding another wallet to builder ACL (not after they place a block).
- [ ] Company / Housewarming share one unique-visitor counter; owner, Guests, repeats, and
      private rooms do not count.
- [ ] Open House / Room to Room grant the assigned `ach-*` SKUs; silent catch-up where
      reconstructable; no Event Log scan for visitors.
- [ ] Tests cover exclusions and the visitor ladder.

## Comments
- Implemented in achievements-wave /implement pass (2026-08-14).
