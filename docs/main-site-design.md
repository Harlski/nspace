# Main-site design system

This document describes **main-site** pages: HTML served from the game API host (e.g. `/analytics`, `/admin`, `/pending-payouts`) and related routes implemented in the server.

**Main-game** is the Nimiq Space SPA at **https://nimiq.space** (Vite bundle, HUD, WebSocket play). It does **not** use this shell; only reuse tokens informally if a screen should “feel related.”

---

## Goals

- One visual language for all main-site routes: dark canvas, **Muli** (Nimiq Style) + **Fira Mono** data, NIMIQ / SPACE brand header where appropriate.
- New pages should ship quickly by composing **shell + topbar + (optional) document title + content**, not one-off CSS.
- Prefer **CSS variables** and **`ms-` prefixed utility classes** over page-specific rules.
- **Unsigned** states should look intentional: same vertical rhythm as other gate-only screens, not an empty grid with only the topbar.

---

## Implementation map

| Piece | Server (canonical) | Client (Vite static pages) |
|--------|----------------------|----------------------------|
| Tokens + layout + tables + buttons + auth gate utilities | `server/src/mainSiteShell.ts` → `mainSiteShellCss()` | `client/src/mainSiteClient.css` (keep in sync when tokens change) |
| Nimiq Style fonts (Muli + Fira Mono) | `server/src/mainSiteTypography.ts` | Same `@import` + stacks in `mainSiteClient.css` |
| Brand row + `#authUser` | `server/src/analyticsTopbar.ts` + `server/src/mainSiteNav.ts` + `server/src/mainSiteAuthTopbar.ts` | `renderMainSiteTopbar()` in `client/src/ui/analyticsTopbar.ts` |
| Footer (X + Telegram + "Nimiq Space 2026") | `server/src/analyticsTopbar.ts` → `mainSiteFooterInnerHtml()`, injected on every page by `analyticsTopbarHtml()` | static `<footer class="ms-site-footer">` in `client/*.html`; CSS in `client/src/mainSiteClient.css` |
| Wallet “Signing in…” UI (spinner + cycling dots) | Inline markup + interval in server page scripts | `client/src/ui/walletSigningUi.ts` (`walletSigningMarkup`, `animateSigningDots`, `isSigningUserCancelledError`) |

---

## Layout modes

### 1. Signed in — full page

Use when the user has a valid session (or the page is public and needs no wallet).

1. **Top:** `${analyticsTopbarHtml("…")}` or equivalent — brand + grouped **nav dropdown** + `#authUser` (shared script fills Sign In / wallet menu on every route). Nav links are permission-gated; empty groups hide automatically. Categories: **Site** (Payouts, Advertise) and **Admin** (Admin, Analytics, System, Settings, Header, Feedback). Pages with custom sign-in UX may set `window.__nsMainSiteLoginClick` (to show an in-body signing spinner/gate); otherwise the topbar runs the default login for that route. **Signing itself must always go through `window.__nsMainSiteSignLoginPayload(nonce, message)`** (exposed by `mainSiteAuthTopbar.ts`) so every route picks the same signer: **Nimiq Pay** when the mini-app injected `window.nimiqPay`, otherwise **Nimiq Hub**. Do **not** import `@nimiq/hub-api` directly in a page login handler - that bypasses Nimiq Pay and is exactly the inconsistency this helper removes.
2. **Document title (optional but typical):** a single `<h1 class="ms-doc-title" id="…">Page name</h1>` for the **topic** of the route (e.g. “Payout queue”, “Admin”). Do **not** repeat the NIMIQ SPACE wordmark here.
3. **Auxiliary line (optional):** `<p class="ms-status …">` for loading / generated-at meta — keep short.
4. **Content:** panels (`ms-panel`), tables under `.ms-site`, toolbars (`ms-toolbar`), etc.

### 2. Unsigned — gate only (wallet required)

Use when the route expects a JWT and the user has not signed in (or you choose to show a single call-to-action instead of chrome).

