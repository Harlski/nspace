# Public patch notes — operators (`UNRELEASED`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- **[CHANGE]** **Usernames** — a wallet with no `customUsername` in `player-profiles.json` cannot open a game socket until it sets one. No new env var and no migration. Username-set bans may still connect. Clearing a username forces the picker on the next connection.
- **[CHANGE]** **Hourly activity digest** — the Player column is the stored username (shortened wallet only when none is stored). **New** (`*`) and **Pay** (`+`) are their own columns, not suffixes on the name.
