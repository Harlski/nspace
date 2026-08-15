---
id: "02-admin-freeze"
parent: .scratch/other-player-menu/PRD.md
triage: done
status: done
depends_on:
  - "01-nested-other-player-menu"
---

# 02 — Admin Freeze

## Parent

[`.scratch/other-player-menu/PRD.md`](../PRD.md)

## What to build

Ship **Freeze** end-to-end under More → Administrative, backed by a pure `adminFreeze`
server policy seam (may freeze / is frozen) plus room wiring.

Allowlisted admins see More → Administrative → Freeze Player / Unfreeze Player (label from
live Frozen state). Admin-on-admin: model shows Freeze disabled; server still rejects.
Apply clears the target's path and planar velocity, silently rejects further movement
intents (no toast / error payload), and leaves chat / emotes / mining / build available.
Clears on Unfreeze, leave, or disconnect — nothing persisted. Admin-only Frozen cue on
filtered presence/state (same spirit as Admin Invisibility); non-admins never see the badge
or invoke Freeze. Usable while the actor is Admin Invisible (do not gate on observation-only
world-edit deny). Server logs only; no Telegram. Respect ADR 0013 — do not fold into
Movement Watch payloads.

## Acceptance criteria

- [x] Game admin can Freeze / Unfreeze a non-admin target from Administrative.
- [x] Freeze apply clears path + velocity; further moves silently rejected until clear.
- [x] Unfreeze / leave / disconnect restores movement with no path backlog.
- [x] Cannot Freeze self (menu is other-player only) or another allowlisted admin.
- [x] Guests and wallet players are freezable when in the room.
- [x] Admin viewers see Frozen cue; non-admins do not.
- [x] Non-admin cannot invoke Freeze; Freeze works while actor is Admin Invisible.
- [x] Server log lines for freeze / unfreeze; no Telegram.
- [x] Unit tests on `adminFreeze` (+ light rooms / cue wiring); menu model covers Freeze leaf / disabled admin target.
- [ ] Manual: two browsers (admin + player).

## Blocked by

- [01-nested-other-player-menu](./01-nested-other-player-menu.md)

## Comments

Implemented 2026-08-08: `server/src/adminFreeze.ts`, rooms `adminFreeze` WS + path halt +
cue filter, client `sendAdminFreeze` + Frozen nameplate. Manual two-browser check still
recommended.
