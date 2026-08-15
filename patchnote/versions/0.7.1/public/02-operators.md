# Public patch notes — operators (`0.7.1`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- No new env vars or compose changes. Redeploy the game image to pick up server authority for claimable-block refuse-at-zero and the new login-streak achievement.
- `ACHIEVEMENT_LOGIN_STREAK_TOP` still tunes **Time of Kaan** only; **You Kaan Do It** is fixed at 100 consecutive UTC days.
- Daily Earn Allowance store path unchanged (`DAILY_EARN_ALLOWANCE_FILE` / default JSON).
