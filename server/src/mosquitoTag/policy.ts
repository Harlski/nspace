import {
  CANVAS_ROOM_ID,
  PIXEL_ROOM_ID,
  normalizeRoomId,
} from "../roomLayouts.js";
import { isTutorialRuntimeRoomId, isTutorialStagingRoomId } from "../tutorial/config.js";
import {
  FIELD_ROOM_ID,
  isMatchPitchRoomId,
} from "../worldcup/config.js";

/**
 * Occupied (x,z) tile keys from a placed-obstacle map (`tileKey` or `blockKey`).
 * Boost Pads spawn only on walkable tiles that are not in this set.
 */
export function mosquitoTagOccupiedTileKeys(
  placedKeys: Iterable<string>
): Set<string> {
  const out = new Set<string>();
  for (const key of placedKeys) {
    const first = key.indexOf(",");
    if (first < 0) continue;
    const second = key.indexOf(",", first + 1);
    out.add(second < 0 ? key : key.slice(0, second));
  }
  return out;
}

/** Rooms where Mosquito Tag must not run (other sports / lessons / boards). */
export function mosquitoTagAllowedInRoom(roomId: string): boolean {
  const n = normalizeRoomId(roomId);
  if (isMatchPitchRoomId(n)) return false;
  if (n === FIELD_ROOM_ID) return false;
  if (isTutorialRuntimeRoomId(n) || isTutorialStagingRoomId(n)) return false;
  if (n === PIXEL_ROOM_ID || n === CANVAS_ROOM_ID) return false;
  return true;
}
