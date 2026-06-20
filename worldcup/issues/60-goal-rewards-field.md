---
id: "60-goal-rewards-field"
milestone: M6
depends_on: []
triage: ready-for-agent
status: todo
acceptance:
  - server/src/worldcup/goalReward.ts exposes pure evaluateGoalReward + a per-UTC-day store
  - a Contested Free Play Field goal queues a NIM payout via the existing enqueueNimPayout
  - per-wallet daily cap, global daily budget, and the >=2-players Contested rule are enforced
  - claimId is deterministic (wc-goal-{wallet}-{utcDay}-{dailyIndex}) and never double-pays
  - 1v1 Matches never pay (scope guard); env vars tune all thresholds
verify:
  - "npm test -w server (new worldcup-goalReward test)"
  - "npm run build"
  - "manual: score in the field with >=2 players present -> payout appears in the queue; over cap/budget -> goal counts, no payout"
---

# 60 — Goal rewards in the Free Play Field

## What to build

Reward scoring in the **Free Play Field** (only) with a small NIM payout to the credited
scorer, wrapped in layered anti-farming guards per
[ADR 0002](../adr/0002-nim-rewards-free-play-only.md).

When a goal is credited in the field, evaluate whether it is a **Paid Goal**: it must be
**Contested** (≥2 distinct players present), the scorer must be under their per-wallet daily
cap, and the global daily reward budget must not be exhausted. If all hold, queue a payout
(default 0.25 NIM) through the existing payout pipeline; otherwise the goal still counts for
the leaderboard but pays nothing. Each Paid Goal uses a deterministic claim id so a goal is
never paid twice, even across queue retries. **Matches never pay.**

All thresholds are env-configurable. The per-day counters reset on UTC-day rollover, reusing
the existing day-key helper.

## Acceptance criteria

- [ ] `evaluateGoalReward` is pure and unit-tested across: contested+under-cap (pays),
      at/over cap (no pay), budget exhausted (no pay), too few players (no pay), idempotent
      claim id, UTC-day reset.
- [ ] Paid Goals flow through the existing `enqueueNimPayout` queue (retries/dead-letter/
      history apply unchanged).
- [ ] Reward amount, per-wallet cap, global budget, and min-players are env-configurable
      with the documented defaults (25000 luna, 40, 500 NIM, 2).
- [ ] Goals beyond the cap/budget still count for the leaderboard.
- [ ] Goals in a Match Pitch never queue a payout.
- [ ] `npm run build` and `npm test -w server` pass.

## Blocked by

None - can start immediately.
