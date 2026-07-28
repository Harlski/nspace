# Public patch notes — operators (`0.6.7`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

[NEW] **Movement Watch** (allowlist game admins only):

- In-game Admin overlay → **Watch** tab → enable. Preference persists as `localStorage` key `NSPACE_MOVEMENT_WATCH=1`.
- Shows click destinations and authoritative paths for everyone in the room; rejected clicks (rate limit, no path, client-only unwalkable / mine clicks) linger briefly with a short reason.
- Traffic is an opt-in admin WebSocket side channel - not part of the normal room `state` / `moveOrder` stream. No new env vars or Docker changes.
- `VITE_ADMIN_ENABLED` alone does **not** unlock Watch; the wallet must be on the admin allowlist.
