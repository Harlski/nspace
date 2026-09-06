# Public patch notes — operators (`0.8.4`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

No deploy, env, Docker, or migration changes in this build.

- [FIX] Nimiq Pay incoming payments (advertise, Unlock Pad, cosmetics) attach the intent memo so the payment-intent sidecar can auto-verify. Existing memo-less transfers still need admin credit.
