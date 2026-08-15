---
title: Other Player Menu and Freeze
status: ready-for-agent
glossary: CONTEXT.md
adrs:
  - docs/adr/0013-movement-watch-admin-side-channel.md
depends_on_grill: CONTEXT.md (Other Player Menu, Freeze, Admin Invisibility)
prior: .scratch/admin-measures/PRD.md (Admin Invisibility shipped; Freeze not started)
out_of_scope_followup: Player reports with movement playback (feature 3; grill later)
---

# Other Player Menu and Freeze

> Vocabulary follows [CONTEXT.md](../../CONTEXT.md): **Other Player Menu**, **Freeze**,
> **Admin Invisibility**, **Action Wheel**, **Player Menu**, **Challenge**.

## Problem Statement

Right-clicking another player dumps View Profile, Whisper, and Copy Wallet on one flat
panel. That leaf list cannot host admin tools (starting with Freeze) without becoming a
crowded power-user dump, and it mixes everyday social actions with rare moderation ones.
Operators also still lack Freeze: a brief, silent locomotion hitch to desync macros without
a toast or lasting sanction.

## Solution

Reshape the **Other Player Menu** into a nested drill-in (header + Back) that shows only
live actions today, and ship **Freeze** under More → Administrative for allowlisted admins.

Players open another avatar and see `{identicon} View {username}` (plus Accept 1v1 as a
second root row when that player has a Challenge up). View drills to View Profile, Whisper,
and More only when More has children. Admins drill More → Administrative → Freeze /
Unfreeze. Copy Wallet stays on the profile card only. Empty branches are omitted (no Future
Options stub).

Freeze clears the target's path, silently rejects further movement until Unfreeze or leave /
disconnect, shows a Frozen cue to admins only, and works while the actor is under Admin
Invisibility.

## User Stories

### Other Player Menu — root and nesting

1. As a player, I want right-click on another avatar to open the Other Player Menu (not the
   Action Wheel), so that peer actions stay separate from self actions.
2. As a touch player, I want long-press on another avatar to open the same Other Player Menu,
   so that desktop and touch share one path.
3. As a player, I want the root to show that player's identicon and **View {username}**, so
   that I know who I am acting on before drilling in.
4. As a player, when the target has a Challenge raised, I want a second root row to Accept
   1v1, so that matchmaking stays one click from the avatar.
5. As a player, when I choose View {username}, I want a drill-in panel with header Back, so
   that I can navigate nested actions without dismissing the whole menu.
6. As a player, I want Back in the header to return one level, so that nesting stays
   discoverable on small screens.
7. As a player, I want Esc or click-outside to dismiss the entire Other Player Menu from any
   level, so that I can exit quickly.
8. As a player, on the actions panel I want View Profile and Whisper when available, so that
   everyday peer actions stay reachable.
9. As a player, I do not want Copy Wallet on this menu, so that the menu stays short; I copy
   from the profile instead.
10. As a player, I want More to appear only when it has at least one child for me, so that I
    never open an empty More panel.
11. As a non-admin, I want no Administrative branch, so that moderation tools are not teased.
12. As a game admin, I want More → Administrative when Freeze (or later admin leaves) is
    available, so that ops tools live one consistent nest deep.
13. As a game admin, I want Administrative to drill to Freeze / Unfreeze (label reflecting
    current Frozen state), so that I can apply or clear the lock quickly.
14. As a game admin viewing another allowlisted admin, I want Freeze shown disabled rather
    than hidden, so that I understand the tool exists but cannot target ops peers.
15. As a player, I want empty Future Options omitted entirely until a real leaf ships, so that
    the menu only shows what works today.
16. As a player stacking on a crowded tile, I want the existing multi-player picker to still
    choose a target before the nested menu, so that dense rooms stay usable.
17. As a guest or wallet player, I want the same Other Player Menu structure when I am the
    viewer (without admin branches), so that guests are not a second UX.
18. As a player opening my own avatar, I want the Action Wheel unchanged, so that this work
    does not disturb self interaction.

### Freeze — apply, clear, and cues

19. As a game admin, I want to Freeze another non-admin player from Administrative, so that I
    can briefly desync a suspected macro without leaving cover under Admin Invisibility.
20. As a game admin, I want Unfreeze on a Frozen target from the same place, so that release
    is as fast as apply.
21. As a game admin, when I Freeze a moving player, I want their authoritative path cleared
    and their avatar stopped on the current tile immediately, so that macros lose sync.
22. As a Frozen player, I want further movement intents to do nothing with no toast, error
    UI, or sanction cue, so that the hitch does not advertise an admin tool.
23. As a Frozen player, I still want chat, emotes, mining, and build, so that Freeze stays a
    locomotion lock only.
24. As a Frozen player, after Unfreeze I want to move again from my current tile with no
    catch-up of queued paths, so that the lock does not store a backlog.
25. As a game admin, I want Freeze to clear if the target leaves the room or disconnects, so
    that the hitch never becomes a sticky cross-session sanction.
26. As a game admin, I must not be able to Freeze myself (this menu is other-player only), so
    that I cannot soft-lock my own session.
27. As a game admin, I must not successfully Freeze another allowlisted admin, so that ops do
    not foot-gun each other.
