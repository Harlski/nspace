# NIM rewards for goals: Free Play Field only, with layered anti-farming

Scoring a goal in the **Free Play Field** queues a 0.25 NIM payout to the scorer (via the
existing `enqueueNimPayout` pipeline). Goals in 1v1 **Matches earn no NIM** — Matches are
just for fun. Payouts are wrapped in layered anti-farming guards.

## Why Free Play only

Matches are private and trivially collusion-friendly (two accounts trade goals), so paying
there is indefensible. The open field at least requires presence among strangers, which we
lean on for the "contested" guard.

## Guards (all env-configurable)

- **Deterministic claimId** `wc-goal-{wallet}-{utcDay}-{dailyIndex}` — idempotent per goal,
  reuses the queue's dedupe, and makes the daily cap fall out naturally.
- **Per-wallet daily cap**: default 40 paid goals/day (≈ 10 NIM/day/wallet).
- **Global daily budget**: default 500 NIM/day; once exhausted goals still count for the
  leaderboard but pay nothing.
- **Contested requirement**: pay only when ≥2 distinct players are in the field at the
  moment of the goal.
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
