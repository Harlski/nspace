# Public patch notes — developers (`0.8.5`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [NEW] `POST /api/auth/qr-login` returns `{ ticketId, claimSecret, expiresAt, spaUrl, payDeepLink, placeCode }`. `claimSecret` is only for the computer that created the ticket.
- [NEW] `GET /api/auth/qr-login/:ticketId/challenge` is public: nonce and `placeCode` while pending. `POST …/preview` checks a `Login:v1` signature and returns `{ address, nimiqPay, username }` with no JWT and no fulfill. `POST …/complete` fulfills after terms. `GET …?claimSecret=` returns the JWT once.
- [CHANGE] After that claim, `GET …/challenge` still returns `{ status: "fulfilled", address, nimiqPay }` (no JWT) until the 5-minute TTL, so the phone can name the account.
- [CHANGE] `/api/auth/verify` and QR complete share `issueWalletSessionFromSignedLogin`.
- Client route `/auth/qr/:ticket`. Pay QR text is unencoded `nimiqpay://miniapp?url={spa}`. Wallet QR text is the plain page URL. Only **Yes, sign in** calls `complete`. Cancel clears the staged signature and leaves the ticket pending.