28. As a game admin, I want to Freeze guests and wallet players alike when they are in the
    room, so that botting is not limited to signed-in wallets.
29. As a game admin, I want a small Frozen tag or icon on Frozen targets, so that I know who
    is locked.
30. As a non-admin, I must not see a Frozen badge on anyone, so that the cue stays ops-only.
31. As a non-admin, I must not see or invoke Freeze, so that the tool stays ops-only.
32. As a game admin under Admin Invisibility, I want Freeze / Unfreeze to work without
    toggling visible, so that silent observation and desync combine.
33. As an operator, I want Freeze / Unfreeze recorded in server logs only, so that incidents
    can be grepped without Telegram noise or player dossier history.
34. As a player, I do not want Telegram or public notices when someone is Frozen, so that
    the tool stays quiet.

## Implementation Decisions

- Vocabulary lives in **CONTEXT.md** (**Other Player Menu**, **Freeze**, **Admin
  Invisibility**). Respect ADR **0013** — do not fold Freeze or menu nesting into Movement
  Watch payloads.
- **Two primary seams** (confirmed):
  1. **otherPlayerMenuModel** — pure client (or shared) helper: given viewer role, target
     identity/adminness, Challenge state, and whether the target is Frozen, return the
     visible root rows and drill panels (omit empty More / Administrative). UI is a thin
     renderer of that model with header Back and drill-in state.
  2. **adminFreeze** — pure server policy + room wiring: may freeze / is frozen; on apply
     clear path and halt locomotion velocity; silently ignore further movement intents;
     clear on Unfreeze, leave, or disconnect; expose an admin-only Frozen cue field on
     presence/state for admin viewers (parallel to Admin Invisibility cue filtering).
- Reshape the existing other-player HUD menu; do not invent a second other-avatar surface.
- Copy Wallet: remove from Other Player Menu; profile card remains the copy path.
- Accept 1v1: keep as conditional **second root row** (not buried under View).
- Nesting: More → Administrative → Freeze/Unfreeze (two drills), even when Administrative
  has a single live child today — matches the grilled outline and leaves room for more
  admin leaves.
- Frozen label on the leaf: **Freeze Player** / **Unfreeze Player** (or equivalent) from
  live Frozen state.
- Admin-on-admin: show Freeze disabled in the model; server still rejects if invoked.
- Persist nothing: Freeze is session/presence-scoped like the existing Freeze glossary — not
  moderation JSON, not timed auto-unlock.
- WS: admin-only Freeze / Unfreeze intent; target gets no error payload for rejected
  movement; admins receive cue via filtered state / stateDelta (same spirit as Invisible).
- Usable while actor is Admin Invisible: do not gate Freeze on observation-only mutation
  deny lists meant for world edits.
- Server log lines for freeze / unfreeze; no Telegram.

## Testing Decisions

### What makes a good test

Assert external behavior at the two seams: which menu rows/panels a viewer gets for a given
target, and whether a target may move while Frozen / may be Frozen. Do not assert Three.js
opacity constants, exact pixel layout, or toast absence via full DOM snapshots.

### Primary seams

| Behavior | Assertion |
|----------|-----------|
| Menu root | View {username}; Accept 1v1 only when Challenge open |
| Menu actions | View Profile + Whisper; Copy Wallet absent |
| More gating | omitted when no children for viewer |
| Administrative | present only for game-admin viewer; drills to Freeze/Unfreeze |
| Admin target | Freeze row disabled for allowlisted admin targets |
| Freeze apply | path cleared; subsequent move intents rejected until clear |
| Freeze deny | self N/A on this menu; other admins rejected server-side |
| Freeze clear | Unfreeze / leave / disconnect restores movement without backlog |
| Cue | admin viewers see Frozen; non-admins do not |
| Auth | non-admin cannot invoke Freeze |
| Invisible actor | Freeze still allowed while Admin Invisible |

Prior art: `adminPresence` tests; Movement Watch filter tests; path halt / moveAbort tests;
Other Player Menu HUD tests if present; world context / chat More nesting tests if present.

Prefer unit tests on the two helpers plus light wiring tests. Manual: two browsers (admin +
player) for menu nesting, Freeze hitch with no toast, Frozen tag for admins only, Accept 1v1
root row.

## Out of Scope

- Player report categories from the Other Player Menu
- Historical movement recording or `/admin` playback
- Future Options placeholders under More
- Timed auto-Unfreeze
- Durable Freeze in moderation store
- Telegram or dossier history for Freeze
- Freezing other allowlisted admins (disabled UI + server deny)
- Changing the Action Wheel or Player Menu
- Relocating Copy Wallet off the profile
- Re-grilling Admin Invisibility (shipped)

## Further Notes

- Admin Invisibility is already shipped; this PRD assumes its presence filter and
  observation-only gate remain, and only requires Freeze to stay callable while the actor
  is invisible.
- Prior Freeze brief at `.scratch/admin-measures/issues/02-freeze.md` should be superseded
  by issues split from this PRD (menu nesting is now explicit and Freeze attaches under
  Administrative).
- Invisible admins speaking in chat still break visual cover — accepted separately.
- Brief Freeze is an anti-macro desync tool, not Channel mute or Mining Restriction.
