# Nimiq payout: reliability and tracing

How on-chain payout sends behave in the **Payout Service** sidecar, what they log, and how to investigate duplicates or stuck payouts. The game server no longer runs the Nimiq light client for payouts ([ADR-0002](adr/0002-payouts-in-dedicated-sidecar-service.md), [payout-cutover-runbook.md](payout-cutover-runbook.md)).

For historical mutex/balance-cache incident notes, see **`docs/toremove/LEARNEDLESSONS.md`** locally (gitignored).

> **Note:** `NIM_PAYOUT_TX_TRACE` (a `[nim-payout-tx]` step-by-step timeline) belonged to the pre-cutover game-server payout module and is **not implemented** in the current sidecar. Setting it does nothing. The log lines and files below are the current source of truth.

## The broadcast-safety invariant

The single rule that keeps payouts correct:

> **Once a transaction is broadcast to the network, its jobs are never re-sent.**

`ChainClient.sendPayout` (`payout-service/src/chain/nimiqClient.ts`) enforces this at the seam:

- It **rejects only when nothing was broadcast** (no consensus, build/sign error, or the network rejected the submission). Callers may safely retry.
- If it **resolves**, the transaction **was** broadcast. The returned `state` says how far confirmation got:
  - `confirmed` / `included` - settled; recorded immediately.
  - `pending` - broadcast but not confirmed within `NIM_TX_CONFIRM_TIMEOUT_MS`; the job is parked as `awaiting_confirmation` and never re-sent.
  - `expired` / `invalidated` - the broadcast transaction is provably dead (moved no funds), so the jobs are safely re-queued.

A transient `getTransaction` "Transaction not found" during confirmation polling is **swallowed** and polling continues to the deadline. Previously this aborted the send and the caller re-broadcast the same jobs - the root cause of the double-payout incident.

## Confirmation reconciliation

A periodic pass (`reconcileUnconfirmedSends`, every `NIM_PAYOUT_RECONCILE_INTERVAL_MS`, default 60s) resolves `awaiting_confirmation` jobs by asking the chain once per txHash:

| Chain state | Action |
|-------------|--------|
| `confirmed` / `included` | Finalize: record sent-history + analytics, adjust balance cache, drop from queue. |
| `expired` / `invalidated` | Re-queue the jobs (safe - no funds moved). |
| still `pending` / `unknown`, older than `NIM_PAYOUT_UNCONFIRMED_REVIEW_MS` (default 3h) | Escalate to **`nim-payout-needs-review.jsonl`** and remove from the queue. **Never auto re-queued**, so a transaction the node has merely pruned from its lookup index can never be double-paid. |

`awaiting_confirmation` jobs are persisted in `nim-payout-pending.json` and preserved verbatim across restarts (only `processing` jobs, which were never confirmed broadcast, revert to `pending`).

## Log lines to grep (payout-service stdout)

| Line | Meaning |
|------|---------|
| `[payout-service] Sent <hash> state=<state> claim=<10>…` | Worker send settled immediately (`confirmed`/`included`). |
| `[payout-service] Broadcast (unconfirmed) <hash> claim=…` | Worker send broadcast but not yet confirmed; parked. |
| `[payout-service] Bulk broadcast (unconfirmed) <hash> <recip>…` | Manual/auto bulk broadcast, unconfirmed; parked. |
| `[payout-service] Confirmed unconfirmed payout <hash>… (<n> job(s))` | Reconciliation finalized a parked send. |
| `[payout-service] Re-queued <n> job(s) after tx <state> <hash>…` | Reconciliation re-queued a provably dead broadcast. |
| `[payout-service] Escalated <n> job(s) to manual review - tx <hash>… still <state>` | Ambiguous unconfirmed send handed off for human review. |
| `[payout-service] Auto bulk payout (<ms> age) <recip>… {…}` | Auto bulk settled a recipient. |
| `[payout-service] Send failed (attempt <n>) claim=…: <msg>` | Pre-broadcast failure; will retry. |

