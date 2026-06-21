# Public patch notes — operators (`0.4.2`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [OPS] **Payout sidecar is on by default** — `docker compose up` now starts the **`payout`** service (no `--profile payout`). Game server reaches it at `http://payout:3091` inside the stack.
- [OPS] **Required env (both services):** `PAYOUT_SERVICE_API_SECRET` (≥16 random chars). On **`nspace`:** `PAYOUT_SERVICE_URL=http://payout:3091` (compose default). On **`payout` only:** `NIM_PAYOUT_PRIVATE_KEY`, `NIM_NETWORK` (and optional payout tuning — see `payout-service/.env.example`).
- [SEC] **Remove the hot-wallet key from the game server** — do not leave `NIM_PAYOUT_PRIVATE_KEY` in `.env` / `server/.env` for production; compose also forces it empty on `nspace`. The signer lives only on the **`payout`** container.
- [OPS] **One-time data hand-over** — move existing `data/nim-payout-*` files into `data/payout-service/` (same JSON format). GitHub deploy runs [`scripts/migrate-payout-data-to-sidecar.sh`](../../../scripts/migrate-payout-data-to-sidecar.sh) automatically after each backup (idempotent). Full steps: [docs/payout-cutover-runbook.md](../../../docs/payout-cutover-runbook.md).
- [OPS] **Verify after deploy:** `curl http://127.0.0.1:3091/health` → `{"ok":true,"service":"nspace-payout"}`; **`/admin/system`** (system admin wallet) shows green/yellow/red for **Payout service** with a `docker compose logs payout --tail 100` hint when degraded.
- [OPS] **Never run two payout processors** — do not roll back to an old game-server image that sends NIM in-process while the sidecar also holds the wallet key (double-pay risk). See runbook rollback section.
