# Public patch notes — developers (`0.9.0`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [OPS] Runtime settings `miningChallengeEnabled` (default false) and `miningChallengeAdminSelfCheck` (default true) on `GET`/`PUT /api/admin/settings`.
- [NEW] WS `miningChallengeSelfOpen` / `miningChallengeSelfClear` and `miningChallengeSelfResult` for the admin self-check.
- [NEW] Welcome may include `turnstileSiteKey` and `blockClaimDeniedReason` `"Mining is disabled on this account."`
- [NEW] Client sends `miningChallengeVerify` `{ token }`. Server replies `miningChallengeResult` `{ ok, reason? }`.
- [NEW] `POST /api/mining-challenge/open` `{ target }` for a game admin or a Challenge Grant holder. `POST /api/admin/moderation` actions `challenge_grant` and `mining_challenge`.
- [CHANGE] `GET /internal/v1/mining-banned-wallets` is the union of Mining Restrictions and open Mining Challenges, so the Payout Service holds those block-claim jobs. Admin moderation lists stay restrictions only.
- The hold decision is `server/src/miningChallenge.ts`. `beginBlockClaim` consults it only after a gameplay begin would otherwise be accepted. Tutorial rooms pass `tutorial: true`.
