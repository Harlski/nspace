# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Direct Invite evolved into a multi-person, invite-only **Play Space**: one private ephemeral
room per link, up to `DIRECT_INVITE_MAX_OCCUPANTS` (default 8) occupants, in-room 1v1s,
guest confinement, and guests excluded from NIM. Fixes the guest→chamber resume bug.

---

## By area

### Repo / docs

- `worldcup/CONTEXT.md`: added **Play Space** and **Guest** glossary terms.
- `docs/features-checklist.md`: rewrote the Direct Invite entry as **Play Space (invite-only multiplayer room)**.

### Client

- `client/src/invite/lobbyOverlay.ts`: roster overlay (`occupancy/capacity`, no Start button, share/QR for any occupant, host-only Leave); new `DirectInviteLobbyState` shape.
- `client/src/invite/splash.ts`: copy → "Join {host}'s play space".
- `client/src/main.ts`: invite entry connects without `resume` (honors explicit play-space room); `directInviteState` handler uses roster wire; `directInviteError` codes (`closed`/`full`/`expired`); Challenge UI enabled inside invite lobbies; removed `sendStartDirectInviteMatch` use; create-invite error copy.
- `client/src/net/ws.ts`: `directInviteState` wire = `roster[]`/`occupancy`/`capacity`; `directInviteError.code` union updated; removed `sendStartDirectInviteMatch`.
- `client/src/style.css`: roster chip styles; dropped dead `__start` rules.

### Server

- `server/src/directInvite/types.ts`: `participants[]` + `capacity`; phases `open`/`closed`/`expired`; new event set (`claim`/`removeParticipant`/`hostLeftLobby`/`close`/…).
- `server/src/directInvite/reducer.ts`: additive claim (cap-gated, idempotent reclaim), per-participant nickname/wallet/joined, `evaluateRedeem` codes `not_found`/`expired`/`closed`/`full`; `getParticipant` helper.
- `server/src/directInvite/store.ts`: idempotent `createInvite`, multi-claim `claimInvite`, `removeInviteParticipant`, `markHostLeftLobby`, `closeInvite`; `slugByGuestId` per participant.
- `server/src/directInvite/config.ts`: `MAX_PLAY_SPACE_OCCUPANTS` (env `DIRECT_INVITE_MAX_OCCUPANTS`, default 8).
- `server/src/directInvite/httpHandlers.ts`: multi-claim redeem, idempotent create, per-participant nickname/upgrade.
- `server/src/directInvite/index.ts`: `DirectInviteStateWire` = roster/occupancy/capacity; `buildInviteStateWire` rewrite; export surface updated.
- `server/src/index.ts`: WS connect honors invite-lobby room over `resume`; guest confinement (force to own play space / reject without slug).
- `server/src/rooms.ts`: rewrote the directInvite block — broadcast to all occupants, `directInviteOnLobbyConnect` (participant auth, derive guestId from address), leave/disconnect handlers, slug-based teardown (`directInviteMaybeTeardown`); expiry deletes the room; `setChallenge` allowed in play spaces; `worldcupReturnEntrant` returns play-space members (incl. spectators) to their space; `joinRoom`/`enterPortal` blocked for guests.
- `server/src/worldcup/goalReward.ts`: `isGuestWallet` + early `guest` reason in `evaluateGoalReward`.
- `server/test/directInvite.test.ts`: rewritten for the multi-participant model; `server/test/worldcup-goalReward.test.ts`: guest-scorer case.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- New env var `DIRECT_INVITE_MAX_OCCUPANTS` (default 8). No persistence/migration changes (Play Spaces + guest sessions stay in-memory).

---

## Increment — Action Wheel restructure + persistent Share Panel

### Summary

Restructured the Action Wheel into a labelled multi-level tree (**Emoji · Home · Games · 1v1**)
and replaced the always-blocking invite overlay with a dismissible **Share Panel** plus a
persistent toolbar **Share Button** (room code + QR) visible to every Play Space occupant.

### Client

- `client/src/ui/hud.ts`:
  - `ActionWheelLevel` → `root|emotes|home|games|soccer|soccer1v1|oneVone`; added a breadcrumb stack (`actionWheelNav`, `pushActionWheelLevel`/`popActionWheelLevel`) so the shared `soccer1v1` leaf backs out to whichever parent opened it.
  - `slotOrderFor`/`placeSlices` lay 1–5 actions onto the hex edges; root Sectors now carry text labels.
  - Tree: Home → My Rooms / Private Room; Games → Soccer → Free Play / 1v1 → This room / Invite; root 1v1 shortcut → Soccer → This room / Invite. Guest wheel trimmed to Emoji + 1v1 (Home/Free Play hidden).
  - `showActionWheel` handlers: added `onOpenRooms`, `onOpenPlaySpace` (replaces `onCreateDirectInvite`), `isGuest`, `gamesAvailable`; new handler vars + `closeActionWheel` reset.
  - HUD: persistent `.hud-playspace-share` button + `setPlaySpaceShareVisible` / `onPlaySpaceShareOpen`.
- `client/src/invite/lobbyOverlay.ts`: dismissible panel — close (✕) button + `onClose`, `isOpen()`, room-code element (`roomCodeFromShareUrl`), copy-code affordance.
- `client/src/main.ts`: caches `lastDirectInviteState` (+ `directInviteAutoShownSlug`) to re-open/auto-open the panel once per space; wires `onPlaySpaceShareOpen`; `onOpenPlaySpace` re-opens share if already in a space else creates/joins; `onOpenRooms` → `openRoomsModal`; guest flag from `selfAddress`; shows/hides the share button on welcome / `directInviteState` / error / leave.
- `client/src/style.css`: `.hud-playspace-share`, `.direct-invite-lobby__close`, `.direct-invite-lobby__code(-label|-value)` styles.

### Deploy / ops

- _(none — client-only UI; no env, API, or persistence changes)_
