# World Cup soccer — local issues pipeline

A self-contained backlog for the seasonal soccer feature. Each `NN-slug.md` issue
carries YAML frontmatter (`id`, `milestone`, `depends_on`, `status`, `acceptance`,
`verify`) followed by implementation notes. The whole `worldcup/` tree (this backlog
plus `server/src/worldcup/` and `client/src/worldcup/`) is meant to be deleted in one
go when the feature is deprecated.

## How the pipeline runs

Issues are executed in dependency order. Independent issues (no shared files / no
`depends_on`) can be built in parallel by separate agents; dependent issues run in
order. Between issues, run the gates:

- `npm run build` (client + server typecheck/build)
- `npm test -w server` (unit tests for pure logic: ball physics, scoring)

At each milestone boundary there is a **manual in-game checkpoint** — the feature is
left in a testable state for a human to verify before the next milestone starts.

```mermaid
flowchart TD
  s00[00-scaffold] --> p10[10-ball-physics]
  s00 --> p20[20-score-store]
  p10 --> p11[11-field-room]
  p11 --> p12[12-server-tick-sync]
  p12 --> p13[13-client-render]
  p13 --> M1{{M1 checkpoint: kick the ball}}
  p20 --> p21[21-goal-detection]
  M1 --> p21
  p21 --> p22[22-country-picker]
  p21 --> p23[23-scoreboard-hud]
  p20 --> p24[24-leaderboard-api]
  p22 --> M2{{M2 checkpoint: score + tally}}
  p23 --> M2
  p24 --> M2
  M1 --> p30[30-place-ball-server]
  p30 --> p31[31-place-ball-client]
  p31 --> M3{{M3 checkpoint: place anywhere}}
  M2 --> p40[40-docs-patchnotes]
  M3 --> p40
```

## Status legend

`todo` -> `in_progress` -> `done`. Update an issue's frontmatter `status` as it
moves. The aggregate status also lives in the chat plan's todo list.

## Milestones

- **M0** — scaffolding, feature flag, docs/patchnote stubs (`00`).
- **M1** — kickable ball in the field room, no scoring (`10`–`13`).
- **M2** — goals, country picker, tally, leaderboard API (`20`–`24`).
- **M3** — place a ball in any map (`30`–`31`).
- **M4** — finalize docs + public patch notes (`40`).

## Deprecation

1. `WORLDCUP_ENABLED=0` (server) + `VITE_WORLDCUP_ENABLED=0` (client) disables it.
2. Full removal: delete `worldcup/`, `server/src/worldcup/`, `client/src/worldcup/`,
   then remove the `worldcup`-tagged hook lines (grep `worldcup`). Keep
   `server/data/worldcup-scores.json` as the final archive if desired.
