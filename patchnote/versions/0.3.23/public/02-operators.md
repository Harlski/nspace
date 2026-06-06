# Public patch notes — operators (`0.3.23`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- **[NEW]** **Player usernames** — profiles stored in `server/data/player-profiles.json` (override **`PLAYER_PROFILE_STORE_FILE`**). **`playerUsernameSelfServiceEnabled`** in admin runtime settings defaults to **on** (new installs); toggled at **`/admin/settings`**. Login prompt deferrals tracked per wallet (`usernamePromptDeferCount`); admin **clear username** resets deferrals. **Username-set ban** (moderation store) skips the login prompt and blocks `PUT` username. No new compose services; back up `player-profiles.json` with other server JSON if you rely on custom names.
- **[FIX]** Deploy or restart no longer resets player room soft-delete or private visibility. `server/data/rooms.json` (v6) was already persisting `deletedAt` and `isPublic`; a load-path bug ignored those fields on startup. No data migration or env changes — deploy this build and restart once; existing on-disk room metadata should apply correctly.
- **[NEW]** **Session resume** persists each player’s last room and tile on disconnect in `server/data/player-last-sessions.json` (override with **`PLAYER_LAST_SESSION_STORE_FILE`**). Reconnect/login within **10 minutes** restores that position when still valid; otherwise players spawn at the chamber default. Include this file in the same backup routine as `world-state.json` / `rooms.json` if you care about resume across disk loss.
- **[OPS]** Optional env: **`PLAYER_LAST_SESSION_STORE_FILE`**. No compose profile changes.
- **[NEW]** **Feedback tickets** — persisted at `server/data/feedback/tickets.json` (override **`FEEDBACK_STORE_FILE`**). Admin inbox at **`/admin/feedback`** (game admin JWT): inbox → detail flow, submitter **Nimiq identicon** + wallet in list and ticket header (`GET /api/identicon/:wallet`). Optional **`TELEGRAM_BOT_TOKEN`** / **`TELEGRAM_CHAT_ID`** still ping on new tickets; the JSON store is authoritative. Back up the feedback file with other server data. NIM rewards for integrated tickets use the existing payout hot wallet (`enqueueNimPayout`).
- **[OPS]** **Split SPA (Vercel):** add **`/admin/feedback`** rewrite to your API host (see repo [`vercel.json`](../../../vercel.json) / [`client/vercel.json`](../../../client/vercel.json)). **`/api/feedback/*`**, **`/api/admin/feedback/*`**, and **`/api/player-profile/username-*`** are already covered by **`/api/:path*`**.
