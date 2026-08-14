---
id: "01-shop-admin-runtime-gate"
parent: .scratch/achievements-wave/PRD.md
triage: done
status: done
depends_on: []
---

# 01 — Shop admin runtime gate

## Parent

[`.scratch/achievements-wave/PRD.md`](../PRD.md)

**What to build:** Operators can open or close **Shop** from `/admin/settings` without a
redeploy. Closing Shop closes The Shaper joins, the Shop tab (COMING SOON), and Cosmetic
Unlock, matching today's env coupling. `SHOP_ENABLED=0` still hard-closes regardless of the
checkbox. `SHAPER_ENABLED=0` stays env-only room hide. Live sessions pick up the new Shop
open flag (not compile-time only).

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] `/admin/settings` has a Shop checkbox, default on, persisted like the tutorial flag.
- [ ] Shop is open iff the env kill switch is not `0` **and** the admin checkbox is on.
- [ ] Closing Shop blocks Shaper joins, featured shelf, and Cosmetic Unlock on the server.
- [ ] Client Shop tab / COMING SOON follows the **server** Shop-open flag in a live session
      (not Vite-only).
- [ ] `SHAPER_ENABLED=0` still hides The Shaper while Shop can remain open.
- [ ] Tests cover env kill switch, admin default-on, and admin off.

## Comments
- Implemented in achievements-wave /implement pass (2026-08-14).
