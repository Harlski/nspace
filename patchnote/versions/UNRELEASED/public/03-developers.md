# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **[NEW] QR Pay login APIs:** `POST /api/auth/qr-login` → `{ ticketId, claimSecret, expiresAt, spaUrl, payDeepLink }`; `GET /api/auth/qr-login/:ticketId/challenge` (public nonce while pending; after complete, `{ status: "fulfilled", address, nimiqPay }` with no JWT — still returned after the desktop claims the session, until TTL); `POST /api/auth/qr-login/:ticketId/complete` (Pay signed `Login:v1` + terms); `GET /api/auth/qr-login/:ticketId?claimSecret=` (desktop poll, one-shot JWT).
- **[CHANGE]** `/api/auth/verify` session issuance extracted to `issueWalletSessionFromSignedLogin` (shared with QR complete).
- Client: `/auth/qr/:ticket` SPA path; Main Menu QR entry; i18n `qrPayLogin.*`. Desktop mode slider builds QR via `buildQrLoginPayload(mode)` - Pay: unencoded `nimiqpay://miniapp?url={spa}`; Wallet: plain spa URL for Hub `signMessage`. The line under the code is always the plain spa URL, with a copy control (`copyTextToClipboard`) for when Pay will not open a non-default port. Phone page: Hub/Wallet sign primary outside Pay, Open-in-Pay secondary; contained `.qr-pay-login-phone__btn` (never `@nimiq/style` `.nq-button`). The phone asks for an explicit yes (`confirm` phase) before `signLoginChallenge`. After authorization the page shows a light account card (uncropped identicon, spaced address, Pay or Wallet) and does not return to the sign-in form on reload (`phoneViewFromChallenge` plus `sessionStorage`, backed by the post-claim challenge receipt).
