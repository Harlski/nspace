import { listHasTagAddress } from "./ids.js";
import type { MosquitoTagWire } from "../net/ws.js";

export type TagRoomLockSnap = Pick<MosquitoTagWire, "phase" | "participants">;

/** True while this player cannot Enter a Teleporter or change Room. */
export function participantRoomLocked(
  snap: TagRoomLockSnap | null | undefined,
  selfAddress: string
): boolean {
  if (!snap || !selfAddress) return false;
  if (snap.phase !== "countdown" && snap.phase !== "playing") return false;
  return listHasTagAddress(snap.participants, selfAddress);
}

/**
 * True when a Nimiq Pay Participant should be zoomed to Telescope range
 * for Tag Countdown and Tag Round (same window as Tag Room Lock).
 */
export function payTagTelescopeZoomActive(
  snap: TagRoomLockSnap | null | undefined,
  selfAddress: string,
  isNimiqPay: boolean
): boolean {
  return isNimiqPay === true && participantRoomLocked(snap, selfAddress);
}
