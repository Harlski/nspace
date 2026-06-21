# Payout Service — issue slices

Vertical-slice (tracer-bullet) breakdown of [../payout-service.md](../payout-service.md).
Realizes [ADR-0002](../../adr/0002-payouts-in-dedicated-sidecar-service.md). Vocabulary: `CONTEXT.md` → Payouts.

Implement each in a fresh context, in dependency order:

| # | Slice | Blocked by |
|---|-------|-----------|
| 0 | [Prefactor — in-process payout gateway](0-prefactor-payout-gateway.md) | none |
| 1 | [Tracer bullet — one reward end-to-end via the Payout Service](1-tracer-bullet-one-reward-end-to-end.md) | 0 |
| 2 | [Balance — cached pull + claim gating](2-balance-cached-pull-and-claim-gating.md) | 1 |
| 3 | [Reliability — retries, dead-letter, durability](3-reliability-retries-dead-letter-durability.md) | 1 |
| 4 | [Remaining reward triggers onto the outbox](4-remaining-reward-triggers.md) | 1 |
| 5 | [Admin & reporting proxied](5-admin-and-reporting-proxied.md) | 1 (best after 2) |
| 6 | [Production cutover](6-production-cutover.md) | 1, 2, 3, 4, 5 |

> Stubs only — not published to a tracker. Run `/review-security` on the implementation diff before slice 6 (cutover).