## Durable audit files (in `NIM_PAYOUT_DATA_DIR`, default `/data`)

| File | Contents |
|------|----------|
| `nim-payout-sent.jsonl` | One line per settled job (`manualBulk`/`bulkTotalLuna` for bulk). |
| `nim-payout-recipient-sent/<WALLET>.jsonl` | Same, per normalized recipient. |
| `nim-payout-manual-bulk.jsonl` | One line per bulk payout - best file for spotting a duplicate bulk. |
| `nim-payout-dead-letter.jsonl` | Jobs that exhausted retries. |
| `nim-payout-needs-review.jsonl` | Broadcasts stuck unconfirmed past the review window - **needs a human decision**. |
| `nim-payout-pending.json` | Live queue (`pending` / `processing` / `awaiting_confirmation`). |

## Reconciling against the chain (finding phantom payouts)

To find transactions that were broadcast on-chain but never recorded (the fingerprint of a pre-fix double payout), use the read-only tool. It self-derives the treasury address from the signer key and diffs the treasury's outgoing transactions against `nim-payout-sent.jsonl`:

```bash
# inside the payout container
node dist/scripts/reconcileOnchain.js --since-days 4
# or reuse a pre-extracted hash list and emit JSON
node dist/scripts/reconcileOnchain.js --since-block 56700000 --logged-file /tmp/logged-tx.txt --json
```

It prints each phantom transaction (time, amount, block, recipient, hash), per-recipient overpayment totals, and a grand total. It never sends or mutates anything.

## Post-cutover stall verification (game server)

Payout WASM work runs in the sidecar - **not** on the game-server event loop.

| Log | Source | Meaning |
|-----|--------|---------|
| `[event-loop] stall <ms> ms ending at <ISO> (<gc summary>)` | `server/src/adminSystemMonitor.ts` | Node event loop blocked on **nspace**. Should **not** correlate with on-chain sends after cutover. |
| `[payout-service] Sent …` | `payout-service` container | On-chain send completed in the sidecar. |
| `[payout-outbox] Migrated delivered-claim-ids.json → .jsonl (N ids)` | game server startup | One-shot migration from full JSON array to append-only JSONL. |
| `[payout-service] Migrated accepted-claim-ids.json → .jsonl (N ids)` | payout startup | Same for the sidecar dedupe set. |

**Claim-id dedupe I/O:** `delivered-claim-ids.jsonl` (game outbox) and `accepted-claim-ids.jsonl` (payout service) append **one line per new claim**. Legacy `*.json` arrays are loaded once, rewritten to JSONL, and renamed to `*.json.pre-jsonl.bak`. Rewriting the full JSON array on every claim previously caused multi-MB sync writes and frequent `[event-loop] stall` lines under mining load.

```bash
EVENT_LOOP_STALL_LOG_MS=50    # log event-loop stalls >= 50 ms (0 disables)
```

After deploy, confirm migration logs once, then:

```bash
ls -lh data/payout-outbox/delivered-claim-ids.*
ls -lh data/payout-service/accepted-claim-ids.*
# new claims should only grow the .jsonl by ~tens of bytes each
docker compose logs nspace --since 5m 2>&1 | grep -c '\[event-loop\]'
```

## Related code

| Area | Location |
|------|----------|
| Chain send + confirmation + reconciliation helpers | `payout-service/src/chain/nimiqClient.ts` |
| Broadcast-safety contract | `payout-service/src/chain/types.ts` |
| Queue, confirmation reconciliation, bulk send, accepted-ids | `payout-service/src/queue.ts` |
| Game-server outbox + delivered-ids | `server/src/payoutOutbox.ts` |
| Offline reconciliation tool | `payout-service/src/scripts/reconcileOnchain.ts` |
| Claim balance gate (cached pull) | `server/src/rooms.ts`, `server/src/payoutBalancePull.ts` |
| Env examples | `payout-service/.env.example`, `server/.env.example` |
