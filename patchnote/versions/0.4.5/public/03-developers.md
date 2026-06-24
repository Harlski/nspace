# Public patch notes — developers (`0.4.5`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [NEW] **`server/src/joinCode.ts`** — shared 6-char join code (`JOIN_CODE_LENGTH`, `isJoinCode`, `normalizeJoinCode`, `walletRoomIdFromJoinCode`) plus `isLegacyPlaySpaceSlug` for pre-unification 8-char Play Space slugs. Client mirror in `client/src/invite/playSpaceLayout.ts` (`joinCodeMatchesRoom`, `normalizeJoinCodeInput`).
- [CHANGE] **`resolveJoinRoomTarget`** (`rooms.ts`) — 6-char input tries wallet room id first, then open Play Space by uppercase slug; legacy 8-char slug path unchanged.
- [NEW] **WS `matchEnded`** includes **`resultLingerMs`** (from `WORLDCUP_MATCH.resultLingerMs`). Server sets `kickoffUntilMs` through the linger window so movement stays frozen until teardown.
- [CHANGE] Pitch **`moveTo`** rate limit uses **`RATE_MOVE_TO_FIELD_MS`** (`TICK_MS`) on field-like rooms vs `RATE_MOVE_TO_MS` elsewhere. Client stick emit interval aligned (50ms).
- [CHANGE] **`worldcupIsFieldLikeRoom`** gates block placement, floor recolor, and admin ball placement (not only `FIELD_ROOM_ID`).
- [OPS] **`scripts/check-vercel-rewrites.cjs`** — validates vercel.json parity and that server `app.get` HTML routes are covered by rewrites.
