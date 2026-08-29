# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [CHANGE] Free Play Field scoreboard: `scoreboardView.ts` ranks countries and chooses Scoreboard Chip vs panel (`max-width: 720px` or coarse pointer). Chip tap opens a Leaderboard Modal; `overlayBack` closes it on Android back. New catalog keys `worldcup.scoreboardChipAria` / `scoreboardChipTitle` / `leaderboardTitle` / `leaderboardClose`. No WS or API change.
