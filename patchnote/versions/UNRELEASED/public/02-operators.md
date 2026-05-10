# Public patch notes — operators (`UNRELEASED`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [OPS] **No deploy surface change in this bucket** — no new env vars, compose services, or migration steps tied to the items above.
- [PERF] **Client-only render pacing change:** No server, Docker, env, or migration action is required; the browser client now avoids full scene redraws while the room is visually idle.
- **Docs only:** [docs/THE-LARGER-SYSTEM.md](../../../../docs/THE-LARGER-SYSTEM.md) and [patchnote/README.md](../../../README.md) now spell out what `npm run prepare-merge` automates (semver + folder freeze) versus what you still author in `public/*.md` before merge.
