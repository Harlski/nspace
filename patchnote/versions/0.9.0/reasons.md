# Reasons — 0.9.0 (patch-notes version)

**Patch-notes version:** `0.9.0` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Mining Challenge ships off (`miningChallengeEnabled`). Admins can try it on their own wallet (`miningChallengeAdminSelfCheck`, on by default) from the in-game Admin menu. When enabled, it stops claimable-block mining for 15 minutes when three wallets begin a gameplay mine from one trusted client IP inside 24 hours, or when a game admin or Challenge Grant holder opens one. A Turnstile pass restores that wallet for 30 minutes. An unanswered player challenge becomes a Mining Restriction. An unanswered self-check does not.

---

## By area

### Repo / docs

- `docs/features-checklist.md` records Mining Challenge, the profile action, and the new WebSocket messages.
- `docs/process.md` records the hold rules, `POST /api/mining-challenge/open`, and env `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`, `MINING_CHALLENGE_STORE_FILE`.
- `server/.env.example` lists those variables.
- Spec and tickets: `.scratch/mining-challenge/`. Policy: `docs/adr/0024` through `0027`.

### Client

- `client/src/net/ws.ts`: welcome `turnstileSiteKey`; `miningChallengeResult`; `miningChallengeSelfResult`; `sendMiningChallengeVerify`; `sendMiningChallengeSelf`.
- `client/src/ui/adminOverlay.ts`: Watch tab toggles and self-check buttons.
- `client/src/main.ts`: denial string `Mining is disabled on this account.` blocks begin until `miningChallengeResult` ok.
- `client/src/ui/hud.ts`: claim bar renders an explicit Turnstile widget (`pointer-events: auto`) and a profile Mining challenge action. Grant holders see only that button.
- `client/src/style.css`: claim-bar captcha slot.
- `packages/i18n/src/locales/en.json`: `mining.disabled`. Other locales fall back to English.

### Server

- `server/src/adminRuntimeSettingsStore.ts`: `miningChallengeEnabled` default false, `miningChallengeAdminSelfCheck` default true.
- `server/src/miningChallenge.ts`: 15-minute hold, 30-minute immunity, 3 wallets / 24 hours, 15-minute pull-in, Challenge Grants, Turnstile siteverify, trusted-proxy IP. Player challenges no-op while the flag is off. Self-check source `self` expires without a Mining Restriction.
- `server/src/adminSettingsPage.ts`: Mining Challenge panel.
- `server/src/blockClaimAccess.ts`: guest, then Mining Restriction, then an open Mining Challenge.
- `server/src/rooms.ts`: `clientIp` on the connection; `considerGameplayBegin` after a begin would otherwise succeed; complete releases a challenged reservation; `miningChallengeVerify`.
- `server/src/index.ts`: IP from the proxy at upgrade; `POST /api/mining-challenge/open`; moderation actions `challenge_grant` and `mining_challenge`; profile `viewerCanOpenMiningChallenge`; startup sweep.
- `server/src/payoutMiningGate.ts`: holds grid tile keys for an open challenge as well as a Mining Restriction. Expiry inside that check still holds.
- `server/src/adminModerationPage.ts`: grant list, grant/revoke, open challenge.
- `GET /internal/v1/mining-banned-wallets` returns restrictions union open challenges. The Payout Service refresh-before-send path picks that up without a sidecar protocol change.
- Tests: `server/test/miningChallenge.test.ts`.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- No compose service change. Operators set the Turnstile keys in `server/.env` or the root `.env` (compose `env_file`).
- Store file default `server/data/mining-challenges.json` (gitignored with the rest of `server/data`).
