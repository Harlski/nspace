# Public patch notes — developers (`0.3.10`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [CHANGE] **`POST /api/auth/verify`:** Optional **`acceptedTermsPrivacyVersion`** (string, must match server docs version) when the client is acknowledging Terms/Privacy for this login. Error **`terms_privacy_ack_required`** (and legacy **`legal_consent_required`**) when the server requires acknowledgement; clients should retry with the version after user consent.
- [CHANGE] **Static/legal:** `tacs.html` / `privacy.html` and Express (or equivalent) wiring for **`/tacs`** / **`/privacy`**; admin/analytics/payouts HTML flows align with the same verify payload where signing is used.
