# Remaining reward triggers onto the outbox

## Parent

[PRD — Dedicated NIM Payout Service](../payout-service.md)

## What to build

Route the remaining three reward triggers — **World Cup Free-Play goal reward**, **maze first-place reward**, and **admin feedback reward** — through the gateway → Outbox → service path, so all four triggers pay exclusively via the service.

Preserve the targeted World Cup `goalRewardOutcome` feedback to the scorer (paid / daily cap / pool spent), which is decided at enqueue time and is unaffected by the asynchronous send.

## Acceptance criteria

- [ ] All four reward triggers pay exclusively via the Outbox → service path.
- [ ] World Cup scorer feedback (paid / daily cap / pool spent) is unchanged in content and timing.
- [ ] Maze first-place and admin feedback rewards are queued and sent through the service.
- [ ] Tests confirm each trigger enqueues a Pay-Intent via the gateway, and that goal-reward feedback is preserved.

## Blocked by

- [1 — Tracer bullet: one reward end-to-end via the Payout Service](1-tracer-bullet-one-reward-end-to-end.md)
