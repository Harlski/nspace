---
title: World Cup — 1v1 Matches, Goalies, Spectating & Goal Rewards
status: ready-for-agent
glossary: worldcup/CONTEXT.md
adrs:
  - worldcup/adr/0001-ephemeral-match-pitches.md
  - worldcup/adr/0002-nim-rewards-free-play-only.md
---

# World Cup — 1v1 Matches, Goalies, Spectating & Goal Rewards

> Vocabulary in this PRD follows [worldcup/CONTEXT.md](./CONTEXT.md): **Free Play Field**,
> **Match**, **Match Pitch**, **Challenge**, **Goalie**, **Spectator**, **Golden Goal**,
> **Contested**, **Paid Goal**.

## Problem Statement

The seasonal soccer feature today is a single shared **Free Play Field** where anyone can
wander in and tap the ball into an undefended goal. Players have told us it feels
one-dimensional:

- There's no way to play a focused game against one specific person — it's always a
  free-for-all.
- Goals are trivial because nothing defends the net, so scoring carries no satisfaction.
- People who'd enjoy *watching* a good game have nothing to watch and no way to gather
  around a match.
- There's no tangible reward for the skill of scoring, only a leaderboard tally.

## Solution

Four additions, all inside the existing feature-flagged soccer feature:

1. **1v1 Matches.** A player raises an open **Challenge** above their head while hanging
   out in a social space. Anyone nearby can click/tap it to accept; both are whisked to a
   private **Match Pitch** for a timed 1v1 — just for fun, no rewards.
2. **Goalies.** Every goal — in the Free Play Field and in every Match Pitch — is guarded
   by a **Goalie** that makes scoring meaningfully harder.
3. **Spectating.** When a Match starts, a clickable "{identicon} vs {identicon}" portal
   appears in the room it was started from. Onlookers tap it to drop into the **stands**
   and watch.
4. **Goal rewards.** Scoring in the **Free Play Field** (only) queues a small NIM payout to
   the scorer, wrapped in anti-farming guards so it can't be abused.

## User Stories

### Challenge & matchmaking

1. As a player in a social room, I want to raise a Challenge that floats above my avatar, so that others know I'm looking for a 1v1.
2. As a player, I want to raise a Challenge from a HUD control, so that the interaction matches how I toggle other states.
3. As a player, I want to cancel my Challenge, so that I can stop looking for a Match without leaving the room.
4. As a player, I want my Challenge to clear automatically after a timeout, so that stale challenges don't linger.
5. As a nearby player, I want to click/tap another player's Challenge bubble to accept it, so that we start a Match together.
6. As a player, I want the first person to accept my Challenge to be my opponent (first-accept-wins), so that acceptance is unambiguous.
7. As a player whose Challenge was just accepted by someone else, I want my own Challenge to clear, so that I'm not double-booked.
8. As a player, I want to be unable to raise a Challenge inside the Free Play Field or a Match Pitch, so that the shared kickaround and live matches aren't disrupted.
9. As a player already in a Match, I want to be unable to raise or accept a Challenge, so that I can't be pulled into two games.
10. As a touch user, I want to tap a Challenge bubble as easily as a mouse user clicks it, so that mobile play is first-class.

### Playing a Match

11. As a challenger and accepter, I want to both be moved into a private Match Pitch when the Challenge is accepted, so that we play in isolation.
12. As a Match player, I want the pitch, goals, and ball to feel exactly like the Free Play Field, so that my skills transfer.
13. As a Match player, I want a visible match clock counting down from 3 minutes, so that I know how long is left.
14. As a Match player, I want a visible score for both sides, so that I know who's winning.
15. As a Match player, I want most goals at full time to win, so that the game has a clear result.
16. As a Match player in a tie at full time, I want a Golden Goal period where the next goal wins, so that ties usually get resolved.
17. As a Match player still tied after the 90s Golden Goal cap, I want the Match declared a Draw, so that the game always ends.
18. As a Match player, I want a clear end-of-match result shown (Win / Loss / Draw / Opponent left), so that I know the outcome.
19. As a Match player, I want to be returned to where I was before the Match a few seconds after it ends, so that I rejoin where I left off.
20. As a Match player whose opponent disconnects or leaves, I want to be declared the winner immediately ("Opponent left"), so that I'm not stuck waiting.
21. As a player, I want a Match to earn no NIM and not affect the daily leaderboard, so that 1v1s stay purely for fun.

