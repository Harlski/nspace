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

- Main Menu **Sign in with QR** (hidden inside Pay mini-app; author `display` must not override `[hidden]`).
- Desktop overlay: compact QR dialog (short subtitle + `(?)` help) with **Nimiq Pay | Nimiq Wallet** mode slider; Pay QR = unencoded `nimiqpay://miniapp?url={spa}`; Wallet QR = plain `/auth/qr/{ticket}` (Hub sign on phone; no Wallet custom-scheme for remote login); on localhost/dev, QR origin prefers server LAN `spaUrl` over `location.origin`; the line under the code is that plain spa URL plus a copy icon (phone browser paste when Pay blocks a `:5173` URL); poll claim with secret.
- Phone landing `mountQrPayLoginPhonePage` uses the lobby backdrop (orange/blue wash, grid) and the **NIMIQ SPACE** wordmark above the card. No auto-sign inside Pay. Sign calls `signLoginChallenge`, then `POST …/preview` (`resolveSignedLoginAddress`, no session). The **Are you sure?** step is the same light paper card, with the identicon and custom username when the profile has one. Only **Yes, sign in** calls `complete`. Cancel discards the staged signature and leaves the ticket pending. Contained full-width buttons (never `@nimiq/style` `.nq-button`, which overflows the card); Cancel uses dark text on the cream card. After sign-in the phone keeps that card (username included) across a reload via `sessionStorage` plus the public challenge receipt (`qrPayLoginPhoneState.ts`). The fulfilled challenge looks up `customUsername` live. Sign-in form is shown only while the ticket is still pending.
- i18n keys `qrPayLogin.*` in all locale catalogs.
- Vercel rewrites in root + `client/vercel.json`.

### Server

- In-memory ticket store [server/src/qrPayLogin.ts](../../../server/src/qrPayLogin.ts) (5 min TTL, claim secret, one-shot JWT claim). After the desktop takes the JWT, the ticket becomes an address receipt (no secret, no token) so `GET …/challenge` can still name the account until TTL.
- Routes [server/src/qrPayLoginRoutes.ts](../../../server/src/qrPayLoginRoutes.ts).
- Shared session issuance [server/src/walletLoginSession.ts](../../../server/src/walletLoginSession.ts) used by `/api/auth/verify` and QR complete.
- HTTP contract tests in [server/test/qrPayLoginRoutes.test.ts](../../../server/test/qrPayLoginRoutes.test.ts): claim secrecy, one-shot session, terms gate, real `Login:v1` signatures, and the Pay flag (empty `signer` plus `nimiqPayClient`).

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- SPA rewrite `/auth/qr/:ticket` → `index.html` (both vercel.json files). No new env vars.
