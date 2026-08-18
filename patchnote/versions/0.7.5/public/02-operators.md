# Public patch notes — operators (`0.7.5`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [NEW] **Chat substitutions** on `/admin/chat`: add, enable/disable, edit, or remove exact public-chat rewrites. Missing `server/data/chat-substitutions.json` seeds three I-variant triggers; an existing empty list stays empty. Optional **`CHAT_SUBSTITUTION_STORE_FILE`**. Applies on the next public chat message (no restart). Whispers are not rewritten. Event log keeps the typed line as `textOriginal`.
- [OPS] `MOVE_ORDER_BROADCAST` (default on) still kill-switches Path Playback, including `welcome.moveOrders`, `poseHeartbeat`, and the one-shot order/abort duplicate.
- [PERF] Click-to-walk rooms still omit tick pose for active grid walkers. Heartbeat is about 1 Hz analytic pose for those walkers (and about 1 s after they stop), not a return to 8 Hz pose streaming.
