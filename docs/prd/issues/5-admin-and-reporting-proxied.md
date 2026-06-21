# Admin & reporting proxied

## Parent

[PRD — Dedicated NIM Payout Service](../payout-service.md)

## What to build

Make the game server's admin and reporting surfaces operate against the Payout Service.

Admin **"Payout in full"** for a recipient and the **payout history / public payout pages** proxy to the service. The **end-of-day stats report** queries the service's pending summary for the "pending in queue" and "total NIM (sent + pending)" figures, then triggers the flush **after** the report is sent — preserving the snapshot → report → flush ordering. Telegram and World-Cup recap composition stay in the game server, unchanged.

## Acceptance criteria

- [ ] Admin "Payout in full" settles a recipient via the service.
- [ ] Payout history / public pages render from service-sourced data.
- [ ] The daily-stats report shows pending and total (sent + pending) sourced from the service.
- [ ] The end-of-day flush runs after the stats snapshot/report, in the correct order.
- [ ] Telegram and World-Cup recap output are unchanged.
- [ ] Tests cover the pending-summary → report → flush ordering and the proxied admin bulk action.

## Blocked by

- [1 — Tracer bullet: one reward end-to-end via the Payout Service](1-tracer-bullet-one-reward-end-to-end.md)
- Recommended after [2 — Balance: cached pull + claim gating](2-balance-cached-pull-and-claim-gating.md)
