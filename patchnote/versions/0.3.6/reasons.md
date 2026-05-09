# Reasons — 0.3.6 (patch-notes version)

**Patch-notes version:** `0.3.6` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

- Header marquee (login-streak strip + admin announcement lines): after the player has seen every announcement line once, the client fades the strip out and suppresses it for 10 minutes unless the announcement text set changes (`client/src/ui/headerMarquee.ts`, `client/src/style.css`, `docs/features-checklist.md`).
- UI polish: main-menu login clarity, NIM claim bar timeout + fade, billboard context pills vs portal Enter, flex/hidden fixes for billboard action hit targets, `#app` Nimiq pseudo `pointer-events: none` so pill clicks match visible chrome (`client/src/ui/mainMenu.ts`, `client/src/main.ts`, `client/src/ui/hud.ts`, `client/src/style.css`).

---

## By area

### Repo / docs

- `docs/features-checklist.md` — documents client-side marquee suppress (`nspace.headerMarquee.newsSuppress`, 10-minute window, signature = ordered announcement lines).

### Client

- **Header marquee — read-once then cool down:** When the payload includes announcement lines (`newsMessages`), after one full cycle through all lines (streak+news rotation or news-only rotation), the `.hud-header-marquee-host` fades (`hud-header-marquee-root--fading`) and is hidden; `localStorage` stores suppress-until + message signature. Same lines within 10 minutes → stay hidden; any change to the ordered lines → show again. Streak-only mode (no lines) unchanged. Apply-generation guard avoids stale `transitionend` / timers writing suppress state after a newer `GET /api/header-marquee` apply.
- **Main menu (`client/src/ui/mainMenu.ts`, `client/src/style.css`):** Primary CTA “Enter game” (still “Add account” when cached sessions exist); line “Sign in with your Nimiq wallet”; `light-blue` + `main-menu__nq-btn--wallet-cta`; footer “Community” above social; social tiles demoted; actions column + hint under CTA.
- **NIM claim bar (`client/src/main.ts`, `client/src/ui/hud.ts`, `client/src/style.css`):** If not orthogonally adjacent to the clicked claimable block for **4.5s** (`NIM_CLAIM_AWAY_DISMISS_MS`), end UI with **~400ms** opacity fade (`setNimClaimProgress(null, { fadeOutMs })`, class `nim-claim-bar--fading`); fade timer cleared on new state / HUD destroy.
- **Billboard context floater (`client/src/ui/hud.ts`, `client/src/style.css`):** Edit / Move / Delete use `nq-button-pill` (+ `light-blue`); billboard-only `__actions` uses `flex: 0 0 auto` so shared `flex: 1 1 auto` does not stretch `<button>` hit boxes; billboard-only `.build-block-bar__advanced-toggle[hidden] { display: none !important }`.
- **Nimiq pill hit targets (`client/src/style.css`):** `#app` scope — `pointer-events: none` on `::before` / `::after` for `.nq-button-pill`, `.nq-button-s`, `.nq-button` (Nimiq Style negative insets on pseudos inflated hit-testing); supersedes duplicate rules that only targeted brand wallet + mode feedback pills.

### Server

- _(none in this change set)_

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
