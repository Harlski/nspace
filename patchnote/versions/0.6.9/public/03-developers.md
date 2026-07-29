# Public patch notes — developers (`0.6.9`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [FIX] `tutorialSuppressesSocial(welcome, roomId)` is room-scoped to match server `tutorialLessonSuppressesChat`; HUD `setChatHiddenForTutorial` hides the chat row in lesson mode.
- [CHANGE] `roomAllowsFakePlayers` excludes tutorial runtime and staging rooms.
