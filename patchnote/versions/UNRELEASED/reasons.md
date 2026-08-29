# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Free Play Field scoreboard: on narrow/touch layouts the in-room country ranking is a compact Scoreboard Chip (`1. {flag} {goals}`). Tap opens the Leaderboard Modal (full ranking, UTC reset note, yesterday's champion). Desktop panel still expands/collapses in place.

---

## By area

### Repo / docs

- `worldcup/CONTEXT.md` Scoreboard Chip / Leaderboard Modal. `docs/features-checklist.md` live field scoreboard HUD.

### Client

- Free Play Field **Scoreboard Chip** + **Leaderboard Modal** (`client/src/worldcup/scoreboard.ts`, `scoreboardView.ts`). Chip layout via `(max-width: 720px), (pointer: coarse)`. Android back closes the modal through `overlayBack`. Catalog keys `worldcup.scoreboardChipAria` / `scoreboardChipTitle` / `leaderboardTitle` / `leaderboardClose`.

### Server

- _(none in this change set)_

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
