# Reasons — 0.6.10 (patch-notes version)

**Patch-notes version:** `0.6.10` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

`/analytics` Pay returning / first-time lookback fix (`ANALYTICS_FIRST_TIME_LOOKBACK_DAYS`).

---

## By area

### Repo / docs

- Env + checklist docs for analytics first-time lookback ([docs/process.md](../../../docs/process.md), [docs/features-checklist.md](../../../docs/features-checklist.md), [server/.env.example](../../../server/.env.example)).

### Client

- _(none in this change set)_

### Server

- **`/analytics` Pay returning** — rolling windows only scanned day-files inside the selected range, so `seenBeforeWindow` stayed empty and **Pay returning** was always **0** (Pay first-time matched Pay unique). `computeAnalyticsFileDays` now includes first-time lookback before the window (`ANALYTICS_FIRST_TIME_LOOKBACK_DAYS`, default `DAILY_STATS_LOOKBACK_DAYS` or **400**). Regression: [server/test/analyticsNimiqPayReturning.test.ts](../../../server/test/analyticsNimiqPayReturning.test.ts).

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
