# Public patch notes — developers (`0.3.5`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **CI deploy:** `.github/workflows/deploy-docker.yml` stops Compose, tgz-backs up host `data/` to `backups/`, then git reset + compose build/up; see `docs/deploy-github-docker.md` and `docs/THE-LARGER-SYSTEM.md` (recorded deploy subsection).
- **Client build:** `APP_DISPLAY_VERSION` from root `package.json` via Vite `define` (`client/src/appVersion.ts`, `mainMenu.ts`).
- **Wallet rooms:** room registry **v6** with `joinSpawnX` / `joinSpawnZ`; `updateRoom` / `joinRoom` paths and `roomJoinSpawn` WS broadcast (see `reasons.md` for file list).
- **Gates:** `placePendingGate` / `setObstacleProps` / `openGate` behavior and payloads evolved (ignored `faceDir` for new gates with `rampDir` 0, `colorId`, ACL via `setGateAuthorizedAddresses`, hub passability, `gateWalkBlocked`); client/server grid alignment for gate bases and snapping.
- **Header marquee:** `GET /api/header-marquee`, admin `/admin/header`, server-side streak/message settings stores.
