---
id: "01-admin-invisibility"
parent: .scratch/admin-measures/PRD.md
triage: done
status: done
depends_on: []
---

# 01 — Admin Invisibility

## Parent

[`.scratch/admin-measures/PRD.md`](../PRD.md)

## What to build

Ship **Admin Invisibility** end-to-end: a session-scoped, admin-only self-toggle (admin
overlay) that omits the admin from non-admin room presence while other game admins still
see them.

## Acceptance criteria

- [x] Allowlisted admin can toggle Admin Invisibility from the admin overlay; non-admins cannot.
- [x] While invisible, non-admin clients omit presence/movement; mid-room toggle is silent.
- [x] Other game admins see translucent + Invisible tag.
- [x] Pure stream observers omit invisible admins; game-admin stream keeps admin sight.
- [x] Chat log yes, speech bubble no (`suppressBubble`).
- [x] World-mutating intents denied while invisible; walk + chat work.
- [x] Survives room change / short resume; clears on logout or toggle-off.
- [x] Server log only; unit tests on `adminPresence` seam.
- [ ] Manual: two browsers (admin + player).

## Blocked by

None - can start immediately.

## Comments

Implemented 2026-08-03: `server/src/adminPresence.ts` + rooms presence filter, overlay
toggle, client cues / suppressBubble. Manual two-browser check still recommended.
