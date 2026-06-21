# NIM payouts run in a dedicated sidecar service

All outgoing NIM payouts (the `@nimiq/core` light client: sign, send, confirmation polling, balance reads) used to run **in-process** in the game server. Because the light client does heavy synchronous WASM work on the main thread, payout activity blocked Node's event loop — observed as multi-second `[event-loop] stall` spikes that froze *every* player's WebSocket, lined up with `[nim-payout] Sent` log lines. We are moving payouts out of the game server entirely.

## Decision

A new **Payout Service** — a separate process and Docker image, an internal localhost-bound sidecar authenticated with a shared `Bearer` secret (mirroring the existing `payment-intent-service` pattern). It **owns** all Nimiq payout concerns: the durable queue, the signer (hot wallet key), retries / dead-letter, confirmation polling, balance reads, the end-of-day flush *action*, and admin "Payout in full".

The game server becomes a **producer + orchestrator**: gameplay still decides *when* to pay, writes each pay-intent to a local **durable outbox**, and a delivery loop ships it to the Payout Service (idempotent by `claimId`). The game server keeps scheduling/presentation (daily-stats report, Telegram/World-Cup recap, admin pages, history pages) and reaches the service over HTTP for data and actions; admin/history endpoints become thin proxies.

## Considered options

- **`worker_thread` inside the game server** — fixes the event-loop stall with far less work, but gives no operational separation (independent restart/scaling, fault isolation). Rejected because future-proofing and isolation were explicit goals.
- **Extend `payment-intent-service`** — reuses a container + Nimiq client, but that service is read-only incoming verification with no private key; adding the **outgoing hot-wallet signer** there mixes risk profiles into one blast radius. Rejected to keep the signer the most locked-down, single-purpose component.

## Consequences

- The signer hot wallet key (`NIM_PAYOUT_PRIVATE_KEY`) **moves to the Payout Service and is removed from the game-server env** — it lives in exactly one place.
- The non-blocking claim hot path is preserved: the game server keeps a **locally cached balance pulled periodically from the service** (source of truth), not an in-process Nimiq read.
- **Single-processor invariant:** never two processors against the one hot wallet. Cutover is a **hard, single-release** switch (stop in-process processor → hand over the existing `NIM_PAYOUT_DATA_DIR` unchanged → start the service); no phased dual-run.
- Unlike `payment-intent` (opt-in compose profile), the Payout Service **runs by default in production** — payouts are core.
- The game server is **not** fully stateless about payouts: it retains a minimal durable outbox of undelivered intents.
