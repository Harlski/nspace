# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [NEW] Mosquito Tag achievement events: `tag_call_raised`, `tag_joined`, `mosquito_passed`, `mosquito_passed_clutch` (≤3s remaining), `tag_stung`, `tag_boost_pad`. Category `mosquito_tag` under Minigames. Evaluator: `server/src/mosquitoTag/achievements.ts`. Progress skipped when `MOSQUITO_TAG_ENABLED` is off.
- [FIX] Login streak credits a UTC calendar day on wallet WebSocket room enter (including cached JWT reconnect), not only `POST /api/auth/verify`. Same-day credits skip rewriting `login-streaks.json`. Guests are ignored.

