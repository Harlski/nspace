---
title: Chat profanity filtering & admin chat history
status: ready-for-agent
---

# Chat profanity filtering & admin chat history

## Problem Statement

Players can send profane content in room chat with no server-side filtering, while usernames are already filtered. Operators investigating abuse have no durable admin view of chat: the in-memory room backlog only retains ~10 minutes and ~50 lines, and player reports attach a similarly short snapshot. When reviewing an incident, staff cannot easily answer who saw a message — especially players who joined later and received lines via the `welcome` chat backlog — nor browse history globally, by room, or by wallet over a useful time window.

## Solution

Apply shared profanity censoring on player chat at send time (players see censored text; fully empty-after-censor messages are rejected with a clear error). Extend the gameplay event log with structured chat records (censored text, admin-only original text, live audience at send) and explicit backlog-replay events when joiners receive history. Expose system-admin JSON APIs and a `/admin/chat` page to search and browse chat (global, per-room, per-user), inspect live vs backlog-derived audiences per message, and take inline moderation actions (channel mute, links to feedback and player profile).

## User Stories

### Player — chat filtering

1. As a player in a room, I want profanity in my chat message censored before others see it, so that public chat stays appropriate without blocking the conversation entirely.
2. As a player, I want messages that are entirely profanity after censoring to be rejected with a clear in-game notice, so that I understand why nothing appeared (not a bug or lag).
3. As a player whose message was censored, I want other players to see the censored version only, so that the room experience matches what moderation tools show by default.
4. As a player, I want non-profane chat to behave exactly as today (rate limits, room scope, HUD log, bubbles), so that normal use is unchanged.
5. As a player who is channel-muted, I want to remain unable to send chat, so that existing moderation still applies before profanity filtering runs.
6. As a player setting a username, I want username profanity rules to stay consistent with chat (shared word list), so that policy feels coherent.

### Operator — browsing chat history

7. As a system admin, I want a dedicated `/admin/chat` page in the admin hub, so that I can review chat without writing JSONL queries by hand.
8. As a system admin, I want to browse all player chat across the deployment within a time window (default 7 days, max 30 days), so that I can investigate cross-room patterns.
9. As a system admin, I want to filter chat history to a single room, so that I can moderate room-specific incidents.
10. As a system admin, I want to filter chat history to a single wallet address, so that I can review one player's conduct.
11. As a system admin, I want paginated results ordered by time, so that large windows remain usable.
12. As a system admin, I want each row to show timestamp, room, sender wallet, display name at send time (if available from log context), and censored message text, so that I can scan quickly.
13. As a system admin, I want to expand a message to see the original uncensored text when it differed from the censored version, so that I can judge severity without exposing profanity in the default list view.
14. As a system admin, I want player chat only (human wallet `chat` intents), excluding NPC bubble-only and system notices, so that the view focuses on moderation targets.
15. As a system admin, I want unauthenticated or non-system-admin access denied on both the page and APIs, so that sensitive chat data stays restricted.

### Operator — audience visibility

16. As a system admin viewing a message, I want to see which wallets were live in the room when the message was sent, so that I know who received the realtime broadcast.
17. As a system admin, I want to see which wallets later received that message via chat backlog on join, so that I can respond to “I never saw that” vs “it was in history when I walked in”.
18. As a system admin, I want live audience and backlog audience shown as separate lists, so that the distinction is explicit.
19. As a system admin, I want audience lists to exclude stream observers and NPC identities, so that lists reflect human participants only.
20. As a system admin, I want message detail to identify messages by room plus sender plus timestamp (and wallet), so that backlog replay events can be correlated unambiguously.

### Operator — inline actions

21. As a system admin, I want to channel-mute a sender from the chat admin UI, so that I can act during an incident without leaving the page.
22. As a system admin, I want to unmute a sender from the same flow where the product already supports it, so that moderation is reversible.
23. As a system admin, I want a link to open related feedback tickets (search/filter by reported wallet or existing report context), so that I can connect chat review to player reports.
24. As a system admin, I want a link to the player profile or admin user detail for a wallet when available, so that I can see broader account context.
25. As a system admin, I want mute actions to use the existing moderation store and API semantics, so that mutes take effect immediately on the live game server.

### Developer / operator — APIs and data

26. As a developer, I want JSON admin chat query endpoints backing the page, so that scripts or future tooling can reuse the same read model.
27. As a developer, I want chat query logic to read from existing daily gameplay JSONL event files, so that v1 does not require a new database.
28. As a developer, I want new event kinds and payload fields documented in the analytics event vocabulary, so that downstream aggregations stay predictable.
29. As a server operator, I want chat logging volume to remain bounded (no full-room presence snapshots on every tick), so that disk growth stays acceptable.
30. As a server operator, I want backlog-replay logging only on join when a non-empty backlog is delivered, so that extra events are proportional to actual replays.

### Regression / compatibility

31. As a player report author, I want feedback reports to continue attaching recent chat context for the reported wallet, so that reporting still works (may still use in-memory backlog for immediacy; durable admin view is additive).
32. As an analytics consumer of `chat` event counts, I want existing daily chat counters to remain meaningful (count censored player chat sends), so that dashboards do not break.
33. As a developer, I want username assignment to keep rejecting profane names (not censor them), so that display names stay stricter than free-form chat.

## Implementation Decisions

**Shared profanity module.**

- Extract profanity detection/censoring from the username policy into a shared module used by both username assignment and chat.
- Usernames: keep current behavior — reject with `username_profanity` (no censoring).
- Chat: censor in flight using the same base library plus an expanded checked-in custom word list (game-specific terms); usernames and chat share the list source.
- Chat censor output: `{ censored: string, wasFiltered: boolean, original?: string }`. When `wasFiltered` and trimmed censored text is empty, do not broadcast; send WebSocket error code `chat_blocked_profanity` (client shows a system line, mirroring `channel_muted` handling).
- Operator-configurable word lists via admin settings are out of scope for v1.

