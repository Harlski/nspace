# Public patch notes — operators (`0.5.4`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- **Advertise admin credit can now rescue paid-but-unverified adverts.** On `/admin/campaign`, the credit box now appears for **unfunded** campaigns (draft / pending payment). Entering a NIM amount funds the advert and moves it to **Pending approval** (it receives a synthetic `admin-credit:` transaction so it can be approved like any funded advert). Use this when a real payment landed without the transaction message and could not be auto-verified. No new env vars or migrations.
