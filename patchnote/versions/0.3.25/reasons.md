# Reasons — 0.3.25 (patch-notes version)

**Patch-notes version:** `0.3.25` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

**Nimiq Pay portrait-first HUD** for the mini-app WebView: orientation classes on `<html>`, adaptive letterbox/camera, spread build dock (bottom carousel + action bar; floating params left; hue ring + GL preview top-right), portrait top strip and action stack, compact rooms modal; dev `?payEmulate` stub. Minor Pay advisory copy refresh and LAN dev WebSocket origin fix.

---

## By area

### Repo / docs

- **`docs/build_menu.md`:** Nimiq Pay portrait spread layout reference + dev `?payEmulate` table.
- **`docs/features-checklist.md`:** Nimiq Pay portrait-first HUD checklist entry.

### Client

- **`client/src/ui/pseudoFullscreen.ts`:** Pay host/orientation classes (`nspace-nimiq-pay-host`, portrait/landscape); `syncNimiqPayOrientationClasses` on `visualViewport`; dev `initNimiqPayDevEmulation()` (`?payEmulate=portrait|landscape|1`).
- **`client/src/ui/hud.ts`:** Portrait Pay — `mountPayPortraitTopChrome` (Rooms under Return Home; player count / NIM / lobby inline on brand row); spread build dock DOM (`mountBuildDockContextColorSpread`, float vars); prefab tab hides color wheel + params panel; landscape keeps compact right rail.
- **`client/src/style.css`:** Portrait Pay letterbox, spread dock, top strip, rooms modal (capped height, current-room line under section title).
- **`client/src/main.ts`:** Rooms modal — `#rooms-modal-current-line` under `#rooms-list-heading`.
- **`client/src/ui/nimiqPayAdvisory.ts`:** Remove “not yet fully supported” line; icon-only social links with `aria-label`.
- **`client/src/net/apiBase.ts`:** RFC1918 / link-local hosts treated as local dev for `http`/`ws` scheme resolution (LAN Vite testing).
- **`client/public/nimiq-space.png`:** Brand asset added.

### Server

- _(none in this change set)_

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- No new env vars or migrations. Client-only release; redeploy static client / game server bundle as usual.
