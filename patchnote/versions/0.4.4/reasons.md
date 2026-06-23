# Reasons — 0.4.4 (patch-notes version)

**Patch-notes version:** `0.4.4` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Play Space Templates (admin Build Shell library + default/archive/resync), ephemeral in-session co-building in Play Spaces, server-side chat profanity filter with admin chat log, and client/admin UX polish (guest wallet onboarding, Share Panel copy, template-create preview).

---

## By area

### Repo / docs

- `worldcup/adr/0004-play-space-templates.md` — ADR for template store, future-only resync, ephemeral edits vs guest confinement.
- `docs/features-checklist.md`, `docs/process.md` — template persistence path, admin API, ephemeral edits, chat moderation.
- `docs/prd/chat-moderation-and-admin-logs.md` — chat filter + admin log PRD.
- `worldcup/issues/100–105` — local implementation tracking (done).

### Client

- `client/src/invite/playSpaceTemplatePicker.ts` — admin-only template picker when multiple active templates exist.
- `client/src/invite/api.ts` — `createDirectInvite(token, { templateId? })`.
- `client/src/main.ts` — wires picker into both Play Space create paths; `chat_blocked_profanity` system notice; guest redirect to wallet onboarding on expired/closed/full play space.
- `client/src/invite/playSpaceLayout.ts` — case-sensitive 8-char slug join resolution (fixes Rooms join-code regression).
- `client/src/invite/walletOnboarding.ts` — shared join-gate card: `showGetWalletPrompt`, `mountGuestPlaySpaceClosedOnboarding`, Nimiq Pay store links, `clearGuestInviteCookie`.
- `client/src/invite/getWalletPrompt.ts` — re-exports from `walletOnboarding.ts`.
- `client/src/invite/joinGate.ts` — blocked/expired peek uses wallet onboarding card; clearer invalid-link copy.
- `client/src/invite/lobbyOverlay.ts` — room code/link as readonly inputs; `copyTextToClipboard` with select-on-fail.
- `client/src/util/copyText.ts` — clipboard API + textarea fallback.
- `client/src/style.css` — join-gate wallet onboarding, store badges, Share Panel field styles.

### Server

- `server/src/playSpaceTemplate/` — Build Shell extract/apply, JSON store (`play-space-templates.json`), admin HTTP routes.
- `server/src/directInvite/*` — `DirectInviteRecord.templateId`; create resolves default or admin-picked template.
- `server/src/rooms.ts` — template-driven `ensurePlaySpaceLayout`, ephemeral edit permissions, teleporter/gate placement blocked in invite-lobby; chat censor + structured chat events.
- `server/src/worldPersistence.ts` — skip persisting invite-lobby room ids.
- `server/src/profanityFilter.ts` — shared word list (chat + usernames).
- `server/src/adminChatLog.ts` — chat event store, browse APIs, audience replay.
- `server/src/adminChatPage.ts` — `/admin/chat` UI (search, detail, mute); auth-key alignment with other admin pages.
- `server/src/adminRoomsPage.ts` — Play Space templates tab (create with room picker + preview iframe, default, resync, archive).
- `server/src/eventLog.ts` — chat event type wiring.
- `server/src/index.ts` — admin chat HTTP routes.
- `server/src/usernamePolicy.ts` — uses shared profanity filter.
- `server/test/playSpaceTemplate.test.ts`, `server/test/profanityFilter.test.ts`, `server/test/adminChatLog.test.ts`.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
