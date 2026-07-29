# Reasons — 0.6.9 (patch-notes version)

**Patch-notes version:** `0.6.9` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Hotfix: Tutorial lesson chat mute was stuck after leaving Tutorial Room; hide chat HUD in lesson; no NPCs in tutorial rooms.

---

## By area

### Repo / docs

- Checklist / PRD wording aligned with tutorial chat behavior.

### Client

- **Tutorial lesson chat:** `tutorialSuppressesSocial` is room-scoped (matches server `tutorialLessonSuppressesChat`); lesson mode hides the chat HUD in Tutorial Room so Hub chat works immediately after leaving (was stuck muted until another room hop). `hud.setChatHiddenForTutorial` / Enter-to-chat guard.

### Server

- **Tutorial NPCs:** `roomAllowsFakePlayers` returns false for tutorial runtime + staging rooms (clear path for first-contact).

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