### Goalies

22. As a player in the Free Play Field, I want each goal defended by a Goalie, so that scoring is a challenge.
23. As a Match player, I want each goal defended by a Goalie, so that 1v1s require real skill.
24. As a player, I want the Goalie to track the ball and try to stop shots, so that it behaves like a keeper.
25. As a player, I want the Goalie to be beatable (by aiming wide of it or shooting hard), so that scoring is hard but fair.
26. **(Revised — credit the attacker, not nobody.)** As a player, I want a goal that deflects off the Goalie into the net to credit the **last real (human) kicker** — not the keeper — so that a save the keeper fumbles still rewards the shooter. The server tracks `lastRealKickerAddress` separately from goalie touches and credits it on *any* goal (including goalie-deflected own-goals); this counts fully for the leaderboard **and** the Free Play Field NIM reward, still bounded by the daily cap / global budget / contested guards. Only a goal with **no** recent human touch (the keeper alone knocked it in) credits nobody. _This reverses the original "credit nobody" rule above; see [adr/0002](adr/0002-nim-rewards-free-play-only.md) and `docs/reasons/`._
27. As the operator, I want to switch the Goalie between two behaviour models via config, so that we can A/B which one feels best and remove the other.

### Spectating

28. As a player in the room a Match was started from, I want to see a "{identicon} vs {identicon}" portal appear, so that I know a Match is happening and who's in it.
29. As an onlooker, I want to click/tap the portal to be taken into the Match's stands, so that I can watch.
30. As a Spectator, I want to see the live ball, players, goalies, score, and clock, so that watching feels live.
31. As a Spectator, I want to be unable to touch or affect the ball, so that I don't interfere with the Match.
32. As a Spectator, I want to be placed in stands around the pitch, so that I'm clearly an audience member.
33. As an onlooker, I want the portal to show "full" once the Spectator soft-cap is reached, so that I understand why I can't join.
34. As a Spectator, I want to be returned to where I was when the Match ends, so that watching doesn't strand me.
35. As a player, I want the portal to disappear when the Match ends, so that I can't click into a dead Match.

### Goal rewards (Free Play Field only)

36. As a Free Play Field scorer, I want a small NIM payout (default 0.25 NIM) queued when I score, so that scoring is rewarding.
37. As a 1v1 player, I want Matches to never pay NIM, so that rewards can't be collusion-farmed in private.
38. As a scorer, I want my reward credited to the wallet that was the credited last-kicker of the goal, so that the right person is paid.
39. As the system, I want each Paid Goal to use a deterministic claim id, so that a goal is never paid twice even on retries.
40. As the operator, I want a per-wallet daily cap on Paid Goals (default 40/day), so that one wallet can't drain the treasury.
41. As the operator, I want a global daily budget for goal rewards (default 500 NIM/day), so that total spend is bounded.
42. As the system, I want to pay a goal only when it is Contested (≥2 distinct players in the field), so that solo/alt farming is blunted.
43. As a player past the daily cap or after the budget is exhausted, I want my goals to still count for the leaderboard but pay nothing, so that play is never blocked, only the payout stops.
44. As the operator, I want every reward threshold configurable via env, so that I can tune spend without a code change.
45. As an admin, I want goal-reward payouts to flow through the existing payout queue (retries, dead-letter, history), so that I monitor them like any other payout.

### Feature flag & lifecycle

