# Public patch notes — operators (`0.4.5`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [CHANGE] **World Cup Match defaults** (only if you rely on implicit defaults — no change when vars are set explicitly):
  - `WORLDCUP_MATCH_COUNTDOWN_MS` default **10000** (was 3000)
  - `WORLDCUP_MATCH_RESULT_LINGER_MS` default **10000** (was 5000) — drives the Match Result Overlay linger and end-of-match movement freeze
- [CHANGE] **New Play Space slugs** are six uppercase alphanumeric characters (same charset/length as wallet room join codes). Existing eight-character slugs remain valid.
- [OPS] **Vercel split-host routing:** admin HTML is covered by a single `/admin/:path*` rewrite (replaces per-page entries). Root [`vercel.json`](../../../vercel.json) and [`client/vercel.json`](../../../client/vercel.json) must stay in sync — run **`npm run check-vercel-rewrites`** before merge/deploy.
- [OPS] No database migrations or compose changes in this release. Restart the game server to pick up join-code resolution and Match timing behavior.
