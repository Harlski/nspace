# Reasons — 0.5.5 (patch-notes version)

**Patch-notes version:** `0.5.5` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Private **whispers** (WoW-style 1:1 messaging) with a destination-label composer, Tab-cycling, and a recipient picker; a **presence feed** for players entering/leaving; a shared **footer + consistent wallet sign-in** across every main-site route; rooms-catalog polish (owner avatar, inline close, back-button support, Pixel raster preview); a **WebGL context-leak fix** that could black out the game canvas; and the Free Play Field payout badge retuned to **"98% is good enough" (≥ 0.98 NIM)**.

---

## By area

### Repo / docs

- `docs/main-site-design.md`: documented that every main-site route must sign via the shared `window.__nsMainSiteSignLoginPayload(nonce, message)` (Nimiq Pay when `window.nimiqPay` is present, else Hub) and must not import `@nimiq/hub-api` directly in a page login handler.
- `docs/main-site-design.md`: added a **Footer** section and implementation-map row - social links moved from the topbar to a shared footer (`mainSiteFooterInnerHtml()`) with a "Nimiq Space 2026" note.
- `docs/features-checklist.md`, `docs/process.md`: documented private **whispers** - the `whisper` in/out message types, target resolution (`toName` custom-username-only / `toAddress` / `reply`), online-only + wallet-only eligibility, WS error codes, shared chat censor/cap/rate-limit, and the `whisper` analytics event.

### Client