46. As the operator, I want all of this behind the existing `WORLDCUP_ENABLED` flag, so that the whole feature can be turned off seasonally.
47. As a maintainer, I want all new code under `worldcup/`, `server/src/worldcup/`, `client/src/worldcup/`, so that the feature stays deletable in one go.

## Implementation Decisions

Respects [ADR 0001](./adr/0001-ephemeral-match-pitches.md) (ephemeral Match Pitches) and
[ADR 0002](./adr/0002-nim-rewards-free-play-only.md) (Free-Play-only rewards with layered
guards).

### Modules (new, under the worldcup tree)

- **`server/src/worldcup/goalReward.ts`** — pure `evaluateGoalReward(input) → decision`
  plus a small per-UTC-day store (per-wallet Paid Goal count + global budget spent),
  persisted to a deletable `worldcup-goal-rewards.json` and reset on UTC-day rollover
  (reuse `utcDayKey` from `scoreStore`). `rooms.ts` calls `evaluateGoalReward` from the
  Free Play Field `onGoal` hook and, when `pay` is true, calls the existing
  `enqueueNimPayout`.
- **`server/src/worldcup/match.ts`** — pure match state machine: a reducer
  `(state, event) → state` over events `goal | tick | playerLeft`, owning the 3-minute
  timer, Golden Goal (90s cap → Draw), score, and terminal outcome (Win/Draw/Opponent
  left). `rooms.ts` owns the I/O around it (room create/teardown, teleport, broadcast).
- **`server/src/worldcup/goalie.ts`** — pure Goalie behaviour: kicker-mode target along
  the goal line (move-speed/reach/reaction), and blocker-mode collision implemented as a
  branch inside the existing `ballPhysics` step. Selected at runtime by
  `WORLDCUP_GOALIE_MODE`.
- **Client (`client/src/worldcup/`)** — Challenge bubble + HUD toggle, the "vs" spectate
  portal marker, the Match HUD (score + clock + result), and Goalie rendering. Reuse the
  existing identicon textures for the portal label and the avatar-pick raycast for accepting
  a Challenge.

### Reused seams / interfaces

- **Challenge intent** mirrors the `nimSendIntent` pattern: a per-connection boolean on the
  server, surfaced as a flag on the broadcast player state, rendered as a clickable bubble.
- **Match Pitch** is created via the existing on-demand room path (the same mechanism
  `teleportPlayer` uses), reusing the Free Play Field bounds and goal zones; balls run
  through the existing `tickRoomBalls({ goals, onGoal })` hook **without** a reward path.
- **Goalies** are injected as extra entries in the `players` list handed to `tickRoomBalls`
  in kicker mode (so the existing proximity-kick clears the ball), and as a collision branch
  in `stepBall` in blocker mode. A sentinel address marks Goalie touches so they never
  become the credited last-kicker.
- **Spectators** are present in the Match Pitch room but excluded from the `players` list
  passed to `tickRoomBalls`, so they cannot kick.
- **Goal attribution** reuses the existing credited-last-kicker rule and window from the
  ball tick.

### Wire protocol (new message types, worldcup-tagged)

- Client→server: set/clear Challenge; accept Challenge (by target address); request
  spectate (by match id); leave Match.
- Server→client: Challenge flag on player state; spawn/remove the spectate portal marker
  (room-scoped); Match state (score, remaining time, phase: regulation/golden/ended);
  Match-ended result; Goalie positions (lightweight per-room broadcast alongside the
  existing ball-state stream).

### Identity & persistence

- `claimId` for a Paid Goal is deterministic: `wc-goal-{wallet}-{utcDay}-{dailyIndex}`,
  where `dailyIndex` is the wallet's Paid-Goal ordinal that UTC day. This is idempotent and
  makes the daily cap fall out of the same counter.
- Match Pitches are **never persisted** to world state; in-flight Matches are dropped on a
  server restart.
- Each entrant (player and Spectator) has their origin room + position snapshotted on entry
  so they can be returned on Match end.

### Configuration (env, all with sensible defaults)

