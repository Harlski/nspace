# Public patch notes — developers (`0.6.6`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [CHANGE] Tutorial Unlock: `signTutorialDoorUnlock` + `signPlainMessage` replace Pay send / Hub `checkout`. Constant `TUTORIAL_DOOR_UNLOCK_MESSAGE`. Still ends in optimistic `POST /api/tutorial/door-sent`. ADRs 0005 / 0007 + `docs/reasons/reason_452918.md`.
- [NEW] Player dossier: `GET /admin/user/:profile`, `GET /api/admin/player?q=`, `POST /api/admin/player/tutorial-reset`; moderation `target` accepts username; action `tutorial_reset`. Snapshot rows include `username` / `displayName`. Connect Notice links → `/admin/user/{wallet}`.
