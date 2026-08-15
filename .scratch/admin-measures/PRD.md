---
title: Admin Invisibility and Freeze
status: ready-for-agent
glossary: CONTEXT.md
adrs:
  - docs/adr/0013-movement-watch-admin-side-channel.md
depends_on_grill: CONTEXT.md (Admin Invisibility, Freeze, Movement Watch)
out_of_scope_followup: Player reports with movement playback (feature 3; grill later)
---

# Admin Invisibility and Freeze

> Vocabulary follows [CONTEXT.md](../../CONTEXT.md): **Admin Invisibility**, **Freeze**,
> **Movement Watch**, **Channel mute**, **Mining Restriction**.

## Problem Statement

Operators need to watch suspected bots and briefly disrupt macro click-paths without
announcing themselves to the room. Today, joining a room always broadcasts presence and
movement; there is no way for an admin to observe silently, and no short-lived locomotion
lock that feels like a hitch to the target rather than a visible sanction.

## Solution

Ship two independently usable admin tools:

1. **Admin Invisibility** — a session-scoped self-toggle (admin overlay) that omits the
   admin from non-admin room presence while other game admins still see a translucent
   Invisible cue. Chat stays in the shared log; speech bubbles and world mutations are off
   while invisible.
2. **Freeze** — an admin-imposed, presence-scoped locomotion lock on another player (right-
   click → More → Freeze / Unfreeze). Clears their path immediately; further movement
   intents fail silently so macros desync. No toast or cue for the target; admins see a
   Frozen tag. Usable while the acting admin is invisible.

Player report categories and historical movement playback are explicitly deferred.

## User Stories

### Admin Invisibility — toggle and session

1. As a game admin, I want to toggle Admin Invisibility from the admin overlay, so that I
   can enter observation mode without hunting through player menus.
2. As a game admin, I want Admin Invisibility to stay on across room changes in the same
   session, so that I can enter the next room already hidden with no join announce.
3. As a game admin, I want Admin Invisibility to survive short reconnect resume, so that a
   blip does not expose me.
4. As a game admin, I want Admin Invisibility to clear on logout or a new auth session, so
   that I do not stay cloaked by accident after a full re-login.
5. As a game admin, I want an explicit toggle-off, so that I can reappear when I choose.
6. As a non-admin, I must not be able to enable Admin Invisibility, so that the tool stays
   ops-only.

### Admin Invisibility — presence for players

7. As a player, when an invisible admin joins my room, I want no join announce and no
   avatar, so that I do not know they arrived.
8. As a player, when an admin toggles invisible while already in the room, I want them to
   vanish with no leave announce, so that the hide stays quiet.
9. As a player, when an admin toggles visible again mid-room, I want them to appear with no
   join announce, so that reveal is also quiet.
10. As a player, I want no movement updates from an invisible admin, so that they leave no
    path or pose trail.
11. As a player, I want no speech bubble when an invisible admin chats, so that their voice
    is not spatially attributed.
12. As a player, I still want invisible admins' room chat lines in the shared chat log with
    their normal name, so that when they speak on purpose it is readable like any other
    message.
13. As a player, I want room occupancy / presence lists to omit invisible admins, so that
    counts and rosters match what I can see.

### Admin Invisibility — presence for other admins and stream

14. As a game admin in the same room as an invisible admin, I want to still see their
    avatar and movement, so that ops do not collide blindly.
15. As a game admin viewing an invisible peer, I want a translucent avatar and a small
    Invisible nameplate tag, so that the cloaked state is unmistakable.
16. As a stream cinema observer who is not a game admin, I want invisible admins omitted
    from the broadcast view, so that public streams do not leak cloaked ops.
17. As a connection that is both stream observer and game admin, I want admin sight of
    invisible peers, so that dual-role ops are not blind.

### Admin Invisibility — observation-only

18. As an invisible admin, I want world-mutating actions (build, mine, gates, edits,
    teleporter placement, and similar) blocked, so that I do not leave a visible footprint.
19. As an invisible admin, I still want to walk for my own camera and pathing, so that I can
    patrol the room.
20. As an invisible admin, I still want to send room chat (log only, no bubble), so that I
    can intervene verbally without becoming visible.
21. As an invisible admin, I want Freeze to remain available, so that I can desync a macro
    without dropping cover.

### Freeze — apply and clear

22. As a game admin, I want right-click (or long-press) another player → More → Freeze, so
    that I can lock locomotion from the avatar context menu.
23. As a game admin, I want the same menu to show Unfreeze when the target is already
    Frozen, so that I can release them quickly.
24. As a game admin, when I Freeze a moving player, I want their authoritative path cleared
    immediately and their avatar stopped on the current tile, so that macros lose sync.
25. As a game admin, I want Freeze to last until I (or another admin) Unfreeze, or until the
    target leaves the room or disconnects, so that a brief hitch does not become a sticky
    ban.
26. As a game admin under Admin Invisibility, I want to Freeze and Unfreeze targets without
    toggling visible, so that silent observation and desync combine.
27. As a game admin, I want a small Frozen tag or icon above a Frozen target, so that I know
    who is locked.
28. As a non-admin, I must not be able to Freeze anyone, so that the tool stays ops-only.

### Freeze — target experience and limits

