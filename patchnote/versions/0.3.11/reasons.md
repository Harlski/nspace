# Reasons — 0.3.11 (patch-notes version)

**Patch-notes version:** `0.3.11` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Terms/Privacy pages and versioned sign-in consent; main menu wallet UX (hex-first disclosure of the terms row, fade-in, tooltip on consent copy); optional server-side acknowledgement store and verify body extension. Player profile **rooms** list: live **`playerCount`**, busiest-first selection, Nimiq **`person-1`** icon in row meta, layout/spacing pass; HUD player pill shows **in-room / total** when they differ. UX polish: chat colour self-defended against Nimiq cascade, name-plate raycast pass-through, copy actions in chat / player context menus.

**Hotfix narrative (optional public tier):** [public/04-hotfix.md](public/04-hotfix.md) — scannable “what was wrong / what we patched / why now” for the corrective spine (chat, picks, lobby terms disclosure) without duplicating the full inventory below.

---

## By area

### Repo / docs

- `docs/process.md` — `TERMS_PRIVACY_ACCEPTANCE_STORE_FILE` / `LEGAL_CONSENT_STORE_FILE`; verify/consent notes as implemented.
- `docs/brainstorm/ux-polish-batch-2026-05.md` — batch ideation + value/effort take that motivated the easy-win pass below.
- `docs/features-checklist.md` — player profile rooms / HUD `playerCount` display / `GET /api/player-profile` `rooms[]` fields.

### Client

- Main menu (`client/src/ui/mainMenu.ts`, `client/src/style.css`): `/tacs` / `/privacy` links; terms checkbox gating before wallet sign-in; Nimiq outline hex + for primary and add-wallet; remove separate “Enter game” pill. **Disclosure + animation:** terms row stays `hidden` until the wallet hex (+), cached add-wallet hex, dev login, or re-login path primes consent; `display:flex` on `.main-menu__terms-privacy` no longer defeats the HTML `hidden` attribute (`[hidden]{display:none!important}` + `--disclosed` fade / `max-height` / `opacity`, `prefers-reduced-motion` fast path). **Tooltip:** single `#main-menu-terms-required-tooltip` in the terms row, positioned from `#main-menu-terms-privacy-text` (not the checkbox). Cached add-wallet clears the account pane when the default pane was hidden so the row is visible.
- Auth: `acceptedTermsPrivacyVersion` on verify; `terms_privacy_ack_required` / modal retry paths; local ack key for checkbox visibility.
- **Chat colour self-defence** (`client/src/style.css`): `.chat-log` / `.chat-line` (and inherited `.chat-line__prefix` / `.chat-line__body`) declare their own `color: #e8eaef` so the Nimiq stylesheet ending in `body { color: var(--nimiq-blue) }` no longer turns chat black on dark panels under bundler load orders that put the Nimiq sheet last. Comment in `client/src/nimiqRootRemReset.css` updated to note the layered defence.
- **Name-plate raycast pass-through** (`client/src/game/Game.ts` `createNameLabelSprite`): the avatar name `Sprite` now carries `userData[SKIP_BLOCK_PICK_AND_BOUNDS] = true` and a no-op `raycast`, so it does not steal touch / right-click picks aimed at the geometry behind it. Closes a class of misclicks where tapping a player whose nameplate visually overlaps a mineable block opened the player profile menu (touch path `pickClosestAvatarGroupAt` runs first in `onPointerDown`; right-click path `onCanvasContextMenu` likewise picked the nameplate sprite as the avatar hit). Avatar identification still works because the body mesh remains pickable. `SKIP_BLOCK_PICK_AND_BOUNDS` JSDoc widened from "placed-block VFX" to cover any decorative child of an authoritative group, with a pointer to the principle in `docs/THE-LARGER-SYSTEM.md` ("Client-only visuals on authoritative world objects").
- **Context-menu copy actions** (`client/src/ui/hud.ts`):
  - Chat-line context menu (right-click on a chat row) now lists **View profile** · **Copy message** · **Translate**. `Copy message` writes the raw message body (already cached on `dataset.chatTranslateText`) via `navigator.clipboard.writeText`, idiomatic silent copy matching the existing `oppCopyAddressBtn` pattern.
  - Player context menu single-target now lists **View profile** + **Copy wallet** (multi-target picker unchanged). `Copy wallet` uses the same address already stamped on the View row when the menu opens, so there is one source of truth.
  - All new rows use single verb-phrase labels per the in-world UI principle in `docs/THE-LARGER-SYSTEM.md` ("In-world UI copy stays idiomatic").
- **Profile discovery from streaks** (`client/src/ui/headerMarquee.ts`, `client/src/ui/hud.ts`, `client/src/style.css`): login-streak names in the top marquee are now focusable/clickable and open the same player profile card used by avatar/chat interactions.
- **Profile room lists** (`client/src/ui/hud.ts`, `client/src/style.css`, `client/src/main.ts`): profile cards include a compact **Rooms** section (≤3). Row meta is **`{playerCount}` + `person-1`** inline SVG via `nimiqIconifyMarkup` (Iconify `i-nimiq:person-1`); join codes removed from row meta; private still labelled. **HUD** `setPlayerCount`: visible badge shows `room/total` when counts differ; tooltip unchanged. Layout/spacing pass on `.other-player-profile*` (dialog padding, `card-main` `flex-start`, identicon 76px, footer border, room row density).
- **Admin profile controls** (`client/src/ui/hud.ts`, `client/src/ui/nimiqIcons.ts`, `client/src/style.css`): admin-only profile actions moved into a compact Actions dropdown; admin username assignment now uses the same inline name edit affordance as self profiles, with an `i-nimiq:check` icon button for saving.

### Server

- `POST /api/auth/verify` — `acceptedTermsPrivacyVersion`; persistence via `termsPrivacyAcceptanceStore` (default `server/data/terms-privacy-acceptance.json`, legacy merge).
- Express GET `/tacs`, `/privacy`; HTML surfaces (payouts, admin, analytics) inject browser verify snippet where applicable.
- `GET /api/player-profile/:address` — `rooms[]` from `listRoomsOwnedBy` (public for everyone; private only for owner or admin bearer): each entry includes **`playerCount`** via exported **`getLiveRealPlayerCountInRoom`** (`server/src/rooms.ts`); response sorted by **descending `playerCount`** then name/id, then **`.slice(0, 3)`**. Official/admin-created rooms stay omitted from player-owned lists.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- Static deploys should expose `/tacs` and `/privacy` consistently with the game origin when using split hosting.
