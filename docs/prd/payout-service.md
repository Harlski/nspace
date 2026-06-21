# PRD — Dedicated NIM Payout Service

> Status: draft (not yet an issue). Architecture recorded in `docs/adr/0002-payouts-in-dedicated-sidecar-service.md`; vocabulary in the `## Payouts` section of `CONTEXT.md`.

## Problem Statement

While the game is live, players experience periodic multi-second freezes — movement, chat, and mining all stall at once, roughly lining up with NIM payouts. The cause is that outgoing payouts run inside the game server: the Nimiq light client does heavy synchronous work on the main thread, blocking Node's event loop and therefore *every* connected player's WebSocket. The longer-term concern is that the entire payout subsystem (including the hot-wallet signing key and the durable queue) is fused into the game server, so it can't be restarted, scaled, or hardened independently, and a payout problem can degrade gameplay.

## Solution

Move all outgoing-NIM responsibility into a new **Payout Service**: a dedicated, internal sidecar process that owns the durable queue, the signer (hot wallet), confirmation polling, balance reads, retries/dead-letter, the end-of-day flush, and admin "Payout in full". The game server stops touching the chain entirely — it becomes a producer that records each **Pay-Intent** to a durable **Outbox** and ships it to the Payout Service, and an orchestrator that keeps scheduling, reporting, and admin presentation while reading data and triggering actions over HTTP. From the player's perspective the game stops freezing during payouts, rewards are still paid (exactly once, never lost), and the HUD balance and reward feedback are unchanged.

## User Stories

1. As a player who completes a block claim, I want my NIM reward queued reliably even if the payout subsystem is momentarily down, so that I never lose earned rewards.
2. As a player, I want the game to stay smooth with no periodic multi-second freezes while payouts process, so that mining, movement, and chat are never interrupted.
3. As a player, I want my reward paid exactly once even when internal retries occur, so that I'm never double-paid or under-paid.
4. As a World Cup scorer, I want my goal-reward outcome (paid / daily cap reached / pool spent) to still appear immediately under the goal banner, so that feedback is unchanged.
5. As a maze first-place winner, I want my 1 NIM reward queued reliably, so that I'm paid for winning.
6. As an admin-rewarded feedback author, I want my reward still queued and sent, so that integrated feedback is paid.
7. As a player viewing the payout-wallet balance in the HUD, I want it to keep showing an accurate (slightly cached) balance, so that I can see the reward pool.
8. As a player completing a claim, I want fund-gating (whether a reward can be awarded based on wallet balance) to behave exactly as before, with no new lag or false rejections, so that claiming feels identical.
9. As a player, I want my reward to survive a game-server restart between earning it and it being sent, so that restarts never drop payouts.
10. As a server operator, I want the payout subsystem to run as its own service, so that I can restart or redeploy it independently of the game server.
11. As a server operator, I want a payout-service crash or hang to not take down the game, so that gameplay survives payout outages.
12. As a server operator, I want the hot-wallet signing key to exist in exactly one service's environment, so that the key's exposure is minimized.
13. As a server operator, I want the payout-service to run by default in production (not behind an opt-in profile), so that payouts always work.
14. As a server operator, I want the two services to authenticate with a shared secret over a localhost-bound interface, so that the payout API is never publicly exposed.
15. As a server operator, I want a safe single-release cutover that hands over existing pending payouts without double-paying, so that migration is low risk.
16. As a server operator, I want the game server's event-loop stalls to disappear after cutover, so that I can confirm the fix in logs and the in-game latency graph.
17. As a server operator, I want the payout-service to expose health/observability, so that I can monitor it like the other sidecars.
18. As a wallet admin, I want "Payout in full" for a recipient to keep working, so that I can manually settle a player.
19. As an analytics admin, I want the end-of-day stats report to still show "pending NIM in queue" and "total NIM (sent + pending)", so that daily reporting stays accurate.
20. As an analytics admin, I want the end-of-day flush to run after the stats snapshot in the correct order, so that the reported numbers are correct and the queue is settled.
21. As an admin/observer, I want the payout history and public payout pages to keep working, so that transparency is preserved.
22. As a developer, I want all outgoing-NIM logic behind one service boundary, so that the game server's only payout knowledge is "enqueue a Pay-Intent" and "read a cached balance".
23. As a developer, I want to test the Payout Service offline with a fake chain client, so that tests are deterministic and never hit a real network.
24. As a developer, I want to test the game server's Outbox and delivery loop against a stub service, so that at-least-once delivery, idempotency, and durability are verified without a real service.
25. As a developer, I want the on-disk payout data format unchanged, so that migration is a directory hand-over rather than a data transform.
26. As a developer, I want the single-processor invariant enforced, so that two senders never operate on one hot wallet.

## Implementation Decisions

**New Payout Service (sidecar).**
- A separate process with its own Docker image, internal and **localhost-bound**, reached by the game server over Docker DNS — mirroring the existing Payment Intent Service deployment shape.
- Authenticated with a shared static **Bearer secret** (same pattern the game server already uses to reach the Payment Intent Service).
- **Runs by default in production** (not behind an opt-in compose profile), because payouts are core.

**Service responsibilities (the "fat service").** The Payout Service owns, end to end: the durable payout queue and its persistence; the signer (hot wallet key, sign + broadcast); confirmation polling; balance reads with caching, including the post-send balance decrement; retries with backoff and dead-letter handling; the end-of-day flush *action*; the admin "Payout in full" *action*; and payout history reads. All `@nimiq/core` usage stays funnelled through a single chain chokepoint inside the service.