1. **Top:** same **topbar** as above so **Sign in** stays in the header.
2. **Hide the document title:** set `hidden` on the page `<h1 class="ms-doc-title">` (e.g. `#adminDocTitle`) so the body is not “title + empty.” **Analytics** has no in-body doc title today; **Admin** hides “Admin” in unsigned gate-only mode **and** when the wallet is signed in but not allowed for that route (403 wallet denial — same as below).
3. **Hide noisy status lines** if they would still say “Loading…” (e.g. hide `#status` on analytics when there is no token).
4. **Single centered message** in the main content area, using:

```html
<div class="ms-auth-gate ms-auth-gate--standalone">
  <div class="ms-auth-gate-msg">You must be signed in.</div>
</div>
```

- **`ms-auth-gate`:** flexbox, centers copy horizontally (and vertically within its box).
- **`ms-auth-gate--standalone`:** taller minimum height (~`8rem`) so the block matches other gate-only pages (admin, analytics unsigned).
- **`ms-auth-gate-msg`:** typography from the shell (default color, same as headings — **not** red). Add **`err`** only for true failures (bad request, unexpected errors), **not** for “wallet not on the allow-list” (403) — see below.

After sign-in succeeds, **show** the doc title again and restore normal status/meta display.

### 3. Auth gate on an otherwise loaded page (e.g. analytics)

When the shell is shared with heavy content (charts) but **session expires (401)** or the user is **not signed in**, use **`#authGate`** with `showAuthGateMessage(msg, layout)` (this hides the main chart/grid until they sign in again):

- **`layout` omitted or `"default"`:** compact gate (e.g. “Your session has expired.”).
- **`layout === "standalone"`:** same tall gate as unsigned-only (use for **“You must be signed in.”** after Hub cancel and for **first visit with no token** on analytics).

Do **not** show a “Click to login” button in the body; sign-in is always from the **topbar**.

### 4. Wallet signed in but not allowed (403 — analytics, admin, future routes)

Use one **canonical user string** (exact copy) whenever the JWT is valid but the wallet is **not** on the allow-list for that activity:

> **Access denied for this wallet.**

**Layout and typography**

- **Message styling:** `ms-auth-gate-msg` **without** `err` — same neutral heading color as other gate copy (not red).
- **Analytics:** hide **time range** (`#timeFilterPanel`), **focus banner** (`#focusUser`), and **`#analyticsGrid`**. For standalone gates, set **`#authGate`**’s classes to **`ms-panel ms-mono`** (same outer shell as admin’s **`#panel`**) and put **`ms-auth-gate ms-auth-gate--standalone`** as the **direct** child — do **not** nest an extra inner `ms-panel` wrapper.
- **Admin (and similar non-chart pages):** hide the in-body doc title (`#adminDocTitle` or equivalent). Use **`ms-panel ms-mono`** (or `#panel` with that class) containing **`ms-auth-gate ms-auth-gate--standalone`** and the canonical string — same visual weight as analytics wallet denial.

**Implementation note:** server and client may throw a sentinel such as `NS_WALLET_ACCESS_DENIED` after a 403 response; map it in `catch` to the canonical string and layout above — do not surface raw API error text to the user for this case.

---

## Page skeleton (server-rendered)

1. **Head:** `mainSiteNimiqFontLinkTags()` (or `analyticsFontLinkTags()` alias), then `<style>` with:
   - `mainSiteTypographyCss()` (Muli / Nimiq Style stacks; Fira Mono for `.mono` / `.ms-mono`)
   - `mainSiteShellCss()`
   - `analyticsTopbarCss()` when using the topbar
   - Page-specific rules last (charts, grids, etc.)

2. **Body:** `class="ms-site"` or `class="ms-site ms-site--wide"` for analytics-width layouts (`max-width: 1120px`).

3. **Top:** `${analyticsTopbarHtml("route-key")}` — NIMIQ SPACE title + `#authUser`.

4. **Document title:** one `<h1 class="ms-doc-title" id="…DocTitle">…</h1>` when the signed-in page needs a clear name. **Hide** it in unsigned gate-only mode **or** wallet-denied admin (403, §4).

5. **Content:** wrap blocks in `ms-panel` where appropriate; tables live under `.ms-site` so default `th`/`td` shell styles apply, or add explicit classes if needed.

6. **Actions:** `ms-btn`, `ms-btn--ghost`, `ms-btn--primary` for consistency with payout queue / future forms.

