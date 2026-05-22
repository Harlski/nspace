# Public patch notes — operators (`0.3.16`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- **[CHANGE]** Deploy **client and server** from this release together. Placed obstacles and placement messages use **`colorRgb`** on the wire; the server still **reads legacy `colorId`** when loading older world data and normalizes to RGB.
- **[CHANGE]** Optional obstacle fields **`hexRadiusScale`** and **`sphereRadiusScale`** (0.25–1) accompany hex and sphere shapes; persisted state may still carry legacy **`hexHeightScale`** as an alias on load.
- **[OPS]** No new environment variables or compose profiles. Rebuild and restart the game server image (and client static assets) as you already do for a normal release.
