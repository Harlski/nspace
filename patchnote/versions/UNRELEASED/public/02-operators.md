# Public patch notes — operators (`UNRELEASED`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [OPS] **Return Walk** needs Resident wallet(s) via **`/admin/connections`** and/or `RESIDENT_ADDRESSES`, `RETURN_WALK_SERVER_WALLET_ADDRESS` (Deposit destination; must not be the Stream Faucet `NQ21 F410 VXJB UK02 6TLG 8YHT 4M4B L664 NPM7`), and `NIM_RPC_URL` on the game server.
- [OPS] Set `RETURN_WALK_PRIVATE_KEY` on the **payout** sidecar only (Compose already blanks it on `nspace`). Do not reuse `NIM_PAYOUT_PRIVATE_KEY`.
- [OPS] Invoices persist in `server/data/return-walk.sqlite` (override `RETURN_WALK_STORE_FILE`). Include that file in data backups.
- [OPS] **`/admin/connections`** (system admin) edits the Resident allowlist live (`GET`/`PUT /api/admin/connections`, merged with env). Invoice/directory stay on `/api/resident/*`. Non-Resident JWTs get 403.
