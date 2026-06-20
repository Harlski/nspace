# Nimiq payout: trace logging (today)

How to enable **structured trace logs** for on-chain payout sends in the current server. For payout mutex behavior, balance cache tuning, and long incident-style notes, maintain **`docs/toremove/LEARNEDLESSONS.md` locally** (gitignored — see [toremove/README.md](toremove/README.md) and [AGENTS.md](../AGENTS.md)).

For a **separate payout worker / queue migration** (not implemented as a split process in the default compose file), see [brainstorm/nim-payout-worker-migration.md](brainstorm/nim-payout-worker-migration.md).

## Enable

Set in the server environment (e.g. `server/.env`):

```bash
NIM_PAYOUT_TX_TRACE=1
```

Restart the API process. Logs are prefixed with **`[nim-payout-tx]`**.

## What you should see (in order)

| Log | Meaning |
|-----|---------|
| `worker_before_send` | From `nimPayout/queue.ts` immediately before `sendNimPayoutTransaction`. Includes `sinceEnqueueMs`, `amountLuna`. |
| `send_enter` | Entered `sendNimPayoutTransaction` (amount + recipient prefix). |
| `mutex_phase1_acquired` + `queueWaitMs` | Time **waiting for `withNimiqMutex`** before phase 1 (build/sign/broadcast). Large values while gameplay feels stuck usually mean **another mutex user** (e.g. `getNimPayoutWalletBalanceLuna`, another payout phase, or poll `getTransaction`) is ahead. |
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

## Disable

Unset `NIM_PAYOUT_TX_TRACE` or set it to anything other than `1`.

## Always-on contention logs (no `NIM_PAYOUT_TX_TRACE` needed)

For diagnosing **periodic stalls** (e.g. the ~30s lag that lines up with payouts in docker logs) without enabling the full per-send trace, two low-noise logs are on by default:

| Log | Source | Meaning |
|-----|--------|---------|
| `[nim-mutex] <label> waitMs=… holdMs=… [behind=…] at=…` | `server/src/nimPayout/sender.ts` | A Nimiq critical section **waited for** (`waitMs`) or **held** (`holdMs`) the shared Nimiq mutex past the threshold. `label` is `payout-send`, `balance`, or `payout-poll`; `behind` names the section that was holding it. High `waitMs` on `balance` with `behind=payout-send` is direct evidence payouts are stalling balance reads. |
| `[event-loop] stall <ms> ending at <ISO>` | `server/src/adminSystemMonitor.ts` | The Node event loop was **blocked** for at least the threshold. Blocking affects *all* WebSocket traffic, not just Nimiq users. Match the timestamp against `[nim-payout] Sent` / `[nim-mutex]` lines. |

Thresholds (set to `0` to disable, except `NIM_MUTEX_LOG_MS=0` which logs **every** acquisition):

```bash
NIM_MUTEX_LOG_MS=200          # log mutex wait/hold >= 200 ms
EVENT_LOOP_STALL_LOG_MS=50    # log event-loop stalls >= 50 ms (0 disables)
```

On the **client**, the debug stats panel (click your own identicon in your profile) now shows a **server round-trip-time graph** sampled once per second, so periodic spikes are visible in-game while you watch the docker logs above.

## Related code

| Area | Location |
|------|----------|
| Mutex + send + trace | `server/src/nimPayout/sender.ts` |
| Worker loop + enqueue | `server/src/nimPayout/queue.ts` |
| Claim balance gate | `server/src/rooms.ts` |
| Env examples | `server/.env.example` |
