# Reasons — 0.3.23 (patch-notes version)

**Patch-notes version:** `0.3.23` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Fix room registry v6 reload dropping `deletedAt` / `isPublic`; require an explicit room name when players create a room. **Session resume:** reconnect within 10 minutes restores last room and walkable tile; otherwise chamber default; invalid room/tile falls back to chamber. **Chat context menu:** right-click chat lines → View Profile, Report Message (other players), More → Copy Message / Translate. **Feedback v2:** persisted tickets + threads, `/admin/feedback` (submitter identicons), in-game unread badge on top-bar profile + profile Feedback button, overlay header UX polish, optional NIM reward on integrated tickets. **Usernames:** login prompt with five deferrals, profanity/reserved-name policy (`bad-words`), top-bar display name, 24h change cooldown while a custom name is set, admin clear + username-set ban behavior; prompt UI (0.5s loader, identicon, minimal copy, defer count under input); gate fixes for cached Enter, username-prompt route order, and modal dismiss on defer.

---

## By area

### Repo / docs

- **`docs/features-checklist.md`:** Username prompt at login, policy, admin clear / ban behavior.
- **`server/package.json`:** dependency **`bad-words`**.

### Client

- **`client/src/main.ts`:** Create-room modal no longer pre-fills a default name; client validation requires a non-empty name before `createRoom` is sent; name input has placeholder text.
- **`client/src/main.ts`:** Initial login and **Reconnect** call `connectToRoom(..., { resume: true })`; intentional travel (doors, Return Home, idle chamber return, stream mode) still passes explicit room + spawn hints.
- **`client/src/main.ts`:** `runUsernamePromptGate` before `enterGame` on login/reconnect; `hud.setBrandLinksPlayerDisplayName` from welcome `self.displayName`.
- **`client/src/net/ws.ts`:** `ConnectGameWsOptions.resume` sets WebSocket query `resume=1` and omits `sx`/`sz`.
- **`client/src/auth/nimiq.ts`:** `VerifyAuthResponse.usernamePrompt`; `UsernamePromptStatus` type.
- **`client/src/auth/usernamePromptGate.ts`:** Fetches prompt status on every gate (login + cached Enter); network failure → status error modal with Retry/Cancel (no silent skip).
- **`client/src/auth/usernameConstants.ts`:** Client-side username format rules (mirrors server).
- **`client/src/ui/usernamePromptModal.ts`:** Blocking login modal — 0.5s Nimiq hex loader (`USERNAME_PROMPT_LOAD_MS`), then identicon (80px), centered **Pick a username**, input, **Defers Remaining** under field, Save / Not now; `closed` flag fixes dismiss while API in flight; `showUsernamePromptStatusErrorModal` for fetch failures.
- **`client/src/ui/mainMenu.ts`:** Async `onLoggedIn` / `onReconnect`; passes `usernamePrompt` from verify response.
- **`client/src/ui/hud.ts`:** Top bar shows custom username (`.hud-player-bar__addr--username`); `setBrandLinksPlayerDisplayName`; profile username save updates top bar; error labels for `username_profanity` / `username_restricted`.
- **`client/src/style.css`:** `.username-prompt-*` modal styles; `[hidden]` overrides for loader/content panels (author `display:flex` vs HTML `hidden`); top-bar username label styling.
- **`client/src/game/constants.ts`:** Comment updated — default room id is a hint; server may override when `resume=1`.
- **`client/src/ui/worldContextMenu.ts`:** `WorldContextMenuItem` optional `children` for nested submenu rows; fixed-position flyout beside trigger (flip when near viewport edge); hover/focus open, click toggle on coarse pointer.
- **`client/src/ui/hud.ts`:** `openChatLineContextMenu` — top-level View Profile, Report Message (hidden for self), More submenu with Copy Message + Translate; report opens `showFeedbackOverlay({ title: "Report message", prefill })` with player/wallet/message template → `POST /api/feedback` with `source: "report"`. Feedback overlay v2: **New** / **My feedback** tabs (centered header), thread view, `setFeedbackHandlers`; unread dot on top-bar `.hud-player-bar__ident-wrap` + profile **Feedback** button (`syncFeedbackUnreadBadge`, poll 45s); opening feedback closes profile card.
- **`client/src/style.css`:** `.other-player-ctx__submenu*` styles for chat More flyout; `.feedback-overlay__*` for ticket list, thread, centered tab header grid; `.hud-player-bar--feedback-unread` identicon dot; themed scrollbars on feedback list/thread.
- **`client/src/main.ts`:** `setFeedbackHandlers` — create/list/get/reply against feedback APIs.