29. As a Frozen player, I want movement clicks to feel briefly unresponsive with no toast,
    error code UI, or other sanction cue, so that I do not learn an admin tool was applied.
30. As a Frozen player, I still want chat, emotes, mining, and build to work, so that Freeze
    stays a locomotion lock only.
31. As a Frozen player, after Unfreeze I want movement to work again from my current tile
    with no catch-up dash of queued paths, so that the lock does not store a backlog.
32. As a game admin, I must not be able to Freeze myself, so that I cannot soft-lock my own
    session by mistake.
33. As a game admin, I must not be able to Freeze another allowlisted admin, so that ops do
    not foot-gun each other.
34. As a game admin, I want to Freeze guests and wallet players alike when they are in the
    room, so that botting is not limited to signed-in wallets.

### Logging and non-goals for v1

35. As an operator, I want Freeze and Admin Invisibility toggles recorded in server logs
    only, so that incidents can be grepped without Telegram noise or player dossier history.
36. As a player, I do not want Telegram or public notices when someone is Frozen or an admin
    goes invisible, so that brief ops tools stay quiet.

## Implementation Decisions

- Vocabulary and product rules live in **CONTEXT.md** (**Admin Invisibility**, **Freeze**).
  Respect ADR **0013** for Movement Watch as a separate admin side channel — do not fold
  invisibility or Freeze into Movement Watch payloads.
- **Two primary seams** (confirmed):
  1. **Admin presence filter** — session flag on the admin connection; one viewer-aware
     filter for welcome others, join/leave, state / stateDelta, moveOrder / moveAbort.
     Non-admins and pure stream observers omit invisible admins; game admins include them
     with an invisibility cue field for client render.
  2. **Session locomotion lock** — admin-only Freeze / Unfreeze intent; clear path on
     apply; silently ignore further movement intents until clear; clear on leave /
     disconnect / Unfreeze.
- Prefer small pure server helpers for “who sees whom” and “may freeze / is frozen” over
  scattering policy through the room tick.
- Toggle Admin Invisibility from the admin overlay (same class of control as Movement
  Watch). Persist preference for the connection/session only — not durable moderation
  store.
- Chat: keep room-wide chat delivery; suppress speech bubble for invisible senders (add an
  explicit bubble-suppress signal or equivalent; do not reuse `bubbleOnly` inverted poorly).
- Observation-only while invisible: share or mirror stream-observer style early-returns for
  world mutations; still allow self movement and chat.
- Freeze UI: other-player context menu More submenu (avatar menu today lacks More; chat
  lines already have nested More — reuse that pattern). Not the profile HTTP moderation
  Actions dropdown (wrong lifetime and UX).
- Freeze is not timed auto-unlock in v1; not stored in moderation JSON; not announced to the
  target.
- Admin cues: translucent + Invisible tag for cloaked peers; Frozen tag/icon for locked
  targets — admin clients only.
- Server log lines for toggle / freeze / unfreeze; no Telegram; no analytics dossier in v1.

## Testing Decisions

### What makes a good test

Assert external behavior at the pure presence-filter and freeze-policy seams: who is
included in a viewer’s player snapshot, who receives join/leave/move fan-out, whether a
target may move while Frozen, and that admins cannot be Frozen. Do not assert Three.js
translucency constants, tag CSS, or toast absence via DOM.

### Primary seams

| Behavior | Assertion |
|----------|-----------|
| Presence filter | non-admin / stream observer omit invisible admin; game admin includes with cue |
| Mid-room toggle | non-admin recipients get remove without leave announce semantics as specified |
| Chat bubble suppress | invisible sender’s chat is log-visible / bubble-suppressed per contract |
| Observation-only | mutation intents denied while invisible |
| Freeze apply | path cleared; subsequent move intents rejected until Unfreeze |
| Freeze deny | self and other admins rejected |
| Freeze clear | leave / disconnect / Unfreeze restores movement |
| Auth | non-admin cannot toggle invisibility or Freeze |

Prior art: Movement Watch recipient/filter tests; moveAbort / path-clear tests; kickoff
locomotion lock style; world context menu submenu tests if present.

Avoid full WebSocket room harness in CI unless one already exists; prefer unit tests on the
two helper modules plus light wiring tests. Manual: two browsers (admin + player) for
vanish/appear, chat bubble vs log, Freeze hitch with no toast, admin cues.

## Out of Scope

- Player report categories (botting / swearing / etc.) from avatar right-click
- Historical movement recording or WebGL `/admin` playback (2x/4x/8x)
- Extending Movement Watch into a retention/playback system
- Timed auto-Unfreeze
- Durable Freeze in moderation store
- Telegram or player-dossier history for these tools
- Freezing other allowlisted admins
- World mutations while invisible
- Public Frozen / Invisible badges for non-admin players
- Making invisible admin chat anonymous or admin-only

## Further Notes

- Ship Admin Invisibility and Freeze as separately demoable slices; feature 3 (reports +
  playback) gets its own grill later and can reuse Movement Watch ideas without blocking
  this PRD.
- Invisible admins speaking in chat intentionally break visual cover — that is accepted.
- Brief Freeze is an anti-macro desync tool, not a substitute for Channel mute or Mining
  Restriction.