- `WORLDCUP_GOALIE_MODE` = `kicker` | `blocker` (A/B; remove loser after the feel-test)
- `WORLDCUP_GOAL_REWARD_LUNA` (default `25000` = 0.25 NIM)
- `WORLDCUP_GOAL_REWARD_DAILY_CAP_PER_WALLET` (default `40`)
- `WORLDCUP_GOAL_REWARD_DAILY_BUDGET_NIM` (default `500`)
- `WORLDCUP_GOAL_REWARD_MIN_PLAYERS` (default `2`)
- `WORLDCUP_MATCH_DURATION_MS` (default `180000`)
- `WORLDCUP_MATCH_GOLDEN_GOAL_CAP_MS` (default `90000`)
- `WORLDCUP_MATCH_SPECTATOR_CAP` (default `20`)
- `WORLDCUP_CHALLENGE_TIMEOUT_MS` (auto-clear a stale Challenge)
- Goalie tuning constants (move-speed, reach, reaction) in `worldcup` config.

## Testing Decisions

A good test here asserts **external behaviour of a pure function**, not internal wiring: it
feeds inputs and checks the decision/next-state, with no sockets, rooms, timers, or disk.
The prior art is the existing per-module unit suites — `server/test/worldcup-ballPhysics.test.ts`
and `server/test/worldcup-scoreStore.test.ts` — run via `npm test -w server`. New suites
follow the same shape.

- **`goalReward`** — table-driven tests over `evaluateGoalReward`: under cap & contested →
  pays with the expected `claimId` and amount; at/over the per-wallet cap → no pay; budget
  exhausted → no pay; fewer than the minimum players → no pay; idempotent `claimId` across
  the same goal; UTC-day rollover resets the counters.
- **`match`** — drive the reducer through event sequences: regulation goals update score;
  the timer expiring with a lead ends as Win; expiring tied enters Golden Goal; a goal in
  Golden Goal ends it; the Golden Goal cap with no goal ends as Draw; `playerLeft` at any
  phase ends as Opponent-left win.
- **`goalie`** — kicker-mode: the Goalie's computed target tracks the ball laterally,
  bounded by goal-line limits and max move-speed; reaction lag delays response. Blocker-mode
  collision is asserted by **extending the existing `ballPhysics` suite** (a shot on target
  is repelled; a shot wide of the keeper passes) rather than adding a new harness.

The `rooms.ts` integration (Challenge broadcast/accept, ephemeral room lifecycle, spectate
portal, stands placement, return-on-end) is verified at the **manual in-game milestone
checkpoints**, consistent with how the existing worldcup wiring is validated. Gates between
issues: `npm run build` and `npm test -w server`.

## Out of Scope

- Rewards, ranking, ELO, or leaderboard credit for 1v1 Matches.
- A matchmaking queue, directed/named challenges, or rematch button (open Challenge only).
- Tournaments, brackets, or scheduled events.
- Persisting or resuming Matches across a server restart.
- Spectator chat moderation beyond existing chat behaviour; betting/wagering on Matches.
- Goalie skill that adapts to player rank; multiple balls in a Match Pitch.
- Reconnect grace period mid-Match (a leave ends the Match).

## Further Notes

- When goal rewards ship, paying NIM for gameplay goals is a notable economic decision:
  add a `docs/THE-LARGER-SYSTEM.md` note plus a `docs/reasons/reason_*.md` rationale, per
  the repo handbook.
- The reward wallet must stay funded; the existing dead-letter/retry/history machinery and
  admin/operator payout surfaces apply unchanged to this new payout source.
- Capture audience-facing copy under `patchnote/versions/UNRELEASED/public/*` during the
  build (CFD), and update `docs/features-checklist.md` when behaviour becomes user-visible.
- Deprecation remains a single-folder delete (`worldcup/`, `server/src/worldcup/`,
  `client/src/worldcup/`) plus removal of the `worldcup`-tagged hook lines, per the backlog
  README.
