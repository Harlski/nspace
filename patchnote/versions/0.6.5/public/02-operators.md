# Public patch notes — operators (`0.6.5`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [OPS] Deploy **nspace** and **payout** together for tutorial faucet priority. Pay-Intents may include optional `priority: true`; the Outbox and Payout Service process those before the normal FIFO queue. Auto-bulk still skips priority jobs; end-of-day flush and admin Payout in full still include them. No new env vars; no queue file migration.
