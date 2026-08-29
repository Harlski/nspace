---
title: Mosquito Tag
status: ready-for-agent
glossary: CONTEXT.md
adrs:
  - docs/adr/0018-mosquito-tag-in-room-not-worldcup.md
  - docs/adr/0019-one-mosquito-tag-per-room.md
  - docs/adr/0020-boost-pads-are-round-ephemeral.md
  - docs/adr/0021-tag-countdown-participants-walk.md
---

# Mosquito Tag

> Vocabulary follows [CONTEXT.md](../../CONTEXT.md): **Mosquito Tag**, **Tag Call**, **Caller**,
> **Join**, **Start**, **Tag Countdown**, **Tag Round**, **Mosquito**, **Holder**, **Stung**,
> **Participant**, **Participant Marker**, **Bystander**, **Boost Pad**, **Games Wheel**,
> **Challenge**, **Match**, **Attention Marker**.
> ADRs: [0018](../../docs/adr/0018-mosquito-tag-in-room-not-worldcup.md),
> [0019](../../docs/adr/0019-one-mosquito-tag-per-room.md),
> [0020](../../docs/adr/0020-boost-pads-are-round-ephemeral.md),
> [0021](../../docs/adr/0021-tag-countdown-participants-walk.md).

## Problem Statement

Players in a social room can raise a soccer **Challenge** that teleports two people onto a
private **Match Pitch**. There is no in-room mini-game that uses the crowd already standing
in the Hub, Commons, or a Play Space. Chasing each other in place, with Bystanders watching,
is a different sport from 1v1 soccer and should not steal soccer's words or rooms.

## Solution

Ship **Mosquito Tag** as its own in-room mini-game on the **Games Wheel** (mosquito emoji).
A **Caller** raises a **Tag Call** where they stand. Others **Join** and wait. The Caller
**Starts**. After a **Tag Countdown**, a random **Participant** is the **Holder** of the
**Mosquito**. Walking onto or beside another Participant **passes** it. When the Tag Round
timer ends, the Holder is **Stung**. **Boost Pads** give the Holder a short speed burst.
Nobody teleports. Soccer **Challenge** / **Match** / **1v1 Wheel** stay unchanged.

## User Stories

### Games Wheel

1. As a player, I want Mosquito Tag listed on the Games Wheel as a mosquito emoji, so that I can find it next to Soccer.
2. As a player, I want Mosquito Tag absent from the 1v1 Wheel, so that 1v1 still means a true 1v1.
3. As a player, I want tapping the mosquito to raise a Tag Call in this room, so that I do not drill through This room / Invite.
4. As a Caller with an open Tag Call, I want the mosquito Sector to offer Start and Cancel, so that raising and starting are not the same tap.
5. As a nearby player, I want tapping the mosquito to Join (or Leave while waiting), so that I do not have to find the Caller's avatar.
6. As a player, I want Soccer to still hide when World Cup is off, while Mosquito Tag remains available, so that the Games Wheel is not a World Cup synonym.
7. As a Guest in a Play Space, I want to raise, Join, and play Mosquito Tag, so that invited friends can play without a wallet.

### Tag Call

8. As a player in a social room, I want to raise a Tag Call that floats above my avatar, so that others know I am gathering for Mosquito Tag.
9. As a nearby player, I want to click the Tag Call bubble to Join, so that joining matches how I accept a soccer Challenge.
10. As a nearby player, I want a Join Mosquito Tag row on the Other Player Menu when that player has a Tag Call, so that right-click / long-press also works.
11. As a Joiner, I want to wait in the same room until the Caller Starts, so that we can collect more people.
12. As the Caller, I want to be in the party automatically, so that I do not Join myself.
13. As the Caller, I want Start enabled only when at least one other player has Joined, so that a Tag Round is never a solo chase.
14. As the Caller, I want to Cancel the Tag Call, so that waiting Joiners are dropped without starting.
15. As a Joiner still waiting, I want to Leave the Tag Call, so that I can walk away before Start.
16. As a player, I want at most one Tag Call or Tag Round per room, so that two Mosquitoes do not share one crowd.
17. As a player, I want a Tag Call to refuse a ninth Joiner (cap 8 including the Caller), so that Participant Markers stay readable.
18. As a player with an open soccer Challenge, I want to be unable to raise or Join a Tag Call, so that I am not double-booked.
19. As a player in a Tag Call, I want to be unable to raise a soccer Challenge, so that the two activities stay exclusive per player.
20. As a player in a Match Pitch, Free Play Field, Tutorial Room, Pixel, or Canvas, I want Mosquito Tag unavailable, so that those rooms keep their own sports.
21. As a Caller who leaves the room or disconnects before Start, I want the Tag Call to clear, so that a ghost gather does not linger.
22. As a Joiner who leaves the room before Start, I want to drop out of the Tag Call, so that Start cannot lock an absent player.
23. As an invisible admin, I want to be unable to raise or Join, so that a hidden player is not a Participant.
24. As a stream observer, I want Tag Call actions denied, so that cinema stays observation-only.

### Tag Round

