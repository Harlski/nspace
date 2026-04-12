# Signboard Feature - Admin Guide

## Overview
Admins can now place signboards throughout the nspace world. Signboards are special blocks that display a custom message when players hover over them.

## Admin Account
The following wallet address has been granted admin privileges:
- `NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y`

Additional admin addresses can be added in `/home/johd/Projects/nspace/server/src/config.ts`.

## Using Signboards

### Placing a Signboard
Admins can place signboards by sending a WebSocket message to the server:

```json
{
  "type": "placeSignboard",
  "x": <tile_x_coordinate>,
  "z": <tile_z_coordinate>,
  "message": "Your message here (max 500 characters)"
}
```

**Requirements:**
- The tile must be walkable (within room bounds)
- The tile must be empty (no existing blocks)
- The admin must be within the placement radius of the tile
- Messages are limited to 500 characters

**What happens:**
- A passable, half-height white block (colorId: 8) is placed at the location
- The signboard message is stored persistently on the server
- All players in the room will see the new signboard immediately

### Viewing Signboards
When any player (admin or not) hovers their mouse over a signboard:
- A tooltip appears in the top-left corner of the screen
- The tooltip displays the signboard icon (📋) and message
- The footer shows the creator's wallet address (formatted as `NQ07...ABCD`)

### Updating a Signboard Message
Admins can update an existing signboard's message:

```json
{
  "type": "updateSignboard",
  "signboardId": "<signboard_id>",
  "message": "Updated message here"
}
```

The signboard ID can be found in the server data or logs.

### Removing a Signboard
Admins can delete a signboard:

```json
{
  "type": "removeSignboard",
  "signboardId": "<signboard_id>"
}
```

This removes both the signboard data and the visual block from the game.

## Technical Details

### Server Components
- **`/server/src/config.ts`**: Admin wallet address configuration
- **`/server/src/signboards.ts`**: Signboard data persistence and management
- **`/server/data/signboards.json`**: Persistent storage for all signboards (auto-saved every 10 seconds)

### Client Components
- **Hover Detection**: Automatically detects when a player hovers over a signboard
- **Tooltip UI**: Displays message, creator, and creation timestamp
- **Real-time Updates**: All clients receive signboard updates immediately via WebSocket

### Data Structure
Each signboard contains:
- `id`: Unique identifier (format: `roomId_x_z_timestamp`)
- `roomId`: The room where the signboard is placed
- `x`, `z`: Tile coordinates
- `message`: The signboard message content
- `createdBy`: Wallet address of the admin who created it
- `createdAt`: Unix timestamp of creation
- `updatedAt`: Unix timestamp of last update

### Network Protocol
Signboard data is sent to clients in the `welcome` message when joining a room:
```json
{
  "type": "welcome",
  "signboards": [
    {
      "id": "hub_5_10_1744692000000",
      "x": 5,
      "z": 10,
      "message": "Welcome to nspace!",
      "createdBy": "NQ97...",
      "createdAt": 1744692000000
    }
  ]
}
```

Updates are broadcast to all players:
```json
{
  "type": "signboards",
  "roomId": "hub",
  "signboards": [ /* updated list */ ]
}
```

## Future Enhancements
Potential improvements to consider:
- Admin UI panel for creating/editing signboards in-game
- Rich text formatting support (bold, links, etc.)
- Different signboard styles (colors, icons)
- Permission levels (multiple admin tiers)
- Signboard usage analytics
