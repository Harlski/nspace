---
id: "05-social-play-space-pack"
parent: .scratch/achievements-wave/PRD.md
triage: done
status: done
depends_on:
  - "03-level-ladder-reward-catalog"
---

# 05 — Social + Play Space pack

## Parent

[`.scratch/achievements-wave/PRD.md`](../PRD.md)

**What to build:** **Between Us** (first Whisper, Pastel Rounded `ach-*` chat bubble),
**Take a Look** (Other Player Menu → View Profile), **Private Room** (open your Play
Space), **Come On In** (host, once, when a Guest claims the Direct Invite and lands).
Live-only; no catch-up. Hello World and Know Thyself stay as they are.

**Blocked by:** 03 — Level ladder + reward catalog

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Between Us Completes on first Whisper; grants the Pastel Rounded `ach-*` SKU.
- [ ] Public chat does not Complete Between Us.
- [ ] Take a Look Completes on Other Player Menu View Profile, not on opening your own
      profile.
- [ ] Private Room Completes when the player opens their Play Space.
- [ ] Come On In Completes once for the host on successful Guest claim; Guest does not
      earn it; opening Play Space alone does not earn it.
- [ ] No silent catch-up for this pack; live Banner/Celebration as usual.
- [ ] Tests cover Whisper vs public chat, viewer vs self profile, host vs Guest.

## Comments
- Implemented in achievements-wave /implement pass (2026-08-14).
