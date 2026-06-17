# Public patch notes — operators (`0.3.28`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [OPS] **`rooms.json` migrates v6 → v7** and **`builtin-room-names.json` migrates v3 → v4** automatically on first load — a new per-room `builderAddresses` list is added (empty for existing rooms). No manual steps; back up `server/data/rooms.json` and `server/data/builtin-room-names.json` as usual before upgrading.
- [NEW] New system-admin page `/admin/rooms` (gated by `ADMIN_ADDRESSES`) with admin-only APIs under `/api/admin/rooms*`. No new environment variables or compose services.
- [OPS] **Split SPA hosting (Vercel):** both `vercel.json` files add a rewrite for `/admin/rooms` → `https://api.nimiq.space/admin/rooms` so the new server-rendered page is reachable from the static host. The admin APIs and the 3D preview asset need no extra config (covered by the existing `/api/:path*` rewrite and the static `roomPreview.html` build output). Redeploy the SPA after upgrading.
- [SEC] Room thumbnails (`GET /api/admin/rooms/:id/thumbnail.png`) accept the admin JWT via a `?token=` query parameter (so an `<img>` can load them) and remain restricted to system admins.
