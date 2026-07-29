# Reasons — 0.6.8 (patch-notes version)

**Patch-notes version:** `0.6.8` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Windows-safe server `dev` + `server/.env` bootstrap repair; `/admin/rooms` can assign Tutorial Room builders again.

---

## By area

### Repo / docs

- _(none yet)_

### Client

- _(none in this change set)_

### Server

- **Windows `npm run dev`:** `server` `dev` script no longer uses Unix `VAR=value cmd` prefixes (broken under `cmd.exe`). Relies on `server/.env` via dotenv. `scripts/ensure-payout-dev-env.cjs` creates/repairs `server/.env` from `.env.example` (incl. `JWT_SECRET` / `DEV_AUTH_BYPASS`) and upserts payout keys without clobbering the rest of the file.
- **`/admin/rooms` Tutorial builders:** `patchBuiltinRoomSettings` now accepts `tutorial` / `tutorial-staging` (previously rejected with "Not an official room id."). Persisted builders in `builtin-room-names.json` grant tutorial edit alongside `TUTORIAL_BUILDER_ALLOWLIST`.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