**Game server becomes producer + orchestrator.**
- On any reward event, gameplay writes a **Pay-Intent** to a durable, append-only **Outbox**; a delivery loop ships intents to the Payout Service with retries and removes them on acknowledgement. Delivery is **at-least-once**; the service **deduplicates by `claimId`**, so redelivery is safe.
- The game server keeps a **locally cached balance pulled periodically from the service** (the service is the source of truth). The claim hot path reads this local cache **without any network call**, exactly as it reads the in-process cache today. Existing claim-peek staleness tolerance continues to govern that cached value.
- Scheduling, the daily-stats report (including the "pending in queue" snapshot and the Telegram/World-Cup recap), admin routes, and history pages **remain in the game server** and become thin **proxies** to the service. The daily flush keeps its ordering: snapshot pending → send report → trigger flush.

**HTTP contract (high level; Bearer-authed).** Enqueue a Pay-Intent (idempotent by `claimId`); read current balance; read a pending summary (counts + totals for reporting); trigger the end-of-day flush; trigger a manual bulk payout for one recipient; read payout history.

**Key relocation and the single-processor invariant.** The signer key moves to the Payout Service environment and is **removed from the game-server environment**. The in-process payout processor is **removed in the same release** the service takes over — there is never a window with two processors against one hot wallet.

**Cutover.** The existing on-disk payout data directory is **handed over unchanged** to the service's volume (no format change). The switch is a **hard, single-release cutover** (stop in-process processor → hand over data directory → start service). No phased dual-run.

**Configuration.** The `NIM_PAYOUT_*` and `NIM_BALANCE_*` settings that govern the queue, signer, retries, flush, and balance move to the Payout Service. The game server gains a payout-service base URL and shared-secret pair (following the existing inter-service secret naming pattern). The claim-peek staleness setting stays on the game server, now governing the pulled balance cache.

**Security (built in, reviewed later).** Localhost-bound API; Bearer secret of sufficient length; signing key present in exactly one service and **never logged**; double-spend prevented by `claimId` idempotency plus the single-processor invariant; Outbox integrity so an intent is neither lost nor duplicated on game-server restart.

## Testing Decisions

Good tests assert **external behavior only**, never implementation details — given inputs at a seam, assert observable outputs/effects, so internals can be refactored freely.

**Seam 1 — the Payout Service HTTP API (primary).**
- *Service side:* drive the HTTP API directly with the chain client faked. Assert: enqueue is idempotent by `claimId`; retries back off and move a job to dead-letter after the configured attempts; the flush aggregates pending per recipient into one settlement; manual bulk payout settles one recipient; balance is served and **decremented after a successful send**; a successful send happens exactly once.
- *Game-server side:* point the payout-service client at a **stub HTTP service**. Assert: at-least-once delivery; idempotent redelivery after a simulated failure/timeout; Outbox durability across a simulated restart (persisted, then drained); the claim hot path reads the cached balance **without** a network call; the balance cache refreshes on its pull cadence.

**Seam 2 — the Nimiq client inside the service (necessary).** Keep all `@nimiq/core` use behind one chokepoint so a fake chain client is injected in tests; never touch a real network.

**Prior art.** Payment Intent Service `test/` (intents store, RPC, memo) already mocks the chain — mirror it for the service. On the game-server side, `server/test/paymentIntentProbe.test.ts` exercises a service client over HTTP, and `server/test/worldcup-goalReward.test.ts` exercises reward-gating logic — mirror those for the Outbox/delivery and claim-gating tests.

## Out of Scope

- Changing reward amounts, economics, or which events trigger payouts (the four enqueue triggers stay as-is).
- Multi-wallet or nonce-parallel sending (single hot wallet, serialized, is retained).
- Replacing the JSON queue with a database (on-disk format is intentionally preserved for a directory hand-over).
- Any change to the Payment Intent Service (incoming payments).
- The in-game latency graph and the `[nim-mutex]` / `[event-loop]` diagnostic logs (already shipped; they serve as before/after verification, not as work here).
- A phased dual-run rollout (explicitly rejected due to the shared-wallet double-send risk).

## Further Notes

- This PRD realizes ADR-0002. Use the `CONTEXT.md` Payouts vocabulary throughout (Payout Service, Payment Intent Service, Pay-Intent, Outbox).
- **Verification:** after cutover the game server's `[event-loop] stall` lines should disappear and the in-profile latency graph should flatten during payout activity — the exact signal that prompted this work.
- **Security gate:** run `/review-security` on the implementation diff before cutover, focused on key relocation, inter-service auth, idempotency, and double-spend.
- **Suggested independent issues for `/to-issues`** (each grabbable on a fresh context): (1) scaffold the Payout Service — process, Docker image, Bearer auth, chain seam, HTTP skeleton + health; (2) move queue + retries + dead-letter + confirmation polling into the service, with tests; (3) move balance read/cache + flush + manual-bulk into the service, with tests; (4) game-server Outbox + delivery loop + `claimId` idempotency, with tests; (5) game-server balance pull-cache and claim hot-path swap; (6) admin/history/daily-stats proxying with flush ordering preserved; (7) compose/deploy posture, key relocation, and the cutover/migration runbook.
