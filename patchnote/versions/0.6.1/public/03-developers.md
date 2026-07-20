# Public patch notes — developers (`0.6.1`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [FIX] `payoutOutbox.ts` — in-memory pending queue + compact `outbox.jsonl` on startup/drain; dynamic `PAYOUT_OUTBOX_DIR` resolution for tests.
- [FIX] `/analytics` unique-visitors stacked bars: segment weights sum to server `uniquePlayers` when detail lists are capped (`analyticsVisitorStack.ts`).
- [PERF] `getEventLogAnalyticsSnapshot` — TTL cache (`ANALYTICS_OVERVIEW_CACHE_TTL_MS`) + single-pass JSONL scan for first-time login detection.
- [CHANGE] `buildDefaultTutorialBootstrapShell` / `TUTORIAL_DEFAULT_BOUNDS` — portrait 7×15 Tutorial Path per ADR 0006; covered by `server/test/tutorialBootstrapShell.test.ts`.
- [NEW] Attention Marker parallel tile layer (ADR 0009): `server/src/attentionMarker/`, WS `placeAttentionMarker` / `setAttentionMarkerProps` / `moveAttentionMarker` / `removeAttentionMarker` / `attentionMarkers`, Build Shell `attentionMarkers`, client `attentionMarkerVisual.ts`.
- [NEW] Unlock Pad Payment Intent Hub checkout when `window.nimiqPay.sendBasicTransactionWithData` is absent (`client/src/unlockPad/pay.ts`).
