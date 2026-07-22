# Payout Service — production cutover runbook

Hard, **single-release** cutover from in-process Nimiq payouts in the game server to the dedicated **Payout Service** sidecar. There is **no** phased dual-run: two processors must never share one hot wallet ([ADR-0002](../adr/0002-payouts-in-dedicated-sidecar-service.md)).

## Preconditions

- Issues 1–5 are deployed (Outbox delivery, balance pull, reliability, all reward triggers, admin/reporting proxies).
- `PAYOUT_SERVICE_API_SECRET` (≥16 random chars) is ready for **both** `nspace` and `payout` containers.
- `NIM_PAYOUT_PRIVATE_KEY` will live **only** on the `payout` service after cutover — remove it from the game-server env.
- Run `/review-security` on the cutover diff before production deploy (key relocation, inter-service auth, idempotency, double-spend).

## What changes at cutover

| Before | After |
|--------|-------|
| Queue + signer in `nspace` (`server/data/nim-payout-*`) | Queue + signer in `payout` (`./data/payout-service/`) |
| `NIM_PAYOUT_PRIVATE_KEY` on game server | Key **only** on `payout` |
| In-process payout worker blocks event loop | Game server enqueues to Outbox; sidecar sends |
| `docker compose --profile payout up` | `payout` starts **by default** with `docker compose up` |

On-disk payout file **names and JSON shapes are unchanged** for queue/history — this is a directory hand-over, not a data transform. Claim-id dedupe files later moved from full JSON arrays to append-only `.jsonl` (see [nim-payout-tracing.md](nim-payout-tracing.md)); startup migrates legacy `*-claim-ids.json` once.

## Cutover steps (production)

1. **Announce maintenance** — brief player notice if desired (optional `POST /api/hooks/pre-deploy-restart`).

2. **Stop the stack** (no dual processor):
   ```bash
   docker compose stop
   ```

3. **Back up payout data** (both old and new locations):
   ```bash
   tar -czf payout-backup-$(date -u +%Y%m%dT%H%M%SZ).tar.gz data/nim-payout-* data/payout-service 2>/dev/null || true
   ```

4. **Hand over the payout data directory unchanged** — move every existing payout artifact from the game-server data tree into the sidecar volume:
   ```bash
   mkdir -p data/payout-service
   # From default in-process location (host ./data → /app/server/data in container):
   for f in nim-payout-pending.json nim-payout-sent.jsonl nim-payout-manual-bulk.jsonl nim-payout-dead-letter.jsonl accepted-claim-ids.json accepted-claim-ids.jsonl; do
     [ -f "data/$f" ] && mv "data/$f" "data/payout-service/"
   done
   [ -d data/nim-payout-recipient-sent ] && mv data/nim-payout-recipient-sent data/payout-service/
   ```
   If you previously used `NIM_PAYOUT_DATA_DIR` on the game server, move files from that path instead of `./data/`.

5. **Update environment** (root `.env` and/or `server/.env`):
   - **Add / keep on game server:** `PAYOUT_SERVICE_URL=http://payout:3091`, `PAYOUT_SERVICE_API_SECRET=…`
   - **Remove from game server:** `NIM_PAYOUT_PRIVATE_KEY`, `NIM_PAYOUT_DATA_DIR`, and other in-process payout worker vars (`NIM_PAYOUT_PROCESS_INTERVAL_MS`, `NIM_PAYOUT_BURST_PER_TICK`, …)
   - **Set on payout service only:** `NIM_PAYOUT_PRIVATE_KEY`, `NIM_NETWORK`, optional `NIM_PAYOUT_TX_MESSAGE`, retry/flush tuning (see [payout-service/.env.example](../../payout-service/.env.example))

6. **Deploy the cutover release**:
   ```bash
   git pull   # or CI deploy (GitHub Actions runs migrate script after backup)
   docker compose build
   docker compose up -d
   ```

   On each GitHub deploy, after the full `data/` tarball backup, [`scripts/migrate-payout-data-on-host.sh`](../scripts/migrate-payout-data-on-host.sh) runs idempotently (no-op once legacy files are already under `data/payout-service/`). If `data/` or `data/payout-service/` is owned by root (normal after Docker writes), the host wrapper re-runs the same migration via a one-off Docker container as root.

7. **Verify** (see below). Do **not** roll back to an old game-server image that still runs the in-process processor while the sidecar also holds the key.

## Post-cutover verification

### Service health

```bash
curl -sS http://127.0.0.1:3091/health
# → {"ok":true,"service":"nspace-payout"}

docker compose logs payout --tail 50
docker compose logs nspace --tail 100 | grep -E 'payout-outbox|payout-service|\[event-loop\]'
```

If you see regular `[event-loop] stall ~400–500 ms` every ~2.5s while idle, check whether `data/payout-outbox/outbox.jsonl` has grown large (delivered lines used to accumulate forever and were re-parsed every `PAYOUT_OUTBOX_DELIVERY_INTERVAL_MS`). Current builds compact delivered history on startup and after each successful drain; confirm with:

```bash
ls -lah data/payout-outbox/outbox.jsonl
wc -l data/payout-outbox/outbox.jsonl
```

After deploy/restart you should see a one-shot `[payout-outbox] Compacted outbox.jsonl: N → M undelivered` log if history was bloated, then stall spam should stop.

### Functional smoke

- Complete a block claim (or trigger a test reward) — Pay-Intent appears in Outbox, sidecar logs `[payout-service] Sent …`.
- `GET /api/nim/payout-balance` returns a balance (game server pulls from sidecar cache).
- `/payouts` and admin **Payout in full** still work (proxied to sidecar).

### Event-loop stall regression (the original bug)

After real payout activity:

- **Game server logs** should **not** show `[event-loop] stall` lines correlated with payout sends (those moves to `payout` container: `[payout-service] Sent …`).
- **In-game latency graph** (debug panel → click your identicon) should stay flat during payouts instead of periodic multi-second spikes.

If stalls persist on `nspace`, confirm no old in-process processor is running and `NIM_PAYOUT_PRIVATE_KEY` is absent from the game-server env.

## Rollback (emergency only)

Rollback risks **double-paying** if both old and new processors run against the same wallet. Safe rollback:

1. Stop **both** `nspace` and `payout`.
2. Restore the pre-cutover tarball of payout data to **one** location only.
3. Either run the **previous** single-process release **or** the new sidecar release — **never both**.

Prefer fixing forward: sidecar holds the queue; game-server Outbox redelivers safely via `claimId` idempotency.

## Local development (no Docker)

```bash
# Terminal 1 — payout sidecar (set NIM_PAYOUT_PRIVATE_KEY in payout-service/.env)
npm run dev:payout

# Terminal 2 — game server (server/.env: PAYOUT_SERVICE_URL + PAYOUT_SERVICE_API_SECRET)
npm run dev -w server
```

## Related docs

- [PRD — Dedicated NIM Payout Service](prd/payout-service.md)
- [docker-deployment.md](docker-deployment.md) — Compose services and env
- [nim-payout-tracing.md](nim-payout-tracing.md) — `NIM_PAYOUT_TX_TRACE` on the **sidecar**
