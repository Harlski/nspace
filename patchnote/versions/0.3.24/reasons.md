# Reasons — 0.3.24 (patch-notes version)

**Patch-notes version:** `0.3.24` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

**Chat report hardening:** reported player, wallet, and message are read-only in the report overlay; the player submits only their reason (max 400 chars). Server accepts structured `report` on `POST /api/feedback` (`source: "report"`), composes the ticket body server-side, stores immutable `reportContext`, and snapshots the reported user's recent chat from the server backlog (~10 min). Admin `/admin/feedback` detail shows reported player, quoted message, and captured chat history. Report overlay hides the feedback **Type** dropdown (kind fixed to bug).

---

## By area

### Repo / docs

- **`docs/features-checklist.md`:** Chat report read-only UI, structured `reportContext`, admin chat history.

### Client

- **`client/src/ui/hud.ts`:** Report overlay — read-only `#hud-feedback-report-context` block; editable textarea is reason only; `#hud-feedback-kind-wrap` hidden in report mode; `setFeedbackReportRoomId`; `createTicket` sends `report` object + `source: "report"`.
- **`client/src/main.ts`:** Feedback create handler sends `report` payload; sets report room id on welcome.
- **`client/src/style.css`:** `.feedback-overlay__report-*` styles.

### Server

- **`server/src/feedbackTicketStore.ts`:** `FeedbackReportContext`, `parseFeedbackReportInput`, `composeReportTicketMessage`, `FEEDBACK_REPORT_REASON_MAX` (400); `reportContext` on tickets; `ticketToAdminDetail`.
- **`server/src/rooms.ts`:** `snapshotChatHistoryForWallet` — chat backlog lines for a wallet (optional room scope).
- **`server/src/index.ts`:** Report branch on `POST /api/feedback`; admin detail via `ticketToAdminDetail`.
- **`server/src/adminFeedbackPage.ts`:** Report panel + reported-user chat history in ticket detail.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- No new env vars or migrations. Existing `FEEDBACK_STORE_FILE` tickets gain optional `reportContext` on new report tickets only.
