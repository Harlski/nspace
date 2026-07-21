# Public patch notes — developers (`0.6.2`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [NEW] `GET /api/analytics/overview` → `chosenFlags`: `{ uniqueVisitors, withFlag, withoutFlag, byCountry: [{ code, count }] }` from `aggregateChosenFlags` × `getPlayerCountry` ([server/src/analyticsChosenFlags.ts](../../../server/src/analyticsChosenFlags.ts)).
- [NEW] `GET /api/analytics/overview` → `nimiqPay`: `{ uniqueVisitors, otherUniqueVisitors, firstTime, returning, sessionStarts, activePlayMs, payoutLunaToPayVisitors, payoutNimToPayVisitors, byDay: [{ dayUtc, uniquePay, firstTimePay }] }` ([server/src/analyticsNimiqPay.ts](../../../server/src/analyticsNimiqPay.ts)).
- [FIX] `normalZoomMax`: when `mapOverviewUnlocked`, skip hub/chamber `roomFrustumCap` so admin Max frustum can exceed 18 ([client/src/game/zoomLimits.ts](../../../client/src/game/zoomLimits.ts)).
- [NEW] Event-loop stall probe gains GC attribution: a `PerformanceObserver` on `entryTypes: ['gc']` (no `--expose-gc`) records GC events on the `performance.now()` timeline, and each `[event-loop] stall` line appends a `(gc <ms> in window: N major, N minor)` / `(gc 0 ms)` summary for the blocked window — one-deploy bisection of GC vs application-code stalls ([server/src/adminSystemMonitor.ts](../../../server/src/adminSystemMonitor.ts)).
