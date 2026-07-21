# Public patch notes — developers (`0.6.3`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **Payout broadcast-safety invariant.** `ChainClient.sendPayout` now rejects **only** when nothing was broadcast (safe to retry); a resolved result always means the transaction was broadcast and its jobs must never be re-sent. The returned `state` (`confirmed`/`included`/`pending`/`expired`/`invalidated`) drives settlement. Transient `getTransaction` "not found" during confirmation polling is swallowed instead of aborting the send.
- **New `awaiting_confirmation` job status** (persisted) plus a periodic `reconcileUnconfirmedSends` pass: confirmed sends finalize, provably dead ones re-queue, and ambiguous stuck sends escalate to `nim-payout-needs-review.jsonl` rather than being re-queued.
- **Recipient canonicalization** on enqueue removes the spaced/unspaced duplicate-recipient hazard.
- **New offline tool** `payout-service/src/scripts/reconcileOnchain.ts` (`npm run reconcile`) for on-chain vs recorded diffing.
- **Admin API:** `PUT /api/admin/rooms/:id` accepts an `ownerAddress` field to transfer player-room ownership (rejected for built-in rooms).
