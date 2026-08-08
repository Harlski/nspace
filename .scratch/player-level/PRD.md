---
title: Player Level and Daily Earn Allowance
status: ready-for-agent
glossary: CONTEXT.md
adrs:
  - docs/adr/0014-player-level-daily-earn-allowance.md
  - docs/adr/0002-payouts-in-dedicated-sidecar-service.md
  - worldcup/adr/0002-nim-rewards-free-play-only.md
depends_on_grill: CONTEXT.md (Achievement Points, Player Level, Daily Earn Allowance)
---

# Player Level and Daily Earn Allowance

> Vocabulary follows [CONTEXT.md](../../CONTEXT.md): **Achievement Points**, **Player Level**,
> **Daily Earn Allowance**, **Achievement Unlock Banner**, **Achievements Window**, **Summary**,
> **Progress Overview**, **Pay-Intent**, **Priority Pay-Intent**, **Payout Service**.

## Problem Statement

Players can farm gameplay NIM (mining and Free Play goals) with little long-term investment,
while others who unlock achievements get no visible status beside their name and no larger
earn runway. There is no shared personal daily throttle tied to progression — only optional
per-activity emergency knobs — so discovery of achievements is not required to earn more NIM.

## Solution

Introduce **Player Level**, derived solely from lifetime **Achievement Points**, shown next
to the username under each wallet avatar. Player Level sets that wallet's **Daily Earn
Allowance**: how much gameplay NIM it may receive each UTC day. Low levels start stingy
(~10 NIM/day at Level 1) so players must unlock achievements to earn more. From Level 11
(1000+ Achievement Points) the Level-based ceiling is uncapped; Level keeps climbing for
status. Tutorial faucet and admin grants sit outside the allowance. Hitting the ceiling
partial-fills the current payout, then pays nothing further until the next UTC day (or until
a mid-day Level-up raises the same day's ceiling).

## User Stories

### Progression and Level derivation

1. As a signed-in player, I want my **Player Level** derived from my lifetime **Achievement
   Points**, so that unlocking achievements is the only way to climb.
2. As a signed-in player with 0 Achievement Points, I want to be Level 1, so that every
   wallet starts on the same first rung.
3. As a signed-in player, I want one Level per 100 Achievement Points (Level 2 at 100, Level
   3 at 200, … Level 10 at 900, Level 11 at 1000), so that the ladder is easy to understand.
4. As a signed-in player past 1000 Achievement Points, I want my Level to keep rising (Level
   12 at 1100, and so on), so that completionists still see status progress after the earn
   ceiling unlocks.
5. As a guest, I want no Player Level, so that Level stays tied to wallets that can earn NIM
   and achievements.
6. As a signed-in player who unlocks an achievement mid-session, I want my Level to update as
   soon as my Achievement Points change, so that the nameplate and allowance stay current.

### Nameplate (public status)

7. As a player in a room, I want every wallet avatar's **Player Level** shown next to their
   username under the character, so that Level is a social status signal.
8. As a Level 1 player, I still want my Level shown on the nameplate, so that the signal is
   consistent for everyone.
9. As a guest in a room, I want my nickname shown without a Level, so that guests are not
   given a fake progression number.
10. As a player viewing an admin who is Invisible (and I am also an admin), I want Level still
    to compose with the existing Invisible nameplate cue, so that admin observation labels
    stay readable.
11. As a player entering a room or seeing a `playerJoined` / state sync, I want other wallets'
    Levels present without a separate HTTP round-trip, so that nameplates are correct from
    first paint.

### Daily Earn Allowance — economics

12. As a Level 1 player, I want my Daily Earn Allowance to be 10 NIM per UTC day, so that early
    farming is tightly limited.
13. As a Level 2–10 player, I want my Daily Earn Allowance to follow the published step table
    (15, 20, 30, 40, 50, 65, 80, 90, 100 NIM/day), so that each Level meaningfully raises my
    earn runway.
14. As a Level 11+ player, I want no Level-based daily NIM ceiling, so that committed
    achievement hunters regain uncapped gameplay earning (aside from emergency env brakes).
15. As an operator, I want the L1–L10 NIM/day amounts to be an explicit tunable table (not a
    sacred formula), so that live economy retunes do not require reinventing Level math.
16. As a player, I want mining claims, Free Play goal rewards, maze first-place rewards, and
    any future gameplay NIM to share one Daily Earn Allowance counter, so that I cannot route
    around the throttle by switching activity.
17. As a tutorial learner, I want tutorial faucet NIM to pay even when my Daily Earn Allowance
    is exhausted, and not to consume that allowance, so that first-contact onboarding still
    works.
18. As an admin rewarding an integrated feedback ticket, I want that grant to pay and not
    consume Daily Earn Allowance, so that moderation rewards stay independent of grind caps.
19. As a Free Play scorer, I want existing World Cup per-wallet / global emergency env brakes
    to still apply on top of Daily Earn Allowance, so that ops retains a panic switch.
20. As a player who Levels up mid-day, I want my new (higher or uncapped) Daily Earn Allowance
    to apply immediately that same UTC day, with already-earned gameplay NIM still counting
    against the new ceiling, so that unlocking achievements feels rewarding right away.
21. As a player whose next payout would exceed remaining Daily Earn Allowance, I want a
    partial fill of whatever remains, so that I always receive the rest of today's allowance.
22. As a player who has exhausted Daily Earn Allowance for the UTC day, I want further
    gameplay earns to pay 0 NIM until the next UTC day (unless I Level into a higher
    ceiling), so that the throttle is hard after partial fill.
23. As a player, I want the UTC calendar day to define the Daily Earn Allowance reset, so that
    it matches other daily systems (login streak, goal-reward day keys, daily stats).

### Earn feedback (private)

24. As a miner whose claim is partial-filled or zeroed by Daily Earn Allowance, I want a
    private signal explaining that I hit today's allowance, so that I understand why I got
    less or no NIM.
25. As a Free Play scorer whose goal is partial-filled or unpaid because of Daily Earn
    Allowance, I want a private signal in the same spirit as today's goal-reward cap note, so
    that soccer feedback stays consistent.
26. As another player in the room, I must not see someone else's remaining Daily Earn
    Allowance or at-cap notices, so that treasury limits stay personal.

### Achievements Window / Summary

27. As a signed-in player opening the Achievements Window Summary, I want to see my Player
    Level, total Achievement Points, and progress toward the next Level, so that the ladder
    is visible where I already track achievements.
28. As a Level 11+ player on Summary, I still want to see progress toward the next vanity
    Level, so that the post-uncap climb remains legible.
29. As a signed-in player who unlocks an achievement, I want Summary (and nameplate Level)
    to reflect the new totals without requiring a full reconnect, so that unlocks feel live.

### Profile and identity

30. As a player viewing another wallet's public profile, I want to see their Player Level
    when identity is already shown, so that Level is part of public identity (not their
    remaining allowance).
31. As a player, I do not want my remaining Daily Earn Allowance shown on my public profile,
    so that others cannot stalk my earn headroom.

### Payout integrity and ops

32. As the game server, I want Daily Earn Allowance enforced before a gameplay Pay-Intent is
    enqueued, so that the Payout Service never becomes the eligibility authority.
33. As an operator, I want spent Daily Earn Allowance to be durable across game-server
    restarts within the UTC day, so that a bounce cannot reset farm limits.
34. As an operator reading analytics / Connect Notice "NIM earned today", I understand that
    reporting may still include excluded sources and on-chain timing, while the allowance
    store is the authoritative gate for gameplay commits.
35. As a player with Mining Restriction, I want that sanction to remain independent of Daily
    Earn Allowance, so that moderation and economy throttles do not collapse into one flag.

### Edge cases

36. As a player whose treasury / payout balance cannot cover a claim, I want existing empty-
    treasury behavior to remain, composed with Daily Earn Allowance (whichever binds first is
    defined in implementation decisions), so that I do not get confusing double messages.
37. As a player at an uncapped Level with World Cup emergency brakes enabled, I want those
    brakes alone to limit soccer pays that day, so that uncapped means "no Level ceiling,"
    not "ignore all guards."
38. As a new wallet that somehow already has Achievement Points on first join, I want Level
    and Allowance derived from that total immediately, so that there is no separate Level
    unlock ceremony.
39. As a client with stream cinema / overhead declutter rules, I want Level on the nameplate
    to follow the same visibility rules as the username label, so that cinema mode stays
    clean.

## Implementation Decisions

### Domain rules (normative; also ADR 0014)

- **Player Level** = `floor(lifetime Achievement Points / 100) + 1` for eligible wallets.
- Lifetime Achievement Points = existing sum of `points_awarded` for the wallet (no second
  ledger).
- **Daily Earn Allowance** NIM/day table (tunable; defaults):
  - L1: 10, L2: 15, L3: 20, L4: 30, L5: 40, L6: 50, L7: 65, L8: 80, L9: 90, L10: 100
  - L11+: uncapped (no Level-based ceiling)
- Day key: UTC `YYYY-MM-DD`.
- In-scope gameplay NIM: mining claims (non-tutorial), Free Play goal rewards, maze
  first-place rewards, and any new gameplay Pay-Intent path unless explicitly marked bypass.
- Out-of-allowance (bypass): tutorial faucet **Priority Pay-Intent**, admin feedback rewards.
- Partial fill: `payLuna = min(proposedLuna, max(0, ceilingLuna - spentLuna))`; record only
  what was committed.
- Mid-day Level-up: recompute ceiling from new Level; do not reset `spentLuna` for the day.
- World Cup env knobs remain emergency brakes evaluated in addition to Daily Earn Allowance.

### Module shape (prefer one game-server gate)

- Pure helpers: Level from points; ceiling luna from Level; apply partial-fill decision.
- Durable per-wallet UTC-day store of gameplay luna **committed** toward the allowance
  (new store; do not reuse goal-reward counters or analytics `nimEarned`).
- Single gameplay enqueue gate (conceptually `enqueueGameplayPayIntent`) that: resolves
  Level from current Achievement Points, loads day spent, applies partial fill, records
  spent, then enqueues via existing Pay-Intent outbox. Explicit bypass path for tutorial /
  admin.
- Call sites for mining finalize, Free Play goal queue, and maze first-place route through
  the gameplay gate; tutorial and admin keep bypass.
- Room presence: add Player Level (or enough Achievement Points to derive it) on wallet
  player snapshots / joins / deltas so clients can render nameplates without HTTP.
- On achievement unlock delivery, refresh the player's Level in room state for self and
  peers when the Level number changes.
- Nameplate: pure label formatter composing display name + Level (+ existing Invisible cue
  for admin viewers); guests omit Level.
- Achievements Summary: show Level, total Achievement Points, and points into the next Level
  (always 100-wide bands).
- Private feedback: Free Play may extend existing goal-reward outcome reasons; mining gets a
  parallel private outcome when allowance binds (do not leak to the room).
- Public profile: expose Player Level; do not expose remaining allowance.

### Composition with other limits

- Mining Restriction / banned-wallet mining hold: unchanged; evaluate before or beside
  allowance without double-paying.
- Empty / insufficient hot-wallet balance: existing behavior remains; prefer a single clear
  private reason when both could apply (document the precedence in code comments next to the
  gate).
- Payout Service idempotency by `claimId` unchanged; partial fills must still use stable
  claim ids that cannot be replayed for the unclamped remainder.

### Config

- Default L1–L10 table and uncapped threshold Level 11 are code defaults aligned with ADR
  0014; optional env overrides for the table are welcome if they stay operator-simple, but
  not required for v1 if a well-named constant table is enough.

## Testing Decisions

### What makes a good test

- Assert external behavior: given Achievement Points, day spent, and a proposed payout,
  what luna is paid, what is recorded, and whether bypass paths ignore the gate.
- Prefer pure decision functions and store commit helpers over brittle `rooms.ts` integration
  where a higher seam exists.
- Do not snapshot Three.js sprites; test nameplate string formatting as a pure function.
- Do not re-test Payout Service sidecar delivery; stop at "Pay-Intent enqueued with amount."

### Modules / seams to test

1. Pure Level / ceiling / partial-fill helpers (table cases, uncapped, zero remaining).
2. Day store + commit (rollover at UTC day, mid-day Level-up raises ceiling, no spent reset,
   durable reload).
3. Gameplay enqueue gate wiring (mining / goal / maze consume allowance; tutorial priority
   and admin feedback bypass) — extend existing payout-trigger style tests.
4. Achievement Points → Level using existing `totalPointsForWallet` prior art.
5. Achievements Summary view-model / panel data for Level and next-Level progress.
6. Nameplate label formatter (wallet with Level, guest without, Invisible composition).
7. Private at-cap / partial-fill feedback reasons for mining and Free Play.

### Prior art

- `server/test/worldcup-goalReward.test.ts` — pure eval + daily commit pattern.
- `server/test/payoutRewardTriggers.test.ts` — enqueue claimId / path coverage.
- `server/test/achievementStore.test.ts` — `totalPoints` aggregation.
- `client/src/achievements/panelData.test.ts` — Summary view-model tests.

## Out of Scope

- Redesigning Achievement Point values on existing definitions.
- Separate vanity Level vs earn tier systems.
- Playtime / XP / login-streak as Level inputs.
- Spending NIM or cosmetics to buy Level.
- Leaderboards ranked by Level (unless already implied by profile sort elsewhere — not in v1).
- Showing remaining Daily Earn Allowance on public profiles or other players' nameplates.
- Replacing World Cup emergency env knobs (they stay; they are not the primary personal
  throttle).
- Client-side-only enforcement (server is authority).
- Changing end-of-day payout flush, Pay-Intent outbox, or Payout Service ownership.
- Localization of new copy (follow existing i18n status of the surrounding surfaces).
- Admin tools to manually set Level or grant Achievement Points.
- Seasonal Level resets or battle-pass tracks.

## Further Notes

- Glossary terms live in [CONTEXT.md](../../CONTEXT.md); decision rationale in
  [docs/adr/0014-player-level-daily-earn-allowance.md](../../docs/adr/0014-player-level-daily-earn-allowance.md).
- Confirmed test seams: one pure gate + one durable day store/commit + reuse existing
  Achievement Points total + nameplate formatter / room Level field + Summary + private
  at-cap feedback; gameplay enqueues funnel through one allowance-aware gate with explicit
  tutorial/admin bypass.
- Strawman L1–L10 NIM/day table is intentionally tunable after launch without changing the
  100 AP per Level rule or the Level 11 uncapped graduation.
- Next step on the main flow: `/to-tickets` to split tracer-bullet implementation issues
  under `.scratch/player-level/issues/`.
