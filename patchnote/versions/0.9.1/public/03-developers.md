# Public patch notes — developers (`0.9.1`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [CHANGE] **Connect Notices removed.** The game no longer sends Telegram from the WebSocket connect path. `server/src/connectNotice.ts` is gone. Admin dossier last-visit stats still use `getConnectNoticeStatsForAddress`.
- [NEW] **Hourly digest.** Analytics Service `GET /v1/activity-digest?fromMs&toMs&lookbackDays` returns the rolling window. The game formats and sends it (`server/src/hourlyActivityReport.ts`). NIM is gameplay credit (`claim_block` and `gameplay_nim_earned`, one count per `claimId`), not `nim_payout_sent`.
- [CHANGE] **Earn log.** Maze wins and Free Play goal rewards append `gameplay_nim_earned`. Mines stay on `claim_block`.