25. As Participants, I want a 7 second Tag Countdown after Start with the rules on screen, so that we can still walk while we get ready.
26. As a Bystander, I want to keep walking during Tag Countdown, so that the Hub is not frozen for the whole room.
27. As a Participant, I want a random Holder chosen when the countdown hits zero, so that nobody can pre-stand on a chosen target.
28. As a Participant, I want a visible Mosquito emoji above the Holder, so that everyone knows who has it.
29. As a Participant, I want a Participant Marker above every Participant, so that I can spot my targets among Bystanders.
30. As a Bystander, I want to see the Mosquito and the chase, so that watching is free and in-room (no Spectate Portal).
31. As the Holder, I want walking onto or beside another Participant to pass the Mosquito, so that click-to-walk tag does not need exact tile overlap.
32. As a Bystander, I want to be unable to receive the Mosquito, so that only the party is in the game.
33. As a Holder who just passed, I want a short pass cooldown, so that two people on one tile do not bounce the Mosquito every tick.
34. As a previous Holder, I want a short immunity from receiving it back, so that ping-pong is not the whole game.
35. As the Holder, I want standing on a Boost Pad to grant a temporary walk-speed boost, so that I can catch someone on click-to-walk.
36. As anyone in the room, I want Boost Pads to glow on the floor for the Tag Round only, so that I can see the power-ups and they vanish after.
37. As the Holder, I want a used Boost Pad to cool down, so that I cannot camp one tile.
38. As the Holder, I want Boosts not to stack, so that speed stays 1.5×.
39. As a Participant, I want a 60 second Tag Round timer on my HUD, so that I know when the music stops.
40. As a Participant, I want the Holder at timer end to be Stung (the loser), so that the objective is not to be last holding the Mosquito.
40b. As the Stung player, I want a 30 second walk slow after the round, so that losing is felt in the room.
41. As a Participant who is not Stung, I want to survive that Tag Round, so that N-player games have one loser and many survivors.
42. As a Holder who leaves or disconnects during the Tag Round, I want the Mosquito reassigned at random among those remaining, so that the Round continues.
43. As a Participant who leaves during the Tag Round, I want to become a Bystander, so that I can quit without ending the room's gather for everyone else.
44. As the last remaining Participant, I want to win if everyone else left, so that the Round always ends.
45. As a player arriving after Start, I want to be unable to Join this Tag Round, so that the party is locked.
46. As a player in the room after the Tag Round, I want a short result (who was Stung) then a clear floor, so that Boost Pads and markers do not linger.
47. As a Bystander, I want not to be frozen or teleported when the Tag Round ends, so that the social room stays a social room.

### Fairness and feel

48. As a player, I want movement to stay click-to-walk Path Playback, so that Hub obstacles are not given soccer free-move.
49. As a player, I want no NIM and no leaderboard from Mosquito Tag, so that it stays just for fun like a soccer Match.
50. As an operator, I want a dedicated kill switch that does not share WORLDCUP_ENABLED, so that I can disable Tag without hiding Soccer.

## Implementation Decisions

- **Module:** a pure `reduceTag(state, event, cfg)` engine (idle / calling / countdown / playing / result). `rooms.ts` is a thin adapter: WebSocket intents, tick poses, walkable tiles for Boost Pads, Holder speed and Stung slow on Path Playback, broadcast a room-scoped `mosquitoTag` snapshot (also on `welcome`). Participants walk during Tag Countdown.
- **Not World Cup:** code lives under `mosquitoTag/`, gated by `MOSQUITO_TAG_ENABLED` / `VITE_MOSQUITO_TAG_ENABLED` (default on). Games Wheel appears if Soccer or Mosquito Tag is on; Soccer leaves still hide when World Cup is off.
- **Wire:** client sends `mosquitoTag` with `action`: `raise` | `cancel` | `join` | `leave` | `start`. Server broadcasts `mosquitoTag` snapshots. Tag Call bubble click and Other Player Menu Join send `join` (Caller address is on the snapshot, not a second accept message).
- **One per room:** the store is keyed by room id; a second raise is ignored while a Tag Call or Tag Round exists.
- **Pass:** Chebyshev distance ≤ 1 on snapped floor tiles; 1s cooldown after a pass; previous Holder immune 2s. Bystanders ignored.
- **Boost Pads:** engine picks up to 6 distinct walkable tiles from candidates the adapter supplies at countdown end; 3s boost at 1.5× `MOVE_SPEED`; 8s pad cooldown; no stacking. Speed change mid-walk restamps the in-flight `moveOrder` from the current pose so analytic Path Playback does not skip.
- **Exclusive with Challenge:** adapter refuses Tag intents when the player has `challengeOpen` / `matchId` / `pendingMatchId`, and refuses `setChallenge` when the player is in a Tag Call or Tag Round.
- **Result linger:** 5s `result` phase then idle; no teleport.
- **i18n:** new player-facing copy uses Message Catalog `en` keys in the same change.

## Testing Decisions

Good tests assert observable Tag rules through `reduceTag` (and small pure helpers), not `rooms.ts` sockets or Three.js.

**Seams (only these):**

1. **`reduceTag`** — Tag Call, Start, countdown, pass, immunity, Boost Pads, Stung, leave/reassign, last-Participant win. Prior art: `reduceMatch` / `server/test/worldcup-match.test.ts`.
2. **`mosquitoTagAllowedInRoom`** — which rooms may host a Tag Call. Prior art: room-id helpers tested beside World Cup / tutorial policy.
3. **`buildOtherPlayerMenuModel`** — Join Mosquito Tag row when the target has a Tag Call. Prior art: `otherPlayerMenuModel.test.ts`.

Do not add tests that mock `rooms.ts` internals, assert Boost Pad mesh construction, or recompute expected pass distance the way the engine does.

## Out of Scope

- Invite / Play Space leaf, Spectate Portal, NIM, elimination rounds, hold-too-long fuse, shrinking area, moving or trap pads, participant-only free-move, putting Mosquito Tag on the 1v1 Wheel, generalizing Challenge into a multi-game lobby.

## Further Notes

Click-to-walk makes chase clumsier than soccer; Boost Pads and a 1-tile pass radius exist so v1 is playable without violating the pitch-only free-move rule.
