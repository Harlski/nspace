# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [CHANGE] The phone QR page renders `placeCode` from `GET /api/auth/qr-login/:ticketId/challenge` on the sign-in screen, before `preview` or `complete`. The confirm card still titles itself **Sign in on {code}?** and hides that larger code.
