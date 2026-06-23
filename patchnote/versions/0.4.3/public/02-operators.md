# Public patch notes — operators (`0.4.3`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [OPS] New env var **`DIRECT_INVITE_MAX_OCCUPANTS`** (default **8**) — max total occupants (creator + guests) of one private Play Space. Existing invite knobs are unchanged: `DIRECT_INVITE_ENABLED` (follows `WORLDCUP_ENABLED`), `DIRECT_INVITE_TTL_MS` (default 15m), `GUEST_SESSION_TTL_SEC` (default 4h).
- [OPS] No migration or persistence change: Play Spaces and guest sessions remain fully in-memory/ephemeral; nothing new is written to disk.
