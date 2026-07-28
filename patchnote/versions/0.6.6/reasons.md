# Reasons — 0.6.6 (patch-notes version)

**Patch-notes version:** `0.6.6` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Tutorial Unlock is a free wallet message sign. Admins get a `/admin/user/:profile` dossier (username-first lists, hover wallet, chat/activity/sanctions/tutorial).

---

## By area

### Repo / docs

- ADRs 0005 / 0007 updated for Tutorial Unlock Ack via message sign.
- `docs/THE-LARGER-SYSTEM.md` + `docs/reasons/reason_452918.md`: recorded decision.
- `docs/features-checklist.md`, `docs/process.md`, `CONTEXT.md`: Unlock path + admin player dossier.

### Client

- `client/src/auth/nimiq.ts`: `signPlainMessage` (Pay `sign` / Hub `signMessage`).
- `client/src/tutorial/flow.ts`: `TUTORIAL_DOOR_UNLOCK_MESSAGE`, `signTutorialDoorUnlock`, cinematic title **Unlocks can cost NIM**; removed tutorial door checkout/send.
- `client/src/main.ts`: Unlock confirm → sign → `door-sent` (no door-quote / Pay & unlock).
- `client/src/tutorial/flow.test.ts`: sign simulation + Pay path + cancel cases.

### Server

- `server/src/adminPlayerOps.ts`: resolve wallet/username; dossier view (tutorial, sanctions, activity, rooms, presence path helpers).
- `server/src/adminUserPage.ts` + `GET /admin/user/:profile`: player maintenance UI.
- `server/src/adminModerationPage.ts`: username display + hover wallet; row → dossier; look-up opens dossier.
- `server/src/connectNotice.ts`: Telegram moderation link → `/admin/user/{wallet}`.
- `server/src/eventLog.ts`: lastVisit includes `startedAt` / `endedAt`.
- `server/src/index.ts`: enriched `/api/admin/player`, live presence on lookup; moderation username resolve + `tutorial_reset`.
- `server/test/adminPlayerOps.test.ts`, connect notice URL assertion.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- `TUTORIAL_DOOR_*` unused by Unlock client path; still present for quote API / legacy config.
- No new env vars; `/admin/:path*` Vercel rewrites already cover `/admin/user/*`.