- `client/payouts.html`, `client/admin.html`, `client/analytics.html`: removed the X/Telegram social links from the header topbar and added a shared `<footer class="ms-site-footer">` (social links + "Nimiq Space 2026") before `</body>`.
- `client/src/mainSiteClient.css`: added `.ms-site-footer` / `.ms-site-footer__note` styles (centered column under a top border).
- `client/src/net/ws.ts`: added the `whisper` `ServerMessage` variant and `sendWhisper(ws, { toName | toAddress | reply }, text)`.
- `client/src/main.ts`: routes chat-input Enter to the active whisper target (`sendWhisper` with `toAddress`) or public chat, keeps focus while a sticky target is active, renders incoming `whisper` messages, wires the whisper recipient roster provider (`hud.setWhisperRosterProvider` from `lastPlayers` + `selfAddress`), and shows system-line copy for the whisper error codes (`whisper_offline` / `whisper_no_target` / `whisper_no_reply_target` / `whisper_self` / `whisper_guest`).
- `client/src/ui/whisperRecipients.ts` (new) + `client/src/ui/whisperRecipients.test.ts` (new): pure recipient-ranking module for the composer typeahead - `rankWhisperCandidates` (recent partners first, then room-only players, alphabetical, case-insensitive name prefix, self excluded, address-keyed so picks are unambiguous), `cycleWhisperDestination` (Tab ring `[Say, ...recent partners]`), and `compactWhisperAddress`.
- `client/src/ui/hud.ts`: reworked the whisper composer into a WoW-style **destination label** on a unified chat field - `chat-dest-label` shows `Say:` (public) or `{name}:` (whisper); **Tab / Shift+Tab** cycle the label through Say + recent partners; tapping it opens a **recipient typeahead picker** (`whisper-picker`, with a pinned "Say (public)" row) also opened by typing `/w`, `/whisper`, `/tell` (filter-as-you-type) or `/r`, `/reply` (last partner, else picker). Replaced the old chip/× design (no pill, no × button; Escape or Backspace-on-empty snaps back to Say). Added `appendWhisper` (inline "To Name:" / "Name whispers:" lines), `getWhisperTarget` / `clearWhisperTarget` / `setWhisperRosterProvider`, internal recent-partner tracking (last 24, updated on send and receive), **Whisper**/**Reply** items on the avatar and chat-line context menus (target the exact wallet so default-named players are reachable), and an unread accent for incoming whispers (world tab + minimized restore button).
- `client/src/ui/hud.ts`: replaced the single "player joined" toast with a transient **presence feed** ("kill feed") above the chat - `showPresenceEvent("enter" | "left", { address, displayName })` and `clearPresenceFeed()`; each line shows an identicon, a direction arrow (→ enter / ← left), the name, and "entered"/"left"; capped at 4 lines with a 4s dwell then fade, cleared on room switch / teardown. Also removed the standalone top-toolbar **Rooms** button (Rooms now opens from the HUD menu action and the **O** shortcut) and added `openPlayerProfile(address, displayName?)` so external UI (rooms preview) can open a profile.
- `client/src/main.ts`: pushes `playerJoined` → presence "enter" and `playerLeft` → presence "left" (skips self and NPCs), and calls `hud.clearPresenceFeed()` on room welcome.
- `client/src/main.ts`, `client/src/style.css`: rooms catalog modal polish - an **inline close button** in the catalog head (`rooms-modal__catalog-head` / `rooms-modal__close--inline`), a **room owner identicon button** in the preview pane (`rooms-preview-owner`) that opens the owner's profile via `hud.openPlayerProfile`, removal of the public-build-gate hint from the preview meta and the pick list, and **browser / mobile back button** support via `overlayBack.push("rooms", …)` mirroring the Escape hierarchy (create form → edit view → close).
- `client/src/game/Game.ts`: on `dispose()` and inspector-preview teardown, call `renderer.forceContextLoss()` (and detach `renderer.domElement`) in addition to `renderer.dispose()`. `dispose()` alone leaves the WebGL context alive until GC, so short-lived per-preview `Game` instances (e.g. the room-catalog preview) piled up live contexts until the browser evicted the oldest one - the real game canvas - turning it permanently black. Forcing context loss frees it immediately.
- `client/src/ui/roomCatalogPreview.ts`: spatial rooms (Pixel) strip floor tiles from the preview snapshot, so instead of an empty 3D scene they now render a top-down 2D crop of the live board raster (`/pixels.png`) centered on the join spawn (`SPATIAL_PREVIEW_WINDOW_TILES` window, void margin filled from the room background hue). This also avoids spending a WebGL context on a preview that would show nothing.
- `client/src/ui/mainMenu.ts`: the dev intent-log summarizer now renders `whisper` payloads (`→ target: "text"`).
- `client/src/style.css`: added `.chat-field` / `.chat-dest-label*`, `.whisper-picker*`, `.chat-line--whisper*` (distinct tint), `.hud-presence-feed*`, rooms catalog head / inline-close / preview-owner styles, and `.chat-row__restore--has-unread`.

### Server

- `server/src/analyticsTopbar.ts`: removed the X/Telegram social links from the topbar header; added `mainSiteFooterInnerHtml()` + a `<template>`/`DOMContentLoaded` injector so `analyticsTopbarHtml()` appends the same footer (social links + "Nimiq Space 2026") to every main-site page (payouts, analytics, advertise, and all admin routes); added `.ms-site-footer` CSS to `analyticsTopbarCss()`.
- `server/src/mainSiteAuthTopbar.ts`: extracted a shared, Nimiq-Pay-aware login signer `window.__nsMainSiteSignLoginPayload(nonce, message)` (Pay provider vs Hub) and routed the topbar's `defaultWalletLogin` through it (removed the duplicate `nimiqPayWalletLogin`).
- `server/src/pendingPayoutsPublicPage.ts` (`/payouts`), `server/src/analyticsPublicPage.ts` (`/analytics`), `server/src/analyticsAdminPage.ts` (analytics admin), `server/src/adminRoomsPage.ts` (rooms admin): their custom in-body sign-in handlers previously imported `@nimiq/hub-api` directly and always used Hub, so players inside Nimiq Pay got the wrong sign-in intent on these non-root routes. Now they call the shared signer, matching the main-game SPA and the topbar default.
- `server/src/rooms.ts`: added the private **`whisper`** handler + `OutMsg` variant (`direction: "in" | "out"`, `partnerAddress`, `partnerName`, `text`, `at`) and a `lastWhisperPartner` field on `ClientConn`. Whispers are server-routed to a single recipient (never broadcast, no 3D bubble), resolved by custom username (`toName`), exact wallet (`toAddress`, from right-click / chip), or last partner (`reply`, tracked on both sides for `/r`). Online-only + wallet-only with error codes `whisper_offline` / `whisper_no_target` / `whisper_no_reply_target` / `whisper_self` / `whisper_guest`; reuses chat's profanity censor, 256-char cap, channel-mute, and shared `RATE_CHAT_MS`.
- `server/src/playerProfileStore.ts`: added `findWalletByCustomUsername(name)` (case-insensitive) so `/w name` resolves only globally-unique custom usernames.
- `server/src/eventLog.ts`: added `ANALYTICS_EVENT_KINDS.whisper` (`"whisper"`); successful whispers log censored `text`, optional `textOriginal`, `fromName`, `toAddress`, `toName`, and `at` for moderation/report parity with public chat.
- `server/src/achievementDefinitions.ts`, `server/src/rooms.ts`, `server/test/achievementStore.test.ts`: renamed the Free Play Field payout badge `mining-paid-in-full` from **"Paid in Full"** (receive ≥ 1 NIM) to **"98% is good enough"** (receive ≥ 0.98 NIM), and gated the unlock on `decision.amountLuna >= PAID_IN_FULL_MIN_LUNA` (`= LUNA_PER_NIM * 98 / 100`). A goal payout that nets slightly under 1 NIM (network-fee rounding) previously left the badge unreachable; 0.98 NIM makes it attainable while still requiring a full-value goal.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
