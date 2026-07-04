# Public patch notes — developers (`0.5.5`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

## Consistent wallet sign-in across every main-site route

Main-site pages (`/payouts`, `/analytics`, and the admin pages) had their own inline sign-in handlers that imported `@nimiq/hub-api` directly and always went through Nimiq Hub. Inside Nimiq Pay this was the wrong intent - only the main game and the shared topbar detected the mini-app.

Sign-in is now routed through a single helper, `window.__nsMainSiteSignLoginPayload(nonce, message)` (exposed by `server/src/mainSiteAuthTopbar.ts`). It uses the Nimiq Pay provider when the host injected `window.nimiqPay`, and Nimiq Hub otherwise, returning the base `POST /api/auth/verify` payload. Pages keep their own in-body "Signing in" UI via `window.__nsMainSiteLoginClick`, but delegate the actual signing to the shared helper.

If you add a main-site login handler, call `window.__nsMainSiteSignLoginPayload(...)` - do not import `@nimiq/hub-api` directly. A shared footer (`mainSiteFooterInnerHtml()`, injected by `analyticsTopbarHtml()`) is now appended to every topbar page, so social links live in the footer rather than the header.

## Private whispers (WoW-style 1:1 messaging)

A new `whisper` WebSocket message type adds targeted private messaging, separate from the room-broadcast `chat`.

- **Client → server** (`sendWhisper` in `client/src/net/ws.ts`): `{ type: "whisper", text, ... }` with exactly one target - `toName` (a globally-unique custom username), `toAddress` (an exact wallet, used by right-click and the composer picker), or `reply: true` (the server-tracked last partner, for `/r`).
- **Server → client** (`server/src/rooms.ts`): `{ type: "whisper", direction: "in" | "out", partnerAddress, partnerName, text, at }`. It is delivered only to the recipient (`direction: "in"`, partner = sender) and echoed to the sender (`direction: "out"`, partner = recipient) - **never broadcast, no 3D bubble**.
- **Routing/eligibility:** cross-room via `findConnByWallet`; **online-only** and **wallet players only** (no `guest:` senders/targets); no self-whisper. Failures come back as `{ type: "error", code }` with `whisper_offline`, `whisper_no_target`, `whisper_no_reply_target`, `whisper_self`, or `whisper_guest`. Whispers reuse chat's profanity censor, 256-char cap, channel-mute, and the shared `RATE_CHAT_MS`.
- **Composer UX:** the chat field now has a WoW-style **destination label** (`Say:` vs `{name}:`) that is authoritative for where a message goes. `Tab` / `Shift+Tab` cycle it through Say + recent partners; tapping it opens a recipient typeahead (also opened by `/w` / `/whisper` / `/tell` to filter, or `/r` / `/reply`). Ranking/cycling live in a pure, tested module `client/src/ui/whisperRecipients.ts` (`rankWhisperCandidates`, `cycleWhisperDestination`, `compactWhisperAddress`); the HUD feeds it the room roster via `hud.setWhisperRosterProvider(() => ({ players, selfAddress }))` and tracks recent partners internally. (This replaces the earlier chip/× prototype.)
- **Moderation:** successful whispers log a `whisper` gameplay event (`ANALYTICS_EVENT_KINDS.whisper`) with censored text (and original when filtered) for admin history; received whispers are reportable via the existing Report Message flow.

## Presence feed replaces the join toast

`hud.showPlayerJoinedToast(address)` is gone. Use `hud.showPresenceEvent("enter" | "left", { address, displayName? })` to push transient lines into a capped presence feed above the chat, and `hud.clearPresenceFeed()` on room switch. `main.ts` now emits both `playerJoined` (enter) and `playerLeft` (left), skipping self and NPCs. `hud.openPlayerProfile(address, displayName?)` is exposed so non-HUD UI (the rooms preview owner button) can open a profile. The standalone top-toolbar Rooms button was removed - Rooms opens from the HUD menu action and the `O` shortcut.

## WebGL context lifecycle fix

`Game.dispose()` (and inspector-preview teardown) now call `renderer.forceContextLoss()` and detach `renderer.domElement` in addition to `renderer.dispose()`. `dispose()` alone leaves the underlying WebGL context alive until GC, so short-lived per-preview `Game` instances (room-catalog preview) accumulated live contexts until the browser evicted the oldest - the real game canvas - leaving it permanently black. If you create throwaway `Game`/renderer instances, force context loss on teardown.

## Room catalog preview: spatial (Pixel) rooms

`client/src/ui/roomCatalogPreview.ts` now detects spatial rooms (whose snapshots omit floor tiles) and, for Pixel, renders a top-down 2D crop of the live board raster (`/pixels.png`) centered on the join spawn instead of an empty 3D scene - which also avoids spending a WebGL context on an empty preview.

## Free Play Field payout badge threshold

The `mining-paid-in-full` achievement is renamed to **"98% is good enough"** and its unlock now requires `decision.amountLuna >= PAID_IN_FULL_MIN_LUNA` (`LUNA_PER_NIM * 98 / 100`, i.e. 0.98 NIM). A goal payout can net slightly under 1 NIM after network-fee rounding, which left the previous "≥ 1 NIM" badge unreachable.
