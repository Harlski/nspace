# Public patch notes — developers (`0.3.6`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

_(Draft — not published.)_

- **Client header marquee (`mountHeaderMarquee`):** When `newsMessages` is non-empty, completing one full cycle through all lines triggers a CSS fade on `.hud-header-marquee-host` and `hidden` after transition. Suppress state: `localStorage` key `nspace.headerMarquee.newsSuppress`, JSON `{ until: epochMs, sig }` where `sig` is ordered lines joined with `\x1e`. While `now < until` and payload signature matches `sig`, the host stays hidden (polling unchanged). New or reordered lines change `sig` and clear the effective block. Streak-only payloads skip this path. `marqueeApplyId` invalidates in-flight fade completion if a newer `applyFromPayload` runs.

- **`setNimClaimProgress`** (`client/src/ui/hud.ts`): optional second argument `{ fadeOutMs?: number }` for opacity-dismiss; clears any in-flight fade timer on new state or HUD destroy.
- **NIM claim client loop** (`client/src/main.ts`): `NIM_CLAIM_AWAY_DISMISS_MS` (4500) + `notAdjacentSince`; `finish(true)` uses fade when auto-dismissing for “away too long”.
- **CSS:** Under `#app`, `pointer-events: none` on `::before` / `::after` for `.nq-button-pill`, `.nq-button-s`, and `.nq-button` (counter `@nimiq/style` negative-inset touch pseudos). Billboard: `.build-object-panel-context--billboard` rules for `__actions` flex shrink-wrap and `[hidden]` Advanced toggle.
