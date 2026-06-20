---
id: "00-scaffold"
milestone: M0
depends_on: []
status: done
acceptance:
  - server/src/worldcup/config.ts exposes WORLDCUP_ENABLED + field/goal/tuning constants
  - client/src/worldcup/config.ts exposes WORLDCUP_ENABLED + FIELD_ROOM_ID
  - worldcup/issues backlog + README pipeline exist
  - THE-LARGER-SYSTEM.md records the dynamic-object decision with a reason file
  - patchnote/versions/UNRELEASED captures the feature stub
verify:
  - "grep -r worldcup server/src/worldcup client/src/worldcup (files exist)"
  - "npm run build (no type errors from the new config modules)"
---

# 00 — Scaffolding & feature flag

Create the isolated feature folders, the master `WORLDCUP_ENABLED` flag (server env +
client `VITE_` build flag), this issues backlog, the THE-LARGER-SYSTEM recorded
decision + companion reason file, and a patch-note stub under `UNRELEASED`.

Notes:
- Flag defaults ON (seasonal feature the team wants to test now); `=0` disables.
- Keep all constants (field bounds, goal zones, physics tuning) in `config.ts` so the
  rest of the feature imports one source of truth.
