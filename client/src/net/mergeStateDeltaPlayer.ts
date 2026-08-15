/**
 * Merge one `stateDelta` player entry into the client's last-known snapshot.
 *
 * Server snapshots omit false/absent ephemeral flags. Spreading over `prev`
 * would leak those flags (e.g. Admin Invisibility cue stuck on after toggle off).
 */
export function mergeStateDeltaPlayer<
  T extends {
    address: string;
    displayName: string;
    x: number;
    y?: number;
    z: number;
    vx?: number;
    vz?: number;
    nimSendAway?: boolean;
    chatTyping?: boolean;
    challengeOpen?: boolean;
    worldcupCountry?: string | null;
    adminInvisible?: boolean;
    frozen?: boolean;
    playerLevel?: number;
  },
>(prev: T | undefined, delta: T): T {
  const py = Number.isFinite(delta.y) ? (delta.y as number) : 0;
  return {
    ...(prev ??
      ({
        address: delta.address,
        displayName: delta.displayName,
        x: delta.x,
        y: py,
        z: delta.z,
        vx: 0,
        vz: 0,
      } as T)),
    ...delta,
    y: py,
    // Derive presence/ephemeral flags from the delta only (not stale `prev`).
    nimSendAway: delta.nimSendAway,
    chatTyping: delta.chatTyping,
    challengeOpen: delta.challengeOpen,
    worldcupCountry: delta.worldcupCountry,
    adminInvisible: delta.adminInvisible,
    frozen: delta.frozen,
    playerLevel: delta.playerLevel,
  };
}
