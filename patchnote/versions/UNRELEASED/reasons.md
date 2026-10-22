# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

QR Pay login for desktop cafe / untrusted-PC sign-in via Nimiq Pay on phone.

---

## By area

### Repo / docs

- `better-sqlite3` ^12.11.1 (Node 20–26 including current Node 26); root `engines` + `.nvmrc` (22 LTS).
- [docs/features-checklist.md](../../../docs/features-checklist.md) — Auth bullet for QR Pay login.
- [docs/build.md](../../../docs/build.md) — auth HTTP routes list.
- [docs/live-service-implementation.md](../../../docs/live-service-implementation.md) — Vercel `/auth/qr/:ticket` rewrite note.

### Client

- Main Menu **Sign in with Nimiq Pay QR** (hidden inside Pay mini-app).
- Desktop overlay: compact QR dialog (short subtitle + `(?)` help); QR is the plain same-origin `/auth/qr/{ticket}` URL (never a percent-encoded `nimiqpay://…?url=http%3A…` deeplink); poll claim with secret.
- Phone landing `mountQrPayLoginPhonePage`: Open-in-Pay CTA or Pay `signLoginChallenge` → complete; contained full-width buttons (no Nimiq chrome overflow); signed-in success state with check mark + `phoneDone*` copy.
- i18n keys `qrPayLogin.*` in all locale catalogs.
- Vercel rewrites in root + `client/vercel.json`.

### Server

- In-memory ticket store [server/src/qrPayLogin.ts](../../../server/src/qrPayLogin.ts) (5 min TTL, claim secret, one-shot JWT claim).
- Routes [server/src/qrPayLoginRoutes.ts](../../../server/src/qrPayLoginRoutes.ts).
- Shared session issuance [server/src/walletLoginSession.ts](../../../server/src/walletLoginSession.ts) used by `/api/auth/verify` and QR complete.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- SPA rewrite `/auth/qr/:ticket` → `index.html` (both vercel.json files). No new env vars.
