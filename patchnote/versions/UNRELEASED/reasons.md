# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

- Header marquee (login-streak strip + admin announcement lines): after the player has seen every announcement line once, the client fades the strip out and suppresses it for 10 minutes unless the announcement text set changes (`client/src/ui/headerMarquee.ts`, `client/src/style.css`, `docs/features-checklist.md`).
- UI polish: main-menu login clarity, NIM claim bar timeout + fade, billboard context pills vs portal Enter, flex/hidden fixes for billboard action hit targets, `#app` Nimiq pseudo `pointer-events: none` so pill clicks match visible chrome (`client/src/ui/mainMenu.ts`, `client/src/main.ts`, `client/src/ui/hud.ts`, `client/src/style.css`).
- **`/patchnotes` page (`client/src/patchnotes/mountPatchnotesPage.ts`, `client/src/style.css`):** Version picker + audience-tier picker share one control row; one semver release visible at a time (replaces per-release `<details>` list). Scrollable note body uses **Muli-first** stack on `.patchnotes-page__list`. `defaultGlobalTierId` / `initialVisibleTierForRelease` return types aligned with `PATCHNOTE_TIER_ORDER`.
- **Docs / contributor workflow:** [docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md) *Release line* — explicit split between what `npm run prepare-merge` automates (semver + folder freeze) vs audience `public/*.md` authorship; [docs/reasons/reason_551903.md](../../../docs/reasons/reason_551903.md). [patchnote/README.md](../../README.md) prepare-merge row notes the same. [docs/features-checklist.md](../../../docs/features-checklist.md) patch-notes bullet updated. [AGENTS.md](../../../AGENTS.md) / [MEMORY.md](../../../MEMORY.md) — Cursor skills **`.cursor/skills/prepare-patchnotes-audience/`** (**PPA**), **`.cursor/skills/completed-feature-document/`** (**CFD**) for merge prep vs incremental `public/*.md` capture.
- **Rendering performance:** The client stops submitting full Three.js scene renders while the room is visually idle, renders again on scene / pointer / movement changes, disables WebGL antialiasing by default, and bypasses the legacy fog post-process path while fog is off (`client/src/game/Game.ts`, `client/src/main.ts`, `docs/build.md`). Temporary frame-attribution logging and Playwright perf harnesses used during diagnosis were removed before release.

---

## By area

### Repo / docs

- `docs/features-checklist.md` — documents client-side marquee suppress (`nspace.headerMarquee.newsSuppress`, 10-minute window, signature = ordered announcement lines); `/patchnotes` version + tier dropdowns and one-release view.
- `docs/THE-LARGER-SYSTEM.md` — *Release line* + *Public patch notes*: automation scope vs editorial `public/*.md`; changelog entry + `docs/reasons/reason_551903.md`.
- `patchnote/README.md` — prepare-merge row: script does not author/strip `public/*.md` placeholders; pointer to THE-LARGER-SYSTEM.
- `AGENTS.md`, `MEMORY.md` — `prepare-patchnotes-audience` skill (**PPA**) before `prepare-merge`; `completed-feature-document` (**CFD**) during work for incremental `public/*.md` updates.

### Client

- **Header marquee — read-once then cool down:** When the payload includes announcement lines (`newsMessages`), after one full cycle through all lines (streak+news rotation or news-only rotation), the `.hud-header-marquee-host` fades (`hud-header-marquee-root--fading`) and is hidden; `localStorage` stores suppress-until + message signature. Same lines within 10 minutes → stay hidden; any change to the ordered lines → show again. Streak-only mode (no lines) unchanged. Apply-generation guard avoids stale `transitionend` / timers writing suppress state after a newer `GET /api/header-marquee` apply.
- **Main menu (`client/src/ui/mainMenu.ts`, `client/src/style.css`):** Primary CTA “Enter game” (still “Add account” when cached sessions exist); line “Sign in with your Nimiq wallet”; `light-blue` + `main-menu__nq-btn--wallet-cta`; footer “Community” above social; social tiles demoted; actions column + hint under CTA.
- **NIM claim bar (`client/src/main.ts`, `client/src/ui/hud.ts`, `client/src/style.css`):** If not orthogonally adjacent to the clicked claimable block for **4.5s** (`NIM_CLAIM_AWAY_DISMISS_MS`), end UI with **~400ms** opacity fade (`setNimClaimProgress(null, { fadeOutMs })`, class `nim-claim-bar--fading`); fade timer cleared on new state / HUD destroy.
- **Billboard context floater (`client/src/ui/hud.ts`, `client/src/style.css`):** Edit / Move / Delete use `nq-button-pill` (+ `light-blue`); billboard-only `__actions` uses `flex: 0 0 auto` so shared `flex: 1 1 auto` does not stretch `<button>` hit boxes; billboard-only `.build-block-bar__advanced-toggle[hidden] { display: none !important }`.
- **Nimiq pill hit targets (`client/src/style.css`):** `#app` scope — `pointer-events: none` on `::before` / `::after` for `.nq-button-pill`, `.nq-button-s`, `.nq-button` (Nimiq Style negative insets on pseudos inflated hit-testing); supersedes duplicate rules that only targeted brand wallet + mode feedback pills.
- **`/patchnotes` (`client/src/patchnotes/mountPatchnotesPage.ts`):** `versionTag` / `versionTriggerLabel` (`LATEST NOTES vX.Y.Z` vs `NOTES vX.Y.Z` for older); `#patchnotes-version-*` + `#patchnotes-tier-*` listbox menus; `applyVisibleRelease`; shared document mousedown/keydown to close either menu; release bodies are `.patchnotes-page__rel-panel[data-version-idx]` (hidden panels). Meta line is client version only.
- **`/patchnotes` layout/CSS (`client/src/style.css`):** `.patchnotes-page__tier-row` `gap` + `flex-wrap`; `.patchnotes-page__rel-panel` replaces `.patchnotes-page__rel` / `<details>` chrome; `.patchnotes-page__list` sets Muli-first `font-family` for scrollable prose (badges/code stay Fira Mono).
- **Idle render gating (`client/src/game/Game.ts`, `client/src/main.ts`):** `Game.tick()` still advances movement, camera easing, overlays, and UI anchors every RAF, but full WebGL scene submission now happens only while visual state is dirty/active. Scene mutations, resize/zoom, pointer interactions, player movement, path fades, and floating text request a render window; idle rooms stop redrawing the unchanged scene. Fog remains available, but disabled fog now bypasses `FogOfWarPass.render()` and calls the normal scene render directly.

### Server

- _(none in this change set)_

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
