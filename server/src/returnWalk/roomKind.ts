/**
 * Public Room kinds for the Resident directory.
 * Commons room id is hub. Hub home (chamber) is not a Public Room.
 */

import { isInviteLobbyRoomId } from "../directInvite/config.js";
import {
  CHAMBER_ROOM_ID,
  HUB_ROOM_ID,
  normalizeRoomId,
} from "../roomLayouts.js";
import {
  TUTORIAL_ROOM_ID,
  TUTORIAL_STAGING_ROOM_ID,
} from "../tutorial/roomIds.js";
import { isMatchPitchRoomId } from "../worldcup/config.js";
import type { PublicRoomKind } from "./constants.js";

/** Classify a room for GET /api/resident/public-rooms. null = omit (Hub home). */
export function classifyPublicRoomKind(
  roomId: string
): PublicRoomKind | null {
  const id = normalizeRoomId(roomId);
  if (id === CHAMBER_ROOM_ID) return null;
  if (id === HUB_ROOM_ID) return "commons";
  if (id === TUTORIAL_ROOM_ID || id === TUTORIAL_STAGING_ROOM_ID) {
    return "tutorial";
  }
  if (isInviteLobbyRoomId(id)) return "playSpace";
  if (isMatchPitchRoomId(id)) return "matchPitch";
  return "public";
}
