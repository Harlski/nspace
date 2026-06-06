# Public patch notes — developers (`0.3.24`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **[CHANGE]** **`POST /api/feedback`** with `source: "report"` — client sends **`message`** (player reason only, max **400**) plus **`report`**: `{ reportedWallet, reportedDisplayName, reportedMessage, reportedAtMs?, roomId? }`. Server validates via `parseFeedbackReportInput`, composes the stored first message with `composeReportTicketMessage`, attaches **`reportContext`** (including **`reportedUserChatHistory`** from `snapshotChatHistoryForWallet` in [`server/src/rooms.ts`](../../../../server/src/rooms.ts)). Player-facing ticket detail omits `reportContext`; **`GET /api/admin/feedback/:id`** returns **`ticketToAdminDetail`** with full context.
- **[NEW]** [`server/src/feedbackTicketStore.ts`](../../../../server/src/feedbackTicketStore.ts) — `FeedbackReportContext`, `FEEDBACK_REPORT_REASON_MAX`, `ticketToAdminDetail`.
- **[CHANGE]** Client report UI ([`client/src/ui/hud.ts`](../../../../client/src/ui/hud.ts)) — read-only report block; `#hud-feedback-kind-wrap` hidden; `setFeedbackReportRoomId` from welcome; [`client/src/main.ts`](../../../../client/src/main.ts) forwards `report` in create body.
- **[NEW]** [`server/src/adminFeedbackPage.ts`](../../../../server/src/adminFeedbackPage.ts) — report panel + reported-user chat history list (highlight when text/time match quoted message).
