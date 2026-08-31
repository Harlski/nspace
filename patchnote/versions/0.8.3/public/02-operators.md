# Public patch notes — operators (`0.8.3`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

No deploy, env, Docker, or migration changes in this build. `MOSQUITO_TAG_ENABLED` / `VITE_MOSQUITO_TAG_ENABLED` are unchanged from 0.8.2.

- [CHANGE] On `/admin/campaign`, operators can replace a campaign's billboard image (upload, then Save details) as well as edit project name and Project URL. Live rotation billboards rebuild after save. Advertisers can no longer paste remote image URLs.
