# Public patch notes — operators (`0.3.27`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

## Campaign advertising

- **[NEW]** Routes **`/advertise`** (wallet-gated dashboard) and **`/advertise/how-it-works`** (public guide). APIs under **`/api/advertise/*`**; campaign SQLite alongside game server data.
- **[NEW]** Admin **`/admin/campaign`** — pending approvals, approved list (balance / audience / Live), rotation set editor, expired & unfunded tab.
- **[OPS]** Paid campaigns require the **payment-intent** sidecar (`docker compose --profile payment up -d payment-intent`) plus on the game server: **`PAYMENT_INTENT_SERVICE_URL`**, **`PAYMENT_INTENT_API_SECRET`**, and matching **`NIM_NETWORK`** on both services.
- **[OPS]** Optional **`TELEGRAM_BOT_TOKEN`** + **`TELEGRAM_CHAT_ID`** — notify on campaigns reaching **pending approval** (`campaign-approval` topic).
- **[OPS]** Visibility rate default: **`CAMPAIGN_NIM_PER_24H_VISIBLE=100`** (100 NIM ≈ 24 h on-screen at full audience). Override with **`CAMPAIGN_VISIBILITY_NIM_PER_MINUTE`** if needed.
- **[OPS]** Campaign uploads stored under SQLite-adjacent **`advertise-uploads/`**; served at **`/advertise/uploads/…`**.
- **[OPS]** On server start, stale payment intents on approved campaigns are cleared and **inflated prepaid balances** (balance greater than sum of transactions) are reconciled from transaction history minus recorded visibility drain.
- **[CHANGE]** Approved campaigns are **not auto-placed** — admins add them to **rotation sets** and place billboards via the in-game **Campaign** build tab.

## Deploy / restart

- Restart game server after upgrade so campaign store migrations and balance repair run once at startup.
- No separate migration command; backup **`campaigns.sqlite`** (path from campaign store config) before major upgrades if you self-host.
