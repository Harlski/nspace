# Reasons — 0.8.5 (patch-notes version)

**Patch-notes version:** `0.8.5` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

QR Pay login for desktop cafe / untrusted-PC sign-in via Nimiq Pay or Nimiq Wallet on a phone.

Phone wallet path confirmed on device: scan, Hub sign-in, matching place code, desktop enters. Cancel on **Sign in on {code}?** returns the phone to the sign-in form, drops the staged signature, does not call `complete`, and leaves the computer signed out (ticket stays pending). Nimiq Pay will not open a local URL that includes a port (`:5173`); the Pay deeplink check belongs on `https://nimiq.space` after deploy, where the link has no port.

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
- Phone landing `mountQrPayLoginPhonePage` uses the lobby backdrop (orange/blue wash, grid) and the **NIMIQ SPACE** wordmark above the card, in the lobby type (Mulish, Fira Mono for the address). No auto-sign inside Pay. Sign calls `signLoginChallenge`, then `POST …/preview` (`resolveSignedLoginAddress`, no session). Each ticket has a public `placeCode` (4 characters, no 0/O/1/I) returned on create and on the challenge. The desktop dialog shows it; the confirm title is **Sign in on {code}?** The confirm card drops the hint and the Pay/Wallet label, fades the address, and uses Nimiq `.nq-button.light-blue` / `.nq-button-s` at card width. Only **Yes, sign in** calls `complete`. Cancel discards the staged signature and leaves the ticket pending. Confirm uses Nimiq `.nq-button.light-blue` and `.nq-button-s` with a card-width override so the 25rem `min-width` does not overflow. The sign-in form keeps the contained `.qr-pay-login-phone__btn` controls. After sign-in the phone keeps that card (username included) across a reload via `sessionStorage` plus the public challenge receipt (`qrPayLoginPhoneState.ts`). The fulfilled challenge looks up `customUsername` live. Sign-in form is shown only while the ticket is still pending.
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