**Chat send path (room authority).**

- After existing validation (rate limit, channel mute, control-char strip, length cap, non-empty trim), run the profanity censor.
- Broadcast and in-memory room backlog store **censored** text only (same as today for backlog semantics: max 50 lines, 10-minute window per room).
- Append gameplay event `chat` with payload including at minimum: `text` (censored), optional `textOriginal` when filtered, `displayName` or rely on existing session context, and `audienceLive`: compact wallet addresses present in the room as human participants at send time (exclude stream observers and NPC-labeled connections).

**Chat backlog replay logging.**

- When a client receives `welcome` with a non-empty `chatBacklog`, append gameplay event `chat_backlog_delivered` with: `sessionId`, `address`, `roomId`, and `lines`: array of `{ at, fromAddress }` referencing backlog entries delivered (censored text is already in the referenced `chat` events).
- Use stable message correlation key `(roomId, fromAddress, at)` for joining audience to original chat events.

**Event log query module.**

- Add read helpers that scan recent JSONL files (reuse existing max-days / date-range patterns; default query window 7 days, hard cap 30 days).
- Support filters: time range, optional `roomId`, optional sender wallet.
- For each `chat` event, aggregate audience:
  - **Live:** from `audienceLive` on the event.
  - **Backlog:** wallets appearing in `chat_backlog_delivered` events whose `lines` contain matching `(fromAddress, at)` for the same `roomId`.
- Return paginated message rows; detail endpoint or embedded detail includes audience breakdown and optional `textOriginal`.
- `textOriginal` is returned only from admin-authenticated responses, never from player-facing APIs.

**Admin HTTP API (system admin wallet JWT).**

- `GET /api/admin/chat` — query params: `from`, `to` (epoch ms or ISO), optional `roomId`, optional `wallet`, `cursor`, `limit`. Response: messages with censored text, metadata, optional flag `hasOriginal`, pagination cursor.
- `GET /api/admin/chat/message` — query params: `roomId`, `fromAddress`, `at` — full detail: censored text, `textOriginal` if any, `audienceLive`, `audienceBacklog`, sender display name if known from log/session joins.
- Reuse existing `POST /api/admin/moderation` with action `channel_mute` for mute/unmute from the UI (no duplicate mute endpoint required).

**Admin UI page.**

- New `/admin/chat` route and nav entry (system admin auth gate, same shell as feedback/rooms).
- Controls: time preset (7d default), room filter, wallet filter, global vs filtered mode.
- Table of messages; row expand for original text and audience lists.
- Row actions: mute/unmute, link to feedback list filtered by wallet, link to admin user/profile when available.

**Client.**

- Handle `chat_blocked_profanity` in the existing server error handler with a short system HUD message.

**Analytics.**

- Keep `ANALYTICS_EVENT_KINDS.chat` counting player chat sends after filtering (blocked-empty sends do not increment).

## Testing Decisions

Tests assert **external behavior at module boundaries**, not internal wiring, so refactors stay safe.

**Primary seam — profanity filter module (unit).**

- Pure functions: censor leaves clean text unchanged; known profanity becomes censored; all-profanity input yields empty censored string; custom list terms are caught; innocent substring matches behave consistently with library semantics (document any intentional allowlist cases).
- Username path still rejects profane names (regression via existing username policy tests updated to import shared module).
- Prior art: `server/test/usernamePolicy.test.ts`.

**Secondary seam — event log chat query (unit/integration with temp JSONL).**

- Given fixture JSONL files with `chat` and `chat_backlog_delivered` events, query returns correct messages for global, room, and wallet filters within time bounds.
- Audience aggregation correctly splits live vs backlog recipients; cap and empty windows return empty results.
- Prior art: patterns in `server/src/eventLog.ts` test helpers and analytics aggregation tests (`payoutAdminReporting.test.ts` uses temp dirs and env for `EVENT_LOG_DIR`).

**Not automated in v1 (manual acceptance).**

- `/admin/chat` page rendering, JWT gate, expand/toggle UX, mute button calling existing moderation API.
- End-to-end WebSocket chat censor + error code in browser.
- Performance of 30-day global scan on production-sized logs (note in ops docs if slow).

Gates: `npm run build`, `npm test -w server`.

## Out of Scope

- Retroactive message deletion or “unsend” from room history or other clients.
- Including NPC `bubbleOnly` chat or `SYSTEM` chat lines in admin history.
- Operator-editable profanity lists via `/admin/settings`.
- Analytics-admin tier access (read-only or otherwise) — system admin only.
- Separate chat database or search index (Elasticsearch, SQLite mirror); v1 is JSONL scan only.
- Profanity filtering in signboards, billboards, usernames beyond existing reject semantics, or other text surfaces.
- Localization of new error strings (English first).
- CSV/export download of chat logs.
- Reconstructing audience by inferring from `session_start`/`session_end` without explicit `chat_backlog_delivered` events (explicit replay logging is in scope instead).
- Changing chat backlog window/size for players (still 50 lines / 10 minutes unless separately requested).

## Further Notes

- Design decisions captured in a grill session (censor in flight, dual text in admin logs, shared expanded word list, explicit backlog audience logging, hybrid API + page, 7d/30d window, inline mute/links, system-admin-only, player chat only, reject when empty after censor).
- After implementation: update `docs/features-checklist.md`, operator-facing patch notes, and process docs for new event kinds and admin routes per repo maintenance rules.
- If 30-day global queries prove too slow in production, a follow-up issue can add day-indexed chat summaries without changing the v1 event schema.
