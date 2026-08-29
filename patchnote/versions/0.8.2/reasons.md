# Reasons — 0.8.2 (patch-notes version)

**Patch-notes version:** `0.8.2` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Mosquito Tag: in-room mini-game (Tag Call / Tag Round) on the Games Wheel, not World Cup. Tag Countdown is 7s (Participants walk, rules overlay). Tag Round 60s. Stung is a 30s Path Playback slow with a pulsing red avatar cue. Caller Start/Cancel and Join count live on the Tag Call. Hotfix tier: Holder obtain flash is red; Boost Pads skip tiles with a placed block.

Free Play Field scoreboard: on narrow/touch layouts the in-room country ranking is a compact Scoreboard Chip (`1. {flag} {goals}`, no country picker). Tap opens the Leaderboard Modal (full ranking, UTC reset note, yesterday's champion). Desktop panel still expands/collapses in place.

---

## By area

### Repo / docs

- ADRs 0018–0021, `CONTEXT.md` glossary, `docs/THE-LARGER-SYSTEM.md` in-room mini-games, `docs/features-checklist.md`, `docs/process.md` env, `docs/build.md` WS types.
- `worldcup/CONTEXT.md` Scoreboard Chip / Leaderboard Modal. `docs/features-checklist.md` live field scoreboard HUD.

### Client

- Tag Call bubble sizes from measured label + left/right padding. Join is a smaller HUD check **inside `.hud`** (top strip stacks above it). Caller Start/Cancel HUD buttons on the Caller's Tag Call. Party count + identicons above the label (starts at 1 / Caller). Participant Marker reuses the Attention Marker V look (green, avatar-attached). Holder mosquito is larger with a glow; becoming Holder flashes the screen **red** and shows a popup. Boost Pads are green teleporter-portal pillars on empty walkable tiles (no placed block). Countdown HUD shows rules copy. Stung loser gets a pulsing red identicon halo for the 30s slow (`stungPlayerId` / `stungRemainingMs` on the snapshot).
- Free Play Field **Scoreboard Chip** + **Leaderboard Modal** (`client/src/worldcup/scoreboard.ts`, `scoreboardView.ts`). Chip layout via `(max-width: 720px), (pointer: coarse)`. The country picker is not on the chip (desktop panel only). Android back closes the modal through `overlayBack`. Catalog keys `worldcup.scoreboardChipAria` / `scoreboardChipTitle` / `leaderboardTitle` / `leaderboardClose`.

### Server

- `MOSQUITO_TAG_ENABLED` (default on). `reduceTag` engine, room adapter in `rooms.ts` (`mosquitoTag` intents, tick, Path Playback boost/Stung restamp, exclusive with Challenge/Match). One Tag Call or Tag Round per room. Tag Countdown 7s (no freeze). Tag Round 60s. Stung 30s slow follows the player on the connection. Welcome still sends the Tag snapshot while Stung slow is active (even if the round is idle). Boost Pad spawn pool skips tiles that already have a placed block.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- New env `MOSQUITO_TAG_ENABLED` / `VITE_MOSQUITO_TAG_ENABLED`, both default on, distinct from `WORLDCUP_ENABLED`. Documented in `server/.env.example` and process env table.
