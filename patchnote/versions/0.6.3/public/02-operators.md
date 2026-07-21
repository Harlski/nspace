# Public patch notes — operators (`0.6.3`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

Payout service now guarantees a broadcast transaction is never re-sent, closing a duplicate-payout hole that triggered when confirmation polling failed transiently.

- New env vars on the `payout` service (both optional, sane defaults):
  - `NIM_PAYOUT_RECONCILE_INTERVAL_MS` (default `60000`) — how often broadcast-but-unconfirmed payouts are reconciled against the chain; `0` disables.
  - `NIM_PAYOUT_UNCONFIRMED_REVIEW_MS` (default `10800000`, 3h) — how long an unconfirmed payout may sit before it is escalated to manual review instead of being re-queued.
- New audit file in the payout data dir: `nim-payout-needs-review.jsonl` — broadcasts stuck unconfirmed past the review window; these need a human decision (never auto re-sent).
- New read-only reconciliation tool: `npm run reconcile` (inside the payout container) diffs the treasury's on-chain outgoing transactions against `nim-payout-sent.jsonl` to find payouts that were broadcast but never recorded.
- `NIM_PAYOUT_TX_TRACE` is **not** implemented in the current sidecar; setting it does nothing. See `docs/nim-payout-tracing.md`.
- No migration required. Existing pending queues load as-is; jobs caught mid-send resume safely.
