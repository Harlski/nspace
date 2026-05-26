# Reasons — 0.3.18 (patch-notes version)

**Patch-notes version:** `0.3.18` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

**[FIX]** Expired cached-account **Re-login** — terms consent moves into the account panel (replaces **Expired** on first Re-login click); full Terms/Privacy label with reserved red asterisk; second click respects checkbox and starts wallet sign-in (no forced uncheck).

**[FIX]** Plain-cube visuals — rotated cubes stay on individual meshes (not instanced batch); stacked instanced cubes bias depth so the lower block keeps its color at overlap; selection outline follows cube rotation.

---

## By area

### Repo / docs

- _(none)_

### Client

- [client/src/ui/mainMenu.ts](../../../client/src/ui/mainMenu.ts) — movable terms row (`#main-menu-terms-privacy-host-default` / `#main-menu-terms-privacy-host-account`); `expiredReloginTermsPrompt`; `discloseExpiredReloginTerms` / `shouldShowExpiredAccountTerms`; Re-login validates checkbox then `runNimiqWalletSignIn`; removed tooltip error copy.
- [client/src/style.css](../../../client/src/style.css) — account-panel terms host, `--needs-ack` checkbox highlight, asterisk reserved via `visibility` (no layout shift).
- [client/src/game/Game.ts](../../../client/src/game/Game.ts) — exclude rotated plain cubes from instancing; per-`wyLevel` instance batches + `polygonOffset` on upper layers; selection outline rotation for plain cubes.

### Server

- _(none)_

### payment-intent-service

- _(none)_

### Deploy / ops

- **Client-only** visual/login UX; ship an updated client build. No server or env changes.
