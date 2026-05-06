# Signboards (signposts) — behavior and messages

Signboards are passable half-height blocks with a short message. Any player can **hover** to read them; **placement** and **editing** rules depend on the room (see below). **Updating** or **removing** a signboard’s message is **admin-only**.

## Who can place signboards?

Rules are enforced in `server/src/rooms.ts` via `canEditRoomContent` and `isAdmin`:

| Room | Who may `placeSignboard` |
|------|---------------------------|
| **Hub** (and other default editable rooms) | Any logged-in player, within horizontal **build range** of the tile, on an empty walkable tile |
| **Canvas** | Not allowed (room content edits disabled) |
| **Chamber** | **Admins only** |
| **Player-created rooms** | The **room owner** wallet, or an admin |

Messages are limited to **`SIGNBOARD_MESSAGE_MAX_LEN`** (currently **64** UTF-16 code units — see `server/src/signboards.ts`). Rate limits apply (`RATE_PLACE_MS` in `rooms.ts`).

## Admin accounts

Admin wallets are listed in [`server/src/config.ts`](../server/src/config.ts) (`ADMIN_ADDRESSES`). One example address shipped in-repo:

- `NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y`

Add or remove addresses in `server/src/config.ts` on your fork.

## WebSocket messages

### Place (`placeSignboard`)

```json
{
  "type": "placeSignboard",
  "x": <tile_x>,
  "z": <tile_z>,
  "message": "Short message"
}
```

Requirements: walkable tile, no obstacle at tile, no existing signboard there, within placement radius, message non-empty and within max length.

### Update message (`updateSignboard`) — admin only

```json
{
  "type": "updateSignboard",
  "signboardId": "<id>",
  "message": "New text"
}
```

### Remove (`removeSignboard`) — admin only

```json
{
  "type": "removeSignboard",
  "signboardId": "<id>"
}
```

## Client UX

- Hovering a signboard shows a tooltip (message + creator address).
- Updates are broadcast as `type: "signboards"` with the full list for the room.

## Persistence

- Storage file: `signboards.json` under the server data directory (with Docker: host `./data` → `/app/server/data`).
- In-memory changes mark data **dirty**; `signboards.ts` auto-saves every **10 seconds** when dirty, and flushes on server shutdown (`flushSignboardsSync` in `server/src/index.ts`).

## Technical references

- [`server/src/signboards.ts`](../server/src/signboards.ts) — CRUD, max length, save interval
- [`server/src/rooms.ts`](../server/src/rooms.ts) — handlers for `placeSignboard`, `updateSignboard`, `removeSignboard`

## Possible future work

In-game admin UI, rich text, extra tiers — treat as product backlog; see [`docs/brainstorm/README.md`](brainstorm/README.md) for non-normative notes.
