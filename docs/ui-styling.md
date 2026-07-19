# UI styling preferences (Nimiq Space)

Use this when adding HUD, overlays, modals, or in-game chrome so new work matches existing patterns and player expectations.

**Scope:** in-game SPA chrome only. Main-site pages use [main-site-design.md](main-site-design.md).

## Nimiq UI Kit (reference)

For **new** in-game buttons, inputs, notices, and similar controls, treat the **Nimiq UI Kit** as the authoritative design-system reference:

- Live demo: https://nimiqtoolbox.github.io/nimiq-ui-kit/
- Repo: https://github.com/NimiqToolbox/nimiq-ui-kit
- Agent text dump (prefer for lookup without a browser): https://github.com/NimiqToolbox/nimiq-ui-kit/blob/main/llms-full.txt

**How to use it**

- **Reference-first:** match control anatomy (hierarchy, labels, icons, states, spacing rhythm) from the kit. Do **not** add `@nimiq/vue-components` to the game HUD (vanilla TS/DOM).
- **Immersion wins:** keep the dark frosted HUD surfaces below. Do not paste kit marketing-page / light-product chrome onto the world overlay.
- **Reuse what we already ship:** when an existing `@nimiq/style` class fits (`nq-button-pill`, `nq-button-s`, etc.), prefer it over inventing a parallel control.

## Immersion and interaction

- **No accidental text selection** on menus, HUD labels, pill buttons, and overlay actions. Use `user-select: none` and `-webkit-user-select: none` on those surfaces (and on the menu container) so long-press / drag does not highlight label text.
- **Primary game canvas** should remain the focus; chrome should feel lightweight (translucent panels, subtle borders) and not compete with the world.

## Layout and responsive behavior

- **Prefer a single horizontal row** for top chrome when possible. If content does not fit (narrow phones), **shrink flexible regions first** (`min-width: 0`, `flex: 1 1 0`), then use **horizontal scroll inside the overcrowded segment** (e.g. toolbar only) with `overflow-x: auto` and hidden scrollbars—not wrapping the whole bar to a second line unless explicitly designed for that.
- Respect **`env(safe-area-inset-*)`** on full-width bars and fixed overlays (notches, home indicator).
- **`--hud-below-top-wrap`** (and similar layout tokens) must stay in sync with **actual** measured chrome height when changing top HUD structure.

## Visual language (current game HUD)

- **Surfaces:** Dark frosted panels `rgba(15, 17, 23, 0.82–0.97)`, `backdrop-filter: blur(8–10px)`, borders `rgba(61, 70, 90, 0.85–0.95)`.
- **Corners:** About **8–12px** `border-radius` on panels, pills, and context menus.
- **Shadows:** Soft elevation `box-shadow: 0 8px 24px` to `0 20px 50px rgba(0,0,0,0.45–0.55)` on overlays.
- **Typography:** **System UI** stack; **monospace** for wallet snippets; **tabular numerals** where numbers align (balances, timers).
- **Nimiq brand:** Title uses **white + orange** split (`main-menu__title-nimiq` / `main-menu__title-space`); keep contrast on busy 3D backgrounds (light text + light text-shadow on dark frosted bars).

## Overlays and modals

- **Backdrop:** Dimmed `rgba(0,0,0,0.55)` with light blur; dismiss on backdrop tap when appropriate.
- **Z-index:** Reserve high bands consistently (e.g. brand links `10001`, ephemeral context `10002`) and document jumps in this file when adding new layers.
- **Focus:** Move focus into dialogs on open; **Escape** closes one layer at a time (deepest first).

## Buttons and controls

- Prefer kit patterns for **new** controls (see Nimiq UI Kit above), adapted to the frosted HUD surfaces.
- **Icon buttons** (fullscreen, lobby): bordered `1px solid #3d465a`, `border-radius: 6px`, compact hit targets; preserve **44px minimum** touch targets where feasible (see mode segment buttons).
- **Pills** (`nq-button-pill`): Match Nimiq pill usage from `@nimiq/style` where applicable; keep padding readable on mobile.

## References in code

- Global HUD / chrome: `client/src/style.css` (`.hud-*`, overlays, context menus).
- HUD structure: `client/src/ui/hud.ts`.
- Letterbox / scaling: `layoutLetterbox` and `.game-frame` / `.letterbox` in the same stylesheet.

When in doubt, **match an existing component** in `style.css` rather than inventing a new visual system; when inventing, check the UI Kit first.
