import { sameTagAddress } from "./ids.js";

/** True while this address still has Stung slow remaining on a Tag snapshot. */
export function stungPulseActive(
  snap: {
    stungPlayerId?: string | null;
    stungRemainingMs?: number;
  } | null,
  address: string,
  elapsedSinceRecvMs: number
): boolean {
  if (!snap?.stungPlayerId) return false;
  const remain = Math.max(0, (snap.stungRemainingMs ?? 0) - elapsedSinceRecvMs);
  return remain > 0 && sameTagAddress(snap.stungPlayerId, address);
}
