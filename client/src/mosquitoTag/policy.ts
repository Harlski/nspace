import {
  CANVAS_ROOM_ID,
  PIXEL_ROOM_ID,
  normalizeRoomId,
} from "../game/roomLayouts.js";
import { TUTORIAL_ROOM_ID, TUTORIAL_STAGING_ROOM_ID } from "../tutorial/flow.js";
import { FIELD_ROOM_ID, isMatchPitchRoomId } from "../worldcup/config.js";

/** Rooms where Mosquito Tag must not run (mirrors server `mosquitoTag/policy`). */
export function mosquitoTagAllowedInRoom(roomId: string): boolean {
  const n = normalizeRoomId(roomId);
  if (isMatchPitchRoomId(n)) return false;
  if (n === FIELD_ROOM_ID) return false;
  if (n === TUTORIAL_ROOM_ID || n === TUTORIAL_STAGING_ROOM_ID) return false;
  if (n === PIXEL_ROOM_ID || n === CANVAS_ROOM_ID) return false;
  return true;
}
