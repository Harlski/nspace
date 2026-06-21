# Post-prod backlog

Local issue tracker for work **after** the gameplay-loop blocker ships to production.

**Policy:** Fix **bugs first** (`01`–`03`). Run **`/grill-with-docs`** on enhancements (`04`–`06`) once bugs are closed.

## Status legend

| Triage role | Meaning |
|-------------|---------|
| `needs-triage` | Not yet evaluated (enhancements waiting for grill) |
| `needs-info` | Waiting on reporter |
| `ready-for-agent` | Agent brief attached — pick up with `/implement` |
| `ready-for-human` | Needs human judgment or device-only verification |
| `wontfix` | Closed |

## Queue

| # | File | Category | Triage | Summary |
|---|------|----------|--------|---------|
| 01 | [issues/01-oversized-hud-buttons-prod.md](issues/01-oversized-hud-buttons-prod.md) | bug | `done` | Reconnect / teleporter pills huge on live, fine on localhost |
| 02 | [issues/02-joystick-runaway-pay.md](issues/02-joystick-runaway-pay.md) | bug | `done` | Touch joystick: player keeps running after finger release (Pay) |
| 03 | [issues/03-1v1-goal-freeze-pay.md](issues/03-1v1-goal-freeze-pay.md) | bug | `done` | 1v1 scorer stuck until opponent scores (Pay suspected) |
| 04 | [issues/04-off-screen-ball-indicator.md](issues/04-off-screen-ball-indicator.md) | enhancement | `done` | Ball Edge Marker when ball is off-screen (World Cup) |
| 05 | [issues/05-guest-invite-system.md](issues/05-guest-invite-system.md) | enhancement | `done` | Direct Invite PRD — [worldcup/PRD-direct-invite.md](../../worldcup/PRD-direct-invite.md) |
| 06 | [issues/06-uncap-free-play-nim.md](issues/06-uncap-free-play-nim.md) | enhancement | `needs-triage` | Remove or raise Free Play Field NIM earning caps |

## Pick up work

```bash
# Agent: read the issue file, then implement
cat .scratch/post-prod/issues/01-oversized-hud-buttons-prod.md
```

Update each issue's `triage:` frontmatter and append outcomes under `## Comments` when done.