### Server

- **`server/src/usernamePolicy.ts`:** Alphanumeric 1–12 validation; **`bad-words`** `Filter.isProfane`; reserved staff/brand names (`username_restricted`).
- **`server/src/playerProfileStore.ts`:** `usernamePromptDeferCount`; `getUsernamePromptStatus`, `recordUsernamePromptDeferral`, `playerHasCustomUsername`; `adminClearPlayerUsername` resets defer count + cooldown metadata; prompt skipped when `isUsernameSetBanned`; cooldown only when changing existing custom name.
- **`server/src/adminRuntimeSettingsStore.ts`:** Default **`playerUsernameSelfServiceEnabled: true`**.
- **`server/src/index.ts`:** `GET /api/player-profile/username-prompt`, `POST /api/player-profile/username/defer` registered **before** `GET /api/player-profile/:address` (Express was matching `username-prompt` as a wallet id); `PUT /api/player-profile/username` — first set when `!hasCustom` bypasses self-service gate and cooldown; auth verify includes `usernamePrompt` when needed.
- **`server/test/playerProfileStore.test.ts`:** Admin clear + cooldown behavior.
- **`server/test/usernamePolicy.test.ts`:** Policy unit tests.
- **`server/src/roomRegistry.ts`:** `loadRoomRegistry` now reads `isPublic` for `version >= 3` and `deletedAt` for `version >= 4` (previously stopped at v5, while `persistRoomsFile` writes v6). Root cause of deleted/private player rooms reverting after deploy/restart.
- **`server/src/rooms.ts`:** `createRoom` WS handler rejects missing/blank `displayName` (removed `defaultRoomDisplayName` fallback); unused import removed.
- **`server/src/playerLastSessionStore.ts`:** New JSON store (`data/player-last-sessions.json` by default) per wallet: `{ roomId, x, z, y?, disconnectedAt }`; `PLAYER_RECONNECT_GRACE_MS` = 10 minutes.
- **`server/src/rooms.ts`:** `resolveResumeLogin(address)` — within grace window, valid room + walkable tile → last position; else chamber default spawn. Saves last session on WS `close` (non–stream-observer).
- **`server/src/index.ts`:** WebSocket `resume=1` query param calls `resolveResumeLogin` before `addClient` (ignored for stream observer sessions).
- **`server/src/feedbackTicketStore.ts`:** JSON ticket store (`FEEDBACK_STORE_FILE`); kinds, statuses, threaded messages, daily new-ticket cap, `lastReadAtMs` + unread detection, `wallet` on player/admin ticket summaries, reward metadata.
- **`server/src/adminFeedbackPage.ts`:** `/admin/feedback` HTML shell — inbox → detail (not side-by-side), newest messages first, submitter identicon + wallet (`hydrateIdenticons` → `GET /api/identicon/:wallet`), status/reply/NIM reward; auth gate + reply `Authorization` header merge fix.
- **`server/src/index.ts`:** Player feedback routes + admin `GET/PATCH/POST` feedback APIs; Telegram ping on create (optional).
- **`server/src/analyticsTopbar.ts`:** Nav link **Feedback** for admin pages.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- **Usernames:** existing `player-profiles.json` gains optional `usernamePromptDeferCount`; no migration required. Optional env **`PLAYER_PROFILE_STORE_FILE`**. Admin runtime default for self-service usernames is **on** for fresh `admin-runtime-settings.json`; existing settings files unchanged on disk.
- **Vercel / split SPA:** [`vercel.json`](../../../vercel.json) + [`client/vercel.json`](../../../client/vercel.json) — **`/admin/feedback`** rewrite to API host (HTML shell); JSON APIs under **`/api/feedback/*`**, **`/api/admin/feedback/*`**, **`/api/player-profile/username-prompt`**, **`/api/player-profile/username/defer`** covered by existing **`/api/:path*`** rewrite.
- No migration: existing `server/data/rooms.json` v6 files already contain correct `deletedAt` / `isPublic`; they were ignored on load until this fix. Next restart after deploy should restore intended room visibility and soft-delete state.
- **Session resume:** new optional env `PLAYER_LAST_SESSION_STORE_FILE` (default `server/data/player-last-sessions.json`). File is created on first disconnect; safe to back up with other server JSON state. No compose changes.
