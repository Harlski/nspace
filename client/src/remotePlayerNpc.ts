/**
 * Detects server-spawned fake players (see `rooms.ts`: `fakePlayerAddress`, `formatNpcDisplayName`).
 * Real humans must not match these heuristics.
 */
export function remotePlayerIsNpc(address: string, displayName: string): boolean {
  const compact = address.replace(/\s+/g, "").toUpperCase();
  if (compact.includes("FAKENPC")) return true;
  if (displayName.trimStart().startsWith("[NPC]")) return true;
  return false;
}
