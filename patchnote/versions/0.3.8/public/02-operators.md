# Public patch notes — operators (`0.3.8`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [OPS] **No deploy surface change** — no new env vars, compose services, migrations, or server actions are required.
- [PERF] **Client-only render pacing change:** Browser clients avoid full scene redraws while rooms are visually idle.
