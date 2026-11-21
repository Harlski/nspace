# Public patch notes — operators (`0.9.0`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [OPS] Mining Challenge ships **off**. Turn it on from `/admin/settings` or the in-game Admin menu (Watch). While off, mining continues.
- [OPS] Admin self-check is on by default. An admin can run the captcha on their own account from that same menu. It does not challenge other players, and leaving it unanswered does not restrict the account. Uncheck it to remove that button's effect.
- [OPS] Set `TURNSTILE_SECRET_KEY` and `TURNSTILE_SITE_KEY` on the game server before a check can open. When the secret is unset, no new Mining Challenge opens.
- [OPS] Holds, the 30-minute pass gap, the 24-hour begin log, and Challenge Grants persist in `server/data/mining-challenges.json` (`MINING_CHALLENGE_STORE_FILE`). Back it up with `moderation.json`. A deadline that passes while the process is down becomes a Mining Restriction on startup.
- [OPS] The client IP is the socket peer. `X-Real-IP` or the first `X-Forwarded-For` hop is used only when that peer is loopback (Caddy or Nginx on the same host). A header from a public peer is ignored.
- [OPS] Game admins grant and revoke the ability to open a challenge, and can open one, from `/admin/moderation`.
- [SEC] Three different wallets that start a gameplay mine from one client IP inside 24 hours pause mining for the wallets that began in the last 15 minutes. Shared NATs can hit this. One IPv6 address per device, and wallets that rotate proxies, do not cluster.
