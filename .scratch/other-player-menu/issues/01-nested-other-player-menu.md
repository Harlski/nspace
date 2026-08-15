---
id: "01-nested-other-player-menu"
parent: .scratch/other-player-menu/PRD.md
triage: done
status: done
depends_on: []
---

# 01 — Nested Other Player Menu

## Parent

[`.scratch/other-player-menu/PRD.md`](../PRD.md)

## What to build

Reshape the existing Other Player Menu into a nested drill-in driven by a pure
`otherPlayerMenuModel` helper (viewer role, target identity/adminness, Challenge state,
Frozen state → root rows + drill panels). Empty More / Administrative branches are omitted.

Root shows `{identicon} View {username}` and, when the target has a Challenge up, a second
root row to Accept 1v1. View drills to View Profile, Whisper, and More only when More has
children. Header Back returns one level; Esc / click-outside dismisses the whole menu.
Copy Wallet leaves this menu (profile card remains the copy path). Action Wheel and Player
Menu stay unchanged. Multi-player tile picker still chooses a target before this menu.

Do not ship a live Freeze leaf yet if Freeze policy is absent — omit Administrative until
issue 02 wires it (or show the nest only when a real child exists). Guests and wallet
viewers share the same structure without admin branches.

## Acceptance criteria

- [x] Right-click / long-press another avatar opens the nested Other Player Menu (not Action Wheel).
- [x] Root shows View {username}; Accept 1v1 only when Challenge open.
- [x] View panel: View Profile + Whisper; Copy Wallet absent; header Back works.
- [x] Esc / click-outside dismisses from any nest level.
- [x] More omitted when it would have no children for the viewer.
- [x] Non-admin viewers never see Administrative.
- [x] Multi-player picker still precedes the menu on stacked tiles.
- [x] Unit tests on `otherPlayerMenuModel` for root / actions / More gating.

## Blocked by

None - can start immediately.

## Comments

Implemented 2026-08-08 with issue 02: pure `otherPlayerMenuModel` + HUD drill-in renderer.
Admin nest appears once `onFreeze` is wired (issue 02).
