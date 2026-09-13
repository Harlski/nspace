# Public patch notes — operators (`UNRELEASED`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

_(Draft — not published.)_

- [OPS] Set **`LIVE_EVENT_ADDRESSES`** to the NimiqLIVE Wallet (comma-separated). Empty = `POST /api/live-events` refuses everyone. That wallet must already have accepted Space terms (it will not send `acceptedTermsPrivacyVersion` from the faucet).
- [OPS] Optional **`LIVE_EVENT_STORE_FILE`** (default `server/data/live-events.sqlite` on the `data/` volume) and **`LIVE_EVENT_TEST_BOOST_MS`** (default 120000). NimiqLIVE retries of the same Live Event Id should see **2xx or 409**.
- [OPS] **`/admin/live-events`**: map incoming Live Event types to an interaction and a room (current / hub / other). Coming-soon interactions save but do not run yet. Unmapped `nimiqlive.test` still starts Live Boost.

