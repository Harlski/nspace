# Public patch notes — developers (`0.9.2`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [CHANGE] Username gate: `getUsernamePromptStatus` returns `mustSetUsername: true` and `deferralsRemaining: 0` when the wallet has no custom username and is not username-set banned. `POST /api/player-profile/username/defer` returns `403 username_prompt_required`. `walletRequiresUsername` closes the game WebSocket with `4009 username_required` before `addClient` (guests and stream observers exempt).
- [CHANGE] Nimiq Pay tutorial no longer sets `deferUsernameForTutorial`. The client gate runs before `enterGame` for every wallet login.
- [CHANGE] Hourly digest: `playerLabel` prefers `playerHasCustomUsername`. Table columns are `# Player Played NIM Now S Chat New Pay`.
