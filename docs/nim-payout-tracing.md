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

## Related code

| Area | Location |
|------|----------|
| Mutex + send + trace | `server/src/nimPayout/sender.ts` |
| Worker loop + enqueue | `server/src/nimPayout/queue.ts` |
| Claim balance gate | `server/src/rooms.ts` |
| Env examples | `server/.env.example` |
