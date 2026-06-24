# Reasons — 0.4.5 (patch-notes version)

**Patch-notes version:** `0.4.5` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Unified 6-character join codes for wallet rooms and Play Spaces (legacy 8-char slugs still resolve), Match Result Overlay at end of 1v1 with movement freeze + linger countdown, smoother pitch free-move (faster server rate + client prediction), Match timing default bumps (10s kickoff countdown / 10s result linger), Match Pitch build restrictions aligned with the field, Vercel admin wildcard rewrites + sync guard script.

---

## By area

### Repo / docs

- `CONTEXT.md` — glossary: Items Sector/Items Wheel, cosmetics shop vocabulary, Touch Joystick tied to future Pitch Movement Mode.
- `worldcup/CONTEXT.md` — Match Result Overlay, Kickoff Countdown copy (N not 3), Pitch Movement Mode + Movement Mode Toggle (designed, not shipped in this build).
- `docs/features-checklist.md` — Match HUD / Kickoff Countdown / result linger defaults.
- `docs/live-service-implementation.md` — `/admin/:path*` Vercel rewrite pattern, `npm run check-vercel-rewrites`.

### Client

- `client/src/invite/playSpaceLayout.ts` — `JOIN_CODE_LENGTH` (6), `joinCodeMatchesRoom`, unified uppercase join-code input; legacy 8-char slug path preserved.
- `client/src/invite/playSpaceLayout.test.ts` — join-code resolution tests updated.
- `client/src/worldcup/matchHud.ts` — centre-screen **Match Result Overlay** (identicons, headline, score, `Returning in N…`, Leave / Stop watching); bar keeps final score; `showResult(..., resultLingerMs)`.
- `client/src/worldcup/matchCountdown.ts` — comment: N-second countdown (server-driven).
- `client/src/game/Game.ts` — pitch movement polish: `predictSelfFieldMoveVelocity`, `pathGoalWorldXZ`, larger `SELF_EXTRAP_MAX_OFFSET_XZ_FIELD`, stick emit 50ms (matches pitch move rate).
- `client/src/main.ts` — `joinCodeMatchesRoom` for Rooms join error paths; `matchEnded` locks movement + passes `resultLingerMs`; kickoff freeze skipped when `phase === "ended"`.
- `client/src/net/ws.ts` — `matchEnded.resultLingerMs`.
- `client/vercel.json` — `/admin/:path*` wildcard (synced with root).

### Server

- `server/src/joinCode.ts` — shared 6-char join code helpers (`isJoinCode`, `normalizeJoinCode`, `walletRoomIdFromJoinCode`, legacy 8-char slug).
- `server/test/joinCode.test.ts` — unit tests.
- `server/src/directInvite/config.ts` — new Play Spaces mint 6-char uppercase slugs (`JOIN_CODE_LENGTH`).
- `server/src/roomRegistry.ts` — comment alignment with join codes.
- `server/src/rooms.ts` — `resolveJoinRoomTarget` resolves 6-char codes to wallet room or open Play Space; `RATE_MOVE_TO_FIELD_MS = TICK_MS`; `matchEnded.resultLingerMs`; end-of-match `kickoffUntilMs` freeze through linger; build/ball placement blocked on all field-like rooms.
- `server/src/worldcup/config.ts` — defaults: `WORLDCUP_MATCH_COUNTDOWN_MS` 10_000, `WORLDCUP_MATCH_RESULT_LINGER_MS` 10_000.
- `server/.env.example` — comment defaults updated.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- `vercel.json` — replace per-admin-path rewrites with `/admin/:path*`.
- `scripts/check-vercel-rewrites.cjs` — fails CI/local if root/client vercel rewrites diverge or server HTML GET routes lack coverage.
- `package.json` — `check-vercel-rewrites` script.
