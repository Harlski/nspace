# Public patch notes — developers (`0.4.2`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [NEW] **`payout-service` workspace** — Bearer-authed HTTP sidecar owns the payout queue, signer, balance, flush, and admin bulk actions. Game server is producer + orchestrator only.
- [CHANGE] **Removed `server/src/nimPayout/`** — all outgoing NIM goes through [server/src/payoutGateway.ts](../../../server/src/payoutGateway.ts) → durable Outbox → [server/src/payoutServiceClient.ts](../../../server/src/payoutServiceClient.ts).
- [NEW] **`GET /api/admin/system/snapshot`** includes **`payoutService`** probe (health + authenticated `GET /v1/pending/totals`); **`paymentIntent`** probe now exposes `statusTone` and `logsHint` for UI cards.
- [OPS] **Deploy hook** — [.github/workflows/deploy-docker.yml](../../../.github/workflows/deploy-docker.yml) invokes migrate script post-backup.
- **Tests** — `server/test/payout*.test.ts`, `payout-service/test/` cover Outbox delivery, idempotency, balance gating, and service HTTP API (fake chain). No WebSocket or client API changes for payouts.