7. **Links to explorers / docs:** `ms-link-expl`.

8. **Errors / meta copy:** `ms-err`, `ms-status`, `ms-summary` (use `var(--ms-muted)` inline where needed).

---

## Wallet sign-in UX

- All routes sign via **`window.__nsMainSiteSignLoginPayload(nonce, message)`**: inside Nimiq Pay it uses the injected provider (`window.nimiq.sign`, empty `signer`, `nimiqPayClient: true`); everywhere else it opens Nimiq Hub. This matches the main-game SPA (`client/src/auth/nimiq.ts`), so a player inside Nimiq Pay gets the Pay sign-in intent on `/`, `/payouts`, `/analytics`, and the admin pages alike.
- While the Hub (or Pay) prompt is open, show **`walletSigningMarkup()`** (client) or the same HTML in inline scripts: spinner + **“Signing in”** + live dots (`.` → `..` → `…` → `.`).
- **Hub cancel / closed connection:** do not show raw hub errors. Show **`You must be signed in.`** in a **standalone** `ms-auth-gate` (or reload to unsigned layout).
- **Other failures:** short copy such as **“Sign-in could not be completed.”** without a `Login failed:` prefix.

---

## Footer

Every main-site page ends with a shared footer: the **X** and **Telegram** icon links (previously in the topbar, top-right) plus a muted **"Nimiq Space 2026"** note, centered under a top border (`.ms-site-footer` / `.ms-site-footer__note`).

- **Server pages:** `analyticsTopbarHtml()` emits the footer inside a `<template id="msSiteFooterTpl">` at the top of the body and a tiny script appends it to `document.body` on `DOMContentLoaded`, so every current and future route that uses the topbar gets the same footer with no per-page markup. Edit the markup once in `mainSiteFooterInnerHtml()`.
- **Client static pages** (`payouts.html`, `admin.html`, `analytics.html`): the same `<footer class="ms-site-footer">` is authored directly before `</body>`; styles come from `client/src/mainSiteClient.css`.
- Do **not** put the social links back in the topbar header - they live in the footer now.

---

## CSS variables (reference)

Defined in `mainSiteShellCss()` / `mainSiteClient.css`:

- `--ms-bg`, `--ms-text`, `--ms-text-heading`
- `--ms-muted`, `--ms-muted-bright`
- `--ms-surface`, `--ms-surface-raised`, `--ms-border`, `--ms-border-soft`
- `--ms-accent`, `--ms-accent-hover-border`, `--ms-accent-tint`
- `--ms-link`, `--ms-err`

---

## Adding a new main-site route

1. Register the route in `server/src/index.ts` and return HTML from a small module (pattern: `analyticsPublicPage.ts`).
2. Import `mainSiteShellCss` + topbar helpers; use the skeleton above.
3. Choose **layout mode**: full page vs unsigned gate-only; wire **doc title** `hidden` if gate-only.
4. Reuse `POST /api/auth/verify` and `GET /api/auth/nonce` if the page needs wallet identity (same JWT as game and analytics login).
5. Update this doc with the path and purpose in one line.

---

## Main-game HUD cross-links

Tooltips or small CTAs that point to main-site pages should:

- Use **relative paths** (`/pending-payouts`) when the game is served from the same host as the API; otherwise configure the public base URL in the client build.
- Keep **copy on one line** with the link (e.g. “… by **playing Nimiq Space →**”) so the affordance reads as continuation, not a separate “modal section.”

---

## Checklist before merging a new main-site page

- [ ] `body.ms-site` (+ `--wide` if needed)
- [ ] Fonts: Muli + Fira Mono via `mainSiteNimiqFontLinkTags()` or `mainSiteClient.css` `@import`
- [ ] Brand topbar if the page is user-facing operator tooling
- [ ] If signed-in-only: `ms-doc-title` with stable `id` so scripts can hide it when unsigned
- [ ] Unsigned: **standalone** `ms-auth-gate` + hide doc title + no duplicate “Sign in” button in the body
- [ ] Tables/buttons use shell classes or live under `.ms-site` for table defaults
- [ ] No duplicate `:root { background }` that fights `--ms-bg`
