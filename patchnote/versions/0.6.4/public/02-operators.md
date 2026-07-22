# Public patch notes — operators (`0.6.4`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [PERF] **Claim-id dedupe is append-only.** Game outbox and payout sidecar no longer rewrite multi-MB `delivered-claim-ids.json` / `accepted-claim-ids.json` on every claim (that was causing heavy disk writes and frequent `[event-loop] stall` under mining).
- [OPS] On first start after upgrade you should see one-shot migrations:
  - `[payout-outbox] Migrated delivered-claim-ids.json → .jsonl (N ids)`
  - `[payout-service] Migrated accepted-claim-ids.json → .jsonl (N ids)`
  Legacy files become `*.json.pre-jsonl.bak` (safe to delete after you confirm migration). Live files: `data/payout-outbox/delivered-claim-ids.jsonl` and `data/payout-service/accepted-claim-ids.jsonl`.
- [OPS] After deploy: confirm those migration log lines once; watch stall rate and `iotop` write bandwidth (see [docs/nim-payout-tracing.md](../../../../docs/nim-payout-tracing.md)).
- [CHANGE] Default tutorial Pay escape: `VITE_TUTORIAL_ESCAPE_MS=120000` (2 min), countdown `VITE_TUTORIAL_ESCAPE_COUNTDOWN_MS=10000`. Override in the client build env if needed; see `server/.env.example`.
