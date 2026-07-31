# Public patch notes — developers (`0.6.10`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [FIX] `getEventLogAnalyticsSnapshot` / `computeAnalyticsFileDays` — scan **window + lookback** so `seenBeforeWindow` populates; fixes Pay `returning === 0` when FTU equals Pay unique.
- [NEW] Env `ANALYTICS_FIRST_TIME_LOOKBACK_DAYS` ([server/src/eventLog.ts](../../../server/src/eventLog.ts)); regression test [server/test/analyticsNimiqPayReturning.test.ts](../../../server/test/analyticsNimiqPayReturning.test.ts).
