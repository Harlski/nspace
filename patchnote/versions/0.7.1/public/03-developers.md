# Public patch notes — developers (`0.7.1`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [CHANGE] Claimable-block `beginBlockClaim` / `completeBlockClaim`: when peeked Daily Earn remaining is `0` (non-tutorial rooms), result is `ok: false` with `dailyEarnAllowanceExhausted: true` — block is not mutated.
- [NEW] Successful capped mines may include `dailyEarnRemainingNim` / `dailyEarnCeilingNim` on `blockClaimResult` (profile-style NIM labels).
- [NEW] Pure helper `canBeginClaimableBlockEarn(remainingLuna)` in Player Level math; ADR 0014 documents the hostage gate.
- [NEW] Achievement `social-login-100` (**You Kaan Do It**): `login_streak` threshold 100, 150 points, sortOrder after Time of Kaan.
