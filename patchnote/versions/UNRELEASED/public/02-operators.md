# Public patch notes — operators (`UNRELEASED`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [SEC] `POST /api/admin/random-layout` is removed (it had no admin auth). Extra floor is edited in-world only.
- [OPS] Admin Invisibility no longer blocks world edits; presence omission is unchanged.
- [OPS] Mining Restriction still holds queued block-claim payouts until lifted. The Payout Service now refreshes the restriction list before send and will not send mining jobs if the list cannot be confirmed.
- [NEW] Movement Watch Click Markers show Click Interval (seconds since that player's previous marker, e.g. `2.43`) so operators can spot tightly timed clicks. Always on with Watch; no extra toggle.
