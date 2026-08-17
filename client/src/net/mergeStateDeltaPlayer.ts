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
    x?: number;
    y?: number;
    z?: number;
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
>(prev: T | undefined, delta: Partial<T> & { address: string; displayName: string }): T {
  const poseOmitted =
    !Number.isFinite(delta.x) || !Number.isFinite(delta.z);
  const x = poseOmitted ? (prev?.x ?? 0) : (delta.x as number);
  const z = poseOmitted ? (prev?.z ?? 0) : (delta.z as number);
  const y = Number.isFinite(delta.y)
    ? (delta.y as number)
    : poseOmitted
      ? (prev?.y ?? 0)
      : 0;
  const vx = poseOmitted
    ? (prev?.vx ?? 0)
    : Number.isFinite(delta.vx)
      ? (delta.vx as number)
      : 0;
  const vz = poseOmitted
    ? (prev?.vz ?? 0)
    : Number.isFinite(delta.vz)
      ? (delta.vz as number)
      : 0;
  return {
    ...(prev ??
      ({
        address: delta.address,
        displayName: delta.displayName,
        x,
        y,
        z,
        vx: 0,
        vz: 0,
      } as T)),
    ...delta,
    x,
    y,
    z,
    vx,
    vz,
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
