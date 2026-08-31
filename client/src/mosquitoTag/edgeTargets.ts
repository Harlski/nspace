import { listHasTagAddress, sameTagAddress } from "./ids.js";
import type { MosquitoTagWire } from "../net/ws.js";

export type ParticipantEdgeTarget = {
  address: string;
  isHolder: boolean;
};

/** Other Participants to point at. Empty unless the viewer is in countdown or playing. */
export function participantEdgeTargets(
  snap: Pick<
    MosquitoTagWire,
    "phase" | "participants" | "holder"
  > | null | undefined,
  selfAddress: string
): ParticipantEdgeTarget[] {
  if (!snap || !selfAddress) return [];
  if (snap.phase !== "countdown" && snap.phase !== "playing") return [];
  if (!listHasTagAddress(snap.participants, selfAddress)) return [];
  return snap.participants
    .filter((id) => !sameTagAddress(id, selfAddress))
    .map((address) => ({
      address,
      isHolder:
        snap.holder != null && sameTagAddress(address, snap.holder),
    }));
}
