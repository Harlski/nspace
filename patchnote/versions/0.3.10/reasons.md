# Reasons — 0.3.10 (patch-notes version)

**Patch-notes version:** `0.3.10` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Terms/Privacy pages and versioned sign-in consent; main menu wallet UX (hex sign-in, cached accounts + add wallet); optional server-side acknowledgement store and verify body extension.

---

## By area

### Repo / docs

- `docs/process.md` — `TERMS_PRIVACY_ACCEPTANCE_STORE_FILE` / `LEGAL_CONSENT_STORE_FILE`; verify/consent notes as implemented.

### Client

- Main menu: `/tacs` / `/privacy` links; terms checkbox gating before wallet sign-in; Nimiq outline hex + for primary and add-wallet; remove separate “Enter game” pill.
- Auth: `acceptedTermsPrivacyVersion` on verify; `terms_privacy_ack_required` / modal retry paths; local ack key for checkbox visibility.

### Server

- `POST /api/auth/verify` — `acceptedTermsPrivacyVersion`; persistence via `termsPrivacyAcceptanceStore` (default `server/data/terms-privacy-acceptance.json`, legacy merge).
- Express GET `/tacs`, `/privacy`; HTML surfaces (payouts, admin, analytics) inject browser verify snippet where applicable.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- Static deploys should expose `/tacs` and `/privacy` consistently with the game origin when using split hosting.
