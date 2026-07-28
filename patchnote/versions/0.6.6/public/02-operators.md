# Public patch notes — operators (`0.6.6`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [OPS] New player dossier at `/admin/user/:profile` (custom username preferred; full NQ wallet also works): sanctions, tutorial reset, activity/presence, owned rooms, recent chat. `/admin/moderation` lists show usernames (hover for wallet); click a row to open the dossier. Connect Notice Telegram links now open `/admin/user/{wallet}`.
- [OPS] Tutorial Unlock no longer spends `TUTORIAL_DOOR_*` amounts. `TUTORIAL_DOOR_AMOUNT_LUNA` / `TUTORIAL_DOOR_RECIPIENT` and `GET /api/tutorial/door-quote` remain for now; the Unlock client path does not use them. Faucet + priority payout env unchanged. No new env vars for the dossier (`/admin/:path*` rewrites already cover it).
