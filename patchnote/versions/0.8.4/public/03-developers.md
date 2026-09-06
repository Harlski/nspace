# Public patch notes — developers (`0.8.4`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [FIX] After Path Playback drain, `syncState` no longer hard-snaps `selfMesh` onto a >6-tile stale `lastPlayers` pose (pose-omitted presence `stateDelta`). `shouldHardSnapSelfMeshOnSync({ behindAlongPath })` holds last playback; welcome / `moveAbort` still snap. Regression: `selfCameraRubberband.test.ts`.
- [FIX] Nimiq Pay `sendBasicTransactionWithData` now sends the Payment Intent memo as hex `data`/`recipientData` and UTF-8 `extraData` on the first call (`client/src/pay/nimiqPayTxParams.ts`, `/advertise` `buildNimiqPayTx`). Plaintext-only `data` was dropped by Pay (RPC data is hex; Hub uses `extraData`), so verify failed with "Transaction memo/data does not match intent memo". `/advertise` no longer sets `validityStartHeight`.
