# Public patch notes — operators (`0.5.3`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [CHANGE] **Connect notices** (Telegram): now sent on **every wallet WebSocket connect**, not only the first sign-in after auth. Dedupe window shortened from **15 minutes to 1 minute** — reconnects after a minute can trigger another notice.
- [CHANGE] Connect notice text uses the player's in-game **display name** when available; redundant wallet shorthand is omitted when it matches the display name.
- [FIX] **Stream observer** / cinema connections no longer trigger connect notices.
- No new environment variables, database migrations, or compose profile changes in this release. Deploy the updated game server and client build as usual.
