# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [NEW] Player JWT (same as `/ws?token=`): `POST/GET /api/resident/return-walk/invoices`, `POST …/tx`, `GET /api/resident/public-rooms`. Body `{ amountNim: 1000 }`; unpaid TTL 30 minutes; luna strings accepted.
- [NEW] Obstacle snapshot: Return Gold is `{ claimable: true, kind: "returnGold", returnGold: true, active: true, cooldownMs: 0 }`. Gold Blocks omit `kind`.
- [NEW] Upgrade Windows are server-owned (20s, eight Upgrades, pose at fire time, uniform random among eligible ordinary solids in Chebyshev radius 8 that have an orthogonal walkable stand tile). Boxed-in cubes do not convert. No Resident Upgrade HTTP.
- [NEW] Pay-Intent `source: "returnWalk"` → Payout Service Server Wallet signer. Outbox must preserve `source`. Bulk flush skips these jobs.
- [NEW] Directory `kind`: `commons` | `public` | `playSpace` | `tutorial` | `matchPitch`. Commons id is `hub`. `chamber` is omitted.
