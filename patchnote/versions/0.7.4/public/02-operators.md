# Public patch notes — operators (`0.7.4`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [PERF] Occupied-room typing / NIM-send away / Challenge / rename no longer fan out a full-roster `state`. No new env vars. `MOVE_ORDER_BROADCAST` (default on) still kill-switches Path Playback.
