# NIM rewards for goals: Free Play Field only, with env-tunable guards

Scoring a goal in the **Free Play Field** queues a random NIM payout to the scorer (via the
existing `enqueueNimPayout` pipeline). Goals in 1v1 **Matches earn no NIM** — Matches are
just for fun. Payouts are wrapped in env-tunable guards.

## Why Free Play only

Matches are private and trivially collusion-friendly (two accounts trade goals), so paying
there is indefensible. The open field pays at full rate when **Contested** (≥2 distinct
players) and at half rate for a **Solo Goal** (one player).

## Guards (all env-configurable)

- **Deterministic claimId** `wc-goal-{wallet}-{utcDay}-{dailyIndex}` — idempotent per goal,
  reuses the queue's dedupe, and makes the daily cap fall out naturally when configured.
- **Per-wallet daily cap**: default **unlimited** (`WORLDCUP_GOAL_REWARD_DAILY_CAP_PER_WALLET=0`);
  set a positive value only as an emergency brake.
- **Global daily budget**: default **unlimited** (`WORLDCUP_GOAL_REWARD_DAILY_BUDGET_NIM=0`);
  set a positive NIM value only as an emergency brake. When exhausted, goals still count for
  the leaderboard but pay nothing.
- **Solo vs Contested rate**: ≥2 distinct players → full random draw; one player → **Solo
  Goal** pays `floor(amount / 2)` from the same draw.
- **Attribution**: the credited **last real (human) kicker** (a real wallet, within the
  existing attribution window) is paid. A goalie touch never overwrites this credit, so a
  goal that **deflects off the keeper** into the net — including an own-goal the keeper
  fumbles — still pays the attacker who last struck the ball. Only a goal with no recent
  human touch (the keeper alone knocked it in) pays nobody. _(Revised — supersedes the
  earlier "goalie deflections and own-goals pay nobody" rule; the server tracks
  `lastRealKickerAddress` distinct from the goalie sentinel. See PRD Story 26.)_

## Consequences

- Real treasury spend — the payout wallet must stay funded; the existing dead-letter/retry
  machinery applies.
- Paying NIM for gameplay goals is an economic decision worth reflecting in
  `docs/THE-LARGER-SYSTEM.md` (with a `docs/reasons/` rationale) when implemented.
