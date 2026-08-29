# Public patch notes — developers (`0.8.2`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [NEW] Mosquito Tag: client sends `mosquitoTag` with `action` `raise` | `cancel` | `join` | `leave` | `start`. Server broadcasts `mosquitoTag` snapshots (also on `welcome`, including while Stung slow is still active after the round). Pure `reduceTag` engine; `rooms.ts` is the room adapter. One Tag Call or Tag Round per room. Exclusive with soccer Challenge/Match per player. Catalog keys under `mosquitoTag.*`. ADRs 0018–0021.
- [FIX] Holder screen flash is red (`.hud-tag-holder-flash`). Boost Pad spawn pool skips occupied `tileKey` / `blockKey` cells (`mosquitoTagOccupiedTileKeys`).
- [CHANGE] Free Play Field scoreboard: `scoreboardView.ts` ranks countries and chooses Scoreboard Chip vs panel (`max-width: 720px` or coarse pointer). Chip is high score only (no country picker); tap opens a Leaderboard Modal; `overlayBack` closes it on Android back. New catalog keys `worldcup.scoreboardChipAria` / `scoreboardChipTitle` / `leaderboardTitle` / `leaderboardClose`. No WS or API change.
