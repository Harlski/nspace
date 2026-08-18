# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [NEW] **Chat substitution** module (`chatSubstitutionStore.ts`): exact match after trim, no case folding, no substring/regex. Public `chat` only. `applyStoredChatSubstitution` runs in `rooms.ts` before `censorChat`.
- [NEW] Admin JSON: `GET`/`POST /api/admin/chat/substitutions`, `PUT`/`DELETE /api/admin/chat/substitutions/:id` (system admin). Errors: `empty_trigger`, `empty_replacement`, `duplicate_trigger`, `not_found`.
