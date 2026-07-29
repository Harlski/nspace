# Public patch notes — developers (`0.6.8`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [FIX] Server `npm run dev` works on Windows: env comes from `server/.env` (no Unix `VAR=value` prefixes). Dev bootstrap creates/repairs that file from `.env.example` and upserts payout keys without clobbering other lines.
- [FIX] `patchBuiltinRoomSettings` accepts `tutorial` / `tutorial-staging` so `/admin/rooms` can persist tutorial builders; allowlist env still applies.
