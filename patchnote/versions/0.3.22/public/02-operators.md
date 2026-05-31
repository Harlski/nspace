# Public patch notes — operators (`0.3.22`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

## Pixel room

- [NEW] Builtin room id **`pixel`**; player-painted tiles persist in `data/rooms/pixel.json` (sparse — implicit checkerboard + center spawn pad elsewhere).
- [CHANGE] **500×500** grid (−250…249), not the older 250×250 seed. One-time migrations (`.pixel-neutral-floor-v1`, `.pixel-implicit-floor-v2`, `.pixel-checkerboard-v3`) may run on first boot after upgrade; **back up `data/`** before deploy.
- [NEW] Forward-only paint history: `server/data/pixel/paint-log.jsonl` (override **`PIXEL_PAINT_LOG_FILE`**). First run writes a **baseline** snapshot; each paint appends a line for future timelapse export.
- [NEW] Public board snapshot: **`GET /pixels.png`** (**1000×1000** PNG, 2 px per tile, cached, short `max-age`). On split hosting, rewrite **`/pixels.png`** to your API host (see repo `vercel.json` and `client/vercel.json`). Local dev: Vite proxies **`/pixels.png`** to the game server on `:3001`.

## Stream capture

- [OPS] Suggested OBS/browser URL: `https://<your-host>/?room=pixel&stream=1&streamFollow=1`
- [OPS] Allowlist the **stream-bot wallet** via **`STREAM_OBSERVER_ADDRESSES`** (comma-separated; spaces in an address are fine) **or** **`/admin/settings`** → *Stream cinema wallet*. Without at least one wallet configured, `?stream=1` is rejected (**WebSocket close 4403**).
- Stream observer sessions are **read-only** (not counted as players; no movement or floor edits).
- Query flags: `stream`, `streamFollow`, `streamChat`, `noScroll`, `streamDebug` (pan tuning panel), `webglRenderScale` (0.25–1; defaults to **1** when `stream` is set for sharp pixels).
- [OPS] Run the stream browser on a **separate machine** from the game server under load; use a dedicated wallet (not dev bypass).
