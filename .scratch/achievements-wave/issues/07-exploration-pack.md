---
id: "07-exploration-pack"
parent: .scratch/achievements-wave/PRD.md
triage: done
status: done
depends_on: []
---

# 07 — Exploration pack

## Parent

[`.scratch/achievements-wave/PRD.md`](../PRD.md)

**What to build:** **Knock Knock** (enter a public player-owned room that is not yours) and
**Toll Crossed** (Unlock Pad Grant whose room is not the Tutorial Room, including not
Tutorial Sandbox). Live-only. If no non-tutorial pads exist, Toll Crossed stays ordinary
incomplete Exploration (not Temporarily unavailable). Explorer (any other room) and First
NIM stay as they are.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Knock Knock Completes on entering another player's public persisted room; not
      builtins, not your own, not private, not Play Space.
- [ ] Toll Crossed Completes on an Unlock Pad Grant outside the Tutorial Room.
- [ ] Tutorial Path Pay Ack and Tutorial Sandbox grants do not Complete Toll Crossed.
- [ ] Zero pads in the world does not mark Toll Crossed Temporarily unavailable.
- [ ] No Event Log catch-up; live Banner as usual.
- [ ] Tests cover room eligibility and Tutorial Room exclusion.

## Comments
- Implemented in achievements-wave /implement pass (2026-08-14).
