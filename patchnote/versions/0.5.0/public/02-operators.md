# Public patch notes — operators (`0.5.0`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

**[NEW] `SHOP_ENABLED`** — Set to `1` on the game server to open the cosmetic shop (featured shelf, unlock intents, Shaper joins). Default: off. Mirror with **`VITE_SHOP_ENABLED=1`** at client build time so the Shop tab and Player Menu entry match server policy.

**[NEW] `SHAPER_ENABLED`** — Set to `0` to hide **The Shaper** room entirely (`cosmetic-gallery`, join code **SPACER**). Default: on when the shop is open. Shaper is only joinable when `SHOP_ENABLED=1`.

**[OPS] Campaign DB** — Achievement progress and cosmetic entitlements share the existing campaign SQLite file; no separate migration step — new tables are created on first boot.

**[OPS] Deploy order** — Bump server and client together for achievements WS messages, wardrobe `featured` payload, and shop gate flags.

**[OPS] No payment-intent or payout-service changes** in this release.
