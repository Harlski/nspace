# Public patch notes — operators (`0.5.5`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

No operator-facing changes this release: no new or removed environment variables, no data migrations, and no Docker/compose or CI deploy changes. Whispers reuse the existing game WebSocket and chat rate limit, and the new moderation event is written to the same daily JSONL event log you already persist. A normal rebuild and restart is all that's required.
