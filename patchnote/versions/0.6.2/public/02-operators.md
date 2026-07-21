# Public patch notes — operators (`0.6.2`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [NEW] `/analytics` **Chosen flags** panel — among unique visitors in the selected time window, pick-up rate and ranked distribution of each wallet's **current** Country (profile flag). Hint on the page: chosen identity, not proven location. No new env vars.
- [NEW] `/analytics` **Nimiq Pay** panel — Pay unique (DAU-style), Pay first-time, returning, other clients, Pay session starts, active play on Pay sessions, NIM paid to the Pay cohort, plus a per-day Pay unique / FTU table. No new env vars.
- [FIX] Admin camera **Max frustum** works again in Commons/Hub and Chamber (was stuck at the player room cap of 18).
- [NEW] **`[event-loop] stall` lines now show GC attribution.** Each stall line ends with a garbage-collection summary for the blocked window, e.g. `(gc 831 ms in window: 2 major, 6 minor)` or `(gc 0 ms)`. When diagnosing occasional lag: `gc 0 ms` means the stall was application code, a non-zero GC total means it was garbage collection (tune heap/allocation). No new env vars — `EVENT_LOOP_STALL_LOG_MS` still controls the threshold. See [docs/nim-payout-tracing.md](../../../docs/nim-payout-tracing.md).
