# Reasons — 0.3.15 (patch-notes version)

**Patch-notes version:** `0.3.15` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

**[FIX]** Debug stats overlay (`.hud-debug`) no longer shows by default in dev builds; hidden until toggled from **your profile identicon**. Stats loop runs only while the panel is visible. **`?debug`** still opens it on load.

---

## By area

### Repo / docs

- _(none)_

### Client

- [client/src/ui/hud.ts](../../../client/src/ui/hud.ts) — `debugPanelVisible` / `debugPanelText`; `applyDebugPanelVisible`, `syncDebugPanelChrome`; `isDebugPanelVisible` / `setDebugPanelVisible` on HUD API; profile **`oppIdent`** click (self profile only) toggles panel; `.other-player-profile__identicon--debug-toggle`.
- [client/src/main.ts](../../../client/src/main.ts) — removed `import.meta.env.DEV` auto-show; debug stats update only when `hud.isDebugPanelVisible()`; `showDebug` init only for `?debug` query.
- [client/src/style.css](../../../client/src/style.css) — identicon debug-toggle cursor / focus ring.

### Server

- _(no changes)_

### payment-intent-service

- _(no changes)_

### Deploy / ops

- _(no changes)_
