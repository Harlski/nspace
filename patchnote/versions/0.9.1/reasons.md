# Reasons — 0.9.1 (patch-notes version)

**Patch-notes version:** `0.9.1` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Operator Telegram no longer pings on every world entry. One hourly digest covers the last 24 hours: most active players, gameplay NIM earned, play time, who is online, and who joined in the last hour.

---

## By area

### Repo / docs

- `docs/adr/0028-hourly-activity-digest.md`: decision for the hourly digest, gameplay NIM (not chain send), scan on the Analytics Service.
- `docs/THE-LARGER-SYSTEM.md`: recorded decision plus the Event Log scan note. Companion: `docs/reasons/reason_582914.md`.
- `CONTEXT.md`: **Hourly Activity Digest** replaces the Connect Notice glossary entry.
- `docs/features-checklist.md`, `docs/process.md`, `server/.env.example`: env and operator behavior.

### Client

- _(none in this change set)_

### Server

- `server/src/hourlyActivityReport.ts`: format, schedule (UTC hour + 60s), one retry, admin send.
- `server/src/index.ts`: start the scheduler; `POST /api/admin/system/hourly-activity/send` (`preview=1`). Drop the per-connect Telegram call.
- `server/src/connectNotice.ts`: removed. Dossier last-visit stats stay on `getConnectNoticeStatsForAddress`.
- `server/src/walletLoginSession.ts`, `server/src/directInvite/httpHandlers.ts`: stop marking a pending connect notice.
- `server/src/rooms.ts`: `listOnlineRealPlayers`; log `gameplay_nim_earned` for maze wins and goal rewards.
- `server/src/eventLog.ts`: event kind `gameplay_nim_earned`.
- `server/src/telegramNotify.ts`: monospace `<pre>` send with plain-text fallback.
- `server/src/analyticsServiceClient.ts`: `fetchActivityDigest`.
- `server/src/adminSystemPage.ts`: preview / send buttons.
- `server/src/dailyEarnAllowance.ts`: comment that paid gameplay must be logged for the digest.

### Analytics service

- `analytics-service/src/activityDigest.ts`: `getActivityDigest` (capped-gap play time clipped to the window, NIM deduped by `claimId`).
- `analytics-service/src/app.ts`: `GET /v1/activity-digest`.
- `analytics-service/src/eventLogAnalytics.ts`: export the scan helpers; `gameplay_nim_earned` kind.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- New optional env: `HOURLY_ACTIVITY_TELEGRAM_ENABLED` (default on when Telegram is configured), `HOURLY_ACTIVITY_TELEGRAM_CHAT_ID`, `HOURLY_ACTIVITY_TOP_N` (default 12), `HOURLY_ACTIVITY_LOOKBACK_DAYS`.
- Requires the Analytics Service. If it is down, that hour is skipped and retried once. No game-process fallback.
