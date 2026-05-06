# JWT and session secrets

**Current behavior:** In production (`NODE_ENV=production`), the server refuses to start without a strong `JWT_SECRET` (see [server/src/index.ts](../server/src/index.ts)).

**Historical note:** An older audit described an insecure default fallback. That issue has been addressed; the full superseded write-up is kept for context only: [brainstorm/JWT-SECURITY-ISSUE-archived.md](brainstorm/JWT-SECURITY-ISSUE-archived.md).

**Operational guidance:** Use a unique random secret per environment; never enable `DEV_AUTH_BYPASS` in production. See [SECURITY-REVIEW.md](SECURITY-REVIEW.md) and [getting-started.md](getting-started.md).
