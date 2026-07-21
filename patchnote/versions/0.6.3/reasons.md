# Reasons — 0.6.3 (patch-notes version)

**Patch-notes version:** `0.6.3` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Admins can now transfer a player room's ownership to another wallet from `/admin/rooms`.

Payout reliability: fixed a double-payout bug where a broadcast transaction whose confirmation poll threw `Transaction not found` was treated as failed and re-sent. Payouts now follow a strict "once broadcast, never re-sent" invariant with a confirmation-reconciliation pass, plus a read-only on-chain reconciliation tool. See [#17](https://github.com/Harlski/nspace/issues/17).

---

## By area

### Repo / docs

- [docs/process.md](../../../docs/process.md): documented the new `ownerAddress` field on `PUT /api/admin/rooms/:id`.
- [docs/features-checklist.md](../../../docs/features-checklist.md): Admin Rooms manager entry now lists the owner-transfer control.
- [docs/nim-payout-tracing.md](../../../docs/nim-payout-tracing.md): rewritten to describe the broadcast-safety invariant, the confirmation-reconciliation pass, current log lines / audit files, and the reconciliation tool; flagged `NIM_PAYOUT_TX_TRACE` as not implemented.
- [payout-service/.env.example](../../../payout-service/.env.example): added `NIM_PAYOUT_RECONCILE_INTERVAL_MS` and `NIM_PAYOUT_UNCONFIRMED_REVIEW_MS`.

### Client

- _(none in this change set)_

### Server

- [server/src/roomRegistry.ts](../../../server/src/roomRegistry.ts): `updateDynamicRoomMetadata` accepts `ownerAddress` (admin-only; rejected for official rooms) and reassigns the entry owner, then persists; new exported `normalizeOwnerAddressPatch` (single compact-NQ validator). The ownerless-room guard now also lets an admin assign an owner to a legacy ownerless player room.
- [server/src/index.ts](../../../server/src/index.ts): `PUT /api/admin/rooms/:id` parses/validates `body.ownerAddress` via `normalizeOwnerAddressPatch` and rejects it for built-in rooms.
- [server/src/adminRoomsPage.ts](../../../server/src/adminRoomsPage.ts): player-room cards gained an "Owner (transfer)" combobox (search by username or NQ, mirroring the builder picker) that stages a pending owner and sends `ownerAddress` on Save.

### payout-service

- [payout-service/src/chain/types.ts](../../../payout-service/src/chain/types.ts): `sendPayout` contract now rejects only when nothing was broadcast; added `TxLifecycleState`, `isValueMovingState`/`isDeadState`, `getTransactionState`, and `OnChainOutgoingTx`.
- [payout-service/src/chain/nimiqClient.ts](../../../payout-service/src/chain/nimiqClient.ts): confirmation polling swallows transient `getTransaction` "not found" and returns `pending` on timeout instead of throwing; added `getTransactionState`, `fetchOutgoingPayoutTransactions`, `getTreasuryAddress`, `getHeadHeight`.
- [payout-service/src/queue.ts](../../../payout-service/src/queue.ts): new `awaiting_confirmation` status (persisted); `processOne` and `manualBulkPayoutPendingForRecipient` never revert broadcast jobs; added `reconcileUnconfirmedSends` + timer; canonicalize recipient on enqueue; `nim-payout-needs-review.jsonl` audit.
- [payout-service/src/history.ts](../../../payout-service/src/history.ts): added `canonicalizeNimAddress`.
- [payout-service/src/config.ts](../../../payout-service/src/config.ts): added `reconcileIntervalMs`, `unconfirmedReviewMs`.
- [payout-service/src/scripts/reconcileOnchain.ts](../../../payout-service/src/scripts/reconcileOnchain.ts): new read-only tool (`npm run reconcile`) diffing treasury on-chain outgoing txs against `nim-payout-sent.jsonl`.
- [payout-service/test/confirmation.test.ts](../../../payout-service/test/confirmation.test.ts): new coverage for the broadcast-safety invariant and reconciliation outcomes.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
