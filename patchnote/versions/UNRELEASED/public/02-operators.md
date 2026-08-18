# Public patch notes — operators (`UNRELEASED`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [NEW] **Chat substitutions** on `/admin/chat`: add, enable/disable, edit, or remove exact public-chat rewrites. Missing `server/data/chat-substitutions.json` seeds three I-variant triggers; an existing empty list stays empty. Optional **`CHAT_SUBSTITUTION_STORE_FILE`**. Applies on the next public chat message (no restart). Whispers are not rewritten. Event log keeps the typed line as `textOriginal`.
