# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **`/patchnotes` (`client/src/patchnotes/mountPatchnotesPage.ts`):** Version + audience tier as separate listbox dropdowns; `applyVisibleRelease` toggles `.patchnotes-page__rel-panel`; tier visibility still `applyGlobalTier`; `defaultGlobalTierId` / `initialVisibleTierForRelease` typed to `(typeof PATCHNOTE_TIER_ORDER)[number]`; outside-click / Escape closes either open menu.
- **`/patchnotes` CSS (`client/src/style.css`):** `.patchnotes-page__list` uses Muli-first `font-family` for markdown body; `.patchnotes-page__rel-panel` replaces `<details>` list styling.
- **Rendering performance (`client/src/game/Game.ts`):** The client now gates full WebGL scene submissions on dirty/active visual state, requests short render windows for movement/pointer/scene changes, disables antialiasing by default, and bypasses the legacy fog pass while fog is off. Temporary frame-attribution logging and Playwright perf scripts were removed before release.
- **Docs:** [docs/THE-LARGER-SYSTEM.md](../../../../docs/THE-LARGER-SYSTEM.md) *Release line* / *Public patch notes* — automation vs editorial scope; [docs/reasons/reason_551903.md](../../../../docs/reasons/reason_551903.md). [patchnote/README.md](../../../README.md) prepare-merge row. [docs/features-checklist.md](../../../../docs/features-checklist.md) `/patchnotes` bullet.
- **Contributor cues:** [AGENTS.md](../../../../AGENTS.md) / [MEMORY.md](../../../../MEMORY.md) — `.cursor/skills/prepare-patchnotes-audience/` (**PPA**: pre-merge audience checklist), `.cursor/skills/completed-feature-document/` (**CFD**: incremental `UNRELEASED/public/*.md` during work).
