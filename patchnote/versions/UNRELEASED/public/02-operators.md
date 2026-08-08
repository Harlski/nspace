# Public patch notes — operators (`UNRELEASED`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

_(Draft — not published.)_

- **[OPS]** **`MOVE_ORDER_BROADCAST` default flipped on** — Path Playback dual-send
  (`moveOrder` / `moveAbort`, omit walker pose from tick `stateDelta` in click-to-walk rooms)
  is now the default. Set **`MOVE_ORDER_BROADCAST=0`** on the game server to revert to the
  old snapshot pose stream. Bare/unset env gets the new behavior (no need to set `=1`).
  Analytic path pose skip stays tied to Path Playback being enabled.
