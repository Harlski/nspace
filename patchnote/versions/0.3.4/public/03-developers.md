# Public patch notes — developers (`0.3.4`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **Client build:** `APP_DISPLAY_VERSION` / `__NSPACE_APP_VERSION__` in `client/src/appVersion.ts` + `vite.config.ts` — login/main menu shows **`v` + root `package.json` `version`** so UI stays aligned with `npm run prepare-merge` bumps.
- **Wallet rooms:** `sendUpdateRoom` accepts `joinSpawn`; server broadcasts `roomJoinSpawn`; join flow resolves saved spawn after URL hints (`roomRegistry` v6, `rooms.ts`).
- **Gates:** `placePendingGate` carries optional `colorId`; server relaxes some neighbor walkability checks for placement/editing; `openGate` / hub pathing and `gateWalkBlocked` for blocked walks; `setGateAuthorizedAddresses` for ACL edits; client WS types and gate reposition ghost / frozen source mesh behavior (`Game.ts`, `grid.ts`, `ws.ts`).
- **Header:** marquee settings store, admin header page, streak dedupe on normalized wallet keys.
- **Movement / grid:** client and server `level1SurfaceOpen` / `inferTerrainStartLayer` treat closed gate bases as passage-only for layer-1 stance so post-open snapping matches authority.
