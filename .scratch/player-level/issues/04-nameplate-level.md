---
id: "04-nameplate-level"
parent: .scratch/player-level/PRD.md
triage: done
status: done
depends_on:
  - "01-allowance-core-mining"
---

# 04 — Nameplate Level in rooms

**What to build:** Every wallet avatar shows **Player Level** next to the username under the character (including Level 1). Guests show no Level. Level is on room presence so first paint is correct without a separate HTTP fetch, and it updates when an unlock changes Level mid-session. Composes with existing admin Invisible nameplate cues.

**Blocked by:** 01 — Allowance core + mining gate (Level-from-AP).

**Status:** done

## Parent

[`.scratch/player-level/PRD.md`](../PRD.md)

## Acceptance criteria

- [x] Room wallet snapshots / joins / deltas carry Player Level (or equivalent derived from Achievement Points).
- [x] Nameplate text for wallets includes Level beside the display name; Level 1 is shown.
- [x] Guest nameplates omit Level.
- [x] When Achievement Points push a player to a new Level, peers in the room see the updated nameplate without reconnect.
- [x] Invisible composition for admin viewers still works with Level present.
- [x] Stream cinema / overhead declutter rules treat Level with the same visibility as the username label.
- [x] Pure label-formatter tests cover wallet, guest, and Invisible composition (no Three.js required).
