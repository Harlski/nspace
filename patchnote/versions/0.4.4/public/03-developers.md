# Public patch notes — developers (`0.4.4`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [NEW] Module `server/src/playSpaceTemplate/` — Build Shell type, JSON store, admin routes; bootstrap default from legacy `playSpaceLayout`.
- [NEW] `DirectInviteRecord.templateId`; `ensurePlaySpaceLayout()` applies template shell per invite-lobby room.
- [NEW] Ephemeral edits: `canEditRoomContent` / block placement enabled in invite-lobby; teleporter/gate placement blocked; `worldPersistence` skips invite-lobby ids.
- [NEW] Client: admin template picker on Play Space create when multiple active templates; `createDirectInvite(token, { templateId? })`.
- [NEW] Chat moderation: shared `server/src/profanityFilter.ts` (usernames + chat); `chat_blocked_profanity` rejection; structured chat events in event log; `server/src/adminChatLog.ts` + browse APIs; client system notice on block.
- [NEW] Client invite UX: `client/src/invite/walletOnboarding.ts` (shared join-gate card for closed/expired guest flows + Get a Wallet overlay); `client/src/util/copyText.ts` for Share Panel clipboard fallback.
- [CHANGE] `server/src/adminRoomsPage.ts` — template create uses room dropdown + live preview iframe instead of free-text room id.
- [FIX] `client/src/invite/playSpaceLayout.ts` — case-sensitive 8-char slug join resolution (Rooms join-code regression).
- ADR: [worldcup/adr/0004-play-space-templates.md](../../../worldcup/adr/0004-play-space-templates.md).
