---
id: "90-docs-config-patchnotes"
milestone: M9
depends_on: ["50-goalies-field", "60-goal-rewards-field", "71-match-rules", "80-spectating"]
triage: ready-for-agent
status: todo
acceptance:
  - THE-LARGER-SYSTEM.md records the paid-goals + ephemeral-room decisions with a docs/reasons rationale
  - docs/features-checklist.md reflects the new user-visible behaviour
  - server/.env.example documents every new WORLDCUP_* variable with defaults
  - patchnote/versions/UNRELEASED/public/*.md captures audience copy (CFD)
  - worldcup/issues/README pipeline + mermaid updated to include M5-M9
verify:
  - "npm run build"
  - "grep -r WORLDCUP_ server/.env.example (all new vars documented)"
  - "manual: docs read cleanly and match shipped behaviour"
---

# 90 — Docs, patch notes & config finalize

## What to build

Bring the durable docs and operator surfaces in line with the shipped behaviour.

- Record the economic decision (paying NIM for Free Play Field goals) and the ephemeral
  Match Pitch model in `docs/THE-LARGER-SYSTEM.md`, with a companion `docs/reasons/
  reason_*.md` rationale per the repo handbook.
- Update `docs/features-checklist.md` for the new user-visible features (1v1 Matches,
  Goalies, Spectating, goal rewards).
- Document every new `WORLDCUP_*` env var (goalie mode, reward amount/cap/budget/min-players,
  match duration/golden-goal cap, spectator cap, challenge timeout) in `server/.env.example`
  with defaults.
- Capture audience-facing patch notes under `patchnote/versions/UNRELEASED/public/*` (Brief
  → Developers) via the completed-feature-document flow.
- Refresh the `worldcup/issues/README.md` pipeline + mermaid to include milestones M5–M9.

## Acceptance criteria

- [ ] THE-LARGER-SYSTEM note + matching `docs/reasons/reason_*.md` exist and explain the why.
- [ ] `docs/features-checklist.md` lists the new behaviour accurately.
- [ ] All new env vars are documented in `server/.env.example` with defaults.
- [ ] UNRELEASED public patch notes cover the feature across the audience tiers.
- [ ] Backlog README pipeline/mermaid include M5–M9.
- [ ] `npm run build` passes.

## Blocked by

- 50-goalies-field
- 60-goal-rewards-field
- 71-match-rules
- 80-spectating
