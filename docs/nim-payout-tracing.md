# Nimiq payout: trace logging

Structured trace logs for on-chain payout sends in the **Payout Service** sidecar. The game server no longer runs the Nimiq light client for payouts ([ADR-0002](adr/0002-payouts-in-dedicated-sidecar-service.md), [payout-cutover-runbook.md](payout-cutover-runbook.md)).

For historical mutex/balance-cache incident notes, see **`docs/toremove/LEARNEDLESSONS.md`** locally (gitignored).

## Enable

Set on the **payout service** (e.g. `payout-service/.env` or the `payout` container env):

```bash
NIM_PAYOUT_TX_TRACE=1
```

Restart the payout process. Logs are prefixed with **`[nim-payout-tx]`**.

## What you should see (in order)

| Log | Meaning |
|-----|---------|
| `worker_before_send` | From `payout-service/src/queue.ts` immediately before send. Includes `sinceEnqueueMs`, `amountLuna`. |
| `send_enter` | Entered the chain send path (amount + recipient prefix). |
| `mutex_phase1_acquired` + `queueWaitMs` | Time waiting for the Nimiq mutex before phase 1 (build/sign/broadcast). |
| `after_getClient` + `stepMs` | `getClient()` finished. |
| `after_waitForConsensus` + `stepMs` | `waitForConsensusEstablished()` finished. |
| `after_getHeadAndNetworkId` + `stepMs` | Head block + network id read. |
| `before_sendTransaction` | About to call `client.sendTransaction(tx)`. |
| `after_sendTransaction` + `stepMs`, `hash`, `state` | Broadcast returned. |
| `poll_loop_start` + `deadlineMs`, `initialState` | Entering confirmation polling. |
| `poll_mutex_acquired` + `poll`, `queueWaitMs` | Each poll waits on the mutex again before `getTransaction`. |
| `poll_got_tx` + `poll`, `state` | State after each poll. |
| `send_success` | Included/confirmed; cache adjusted. |
| `send_tx_invalid` / `send_timeout` | Failure paths. |

Successful sends also log **`[payout-service] Sent …`** from `payout-service/src/queue.ts`.

## Disable

Unset `NIM_PAYOUT_TX_TRACE` or set it to anything other than `1`.

## Post-cutover stall verification (game server)

After cutover, payout WASM work runs in the sidecar — **not** on the game-server event loop.

| Log | Source | Meaning |
|-----|--------|---------|
| `[event-loop] stall <ms> ending at <ISO> (<gc summary>)` | `server/src/adminSystemMonitor.ts` | Node event loop blocked on **nspace**. Should **not** correlate with payout sends after cutover. |
| `[payout-service] Sent …` | `payout-service` container | On-chain send completed in the sidecar. |

```bash
EVENT_LOOP_STALL_LOG_MS=50    # log event-loop stalls >= 50 ms (0 disables)
```

### GC attribution on stall lines

Each stall line ends with a garbage-collection summary for the blocked window, so you can tell **at a glance** whether the stall was V8 collecting or application code:

- `gc 0 ms` — no GC in the window; the stall is **application code** (persistence writes, tick loop, a periodic job). Add per-operation timing to the suspect next.
- `gc 812 ms in window: 2 major, 5 minor` — the window was dominated by **garbage collection**; tune heap size / allocation rate rather than chasing a specific handler.

The summary uses a `PerformanceObserver` on GC events (no `--expose-gc` flag needed) and the `performance.now()` timeline, so it costs nothing when idle and stays accurate under load.

On the **client**, the debug stats panel (click your own identicon) shows a **server round-trip-time graph** — periodic spikes during payouts should flatten after cutover.

## Related code

| Area | Location |
|------|----------|
| Chain send + trace | `payout-service/src/chain/nimiqClient.ts` |
| Worker loop + enqueue | `payout-service/src/queue.ts` |
| Claim balance gate (cached pull) | `server/src/rooms.ts`, `server/src/payoutBalancePull.ts` |
| Env examples | `payout-service/.env.example`, `server/.env.example` |
