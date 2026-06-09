# Public patch notes — developers (`0.3.25`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **[NEW]** Pay orientation — [`client/src/ui/pseudoFullscreen.ts`](../../../../client/src/ui/pseudoFullscreen.ts): `nspace-nimiq-pay-host`, `nspace-nimiq-pay-portrait` / `nspace-nimiq-pay-landscape` from viewport aspect (1280×720 threshold); `syncNimiqPayOrientationClasses` on `visualViewport` resize. Dev-only `initNimiqPayDevEmulation()` stubs `window.nimiqPay` when `?payEmulate=portrait|landscape|1` (ignored in production builds).
- **[NEW]** Portrait HUD — [`client/src/ui/hud.ts`](../../../../client/src/ui/hud.ts): `mountPayPortraitTopChrome`; spread build dock with reparented color column (`mountBuildDockContextColorSpread`) to escape params-panel `backdrop-filter` containing block; CSS float vars (`applyBuildDockSpreadFloatVars`); prefab tab hides color + context panels.
- **[CHANGE]** Rooms modal DOM — [`client/src/main.ts`](../../../../client/src/main.ts): `#rooms-modal-current-line` moved under `#rooms-list-heading`; portrait styles in [`client/src/style.css`](../../../../client/src/style.css).
- **[FIX]** [`client/src/net/apiBase.ts`](../../../../client/src/net/apiBase.ts): `isPrivateNetworkHostname` (RFC1918 / link-local) included in local-dev WebSocket scheme selection alongside localhost.
- **[CHANGE]** [`docs/build_menu.md`](../../../../docs/build_menu.md) — Nimiq Pay portrait spread layout + dev emulation query params.
