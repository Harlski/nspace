import type { BlockStyleProps } from "./blockStyle.js";
import { normalizeWalletKey } from "./grid.js";
import { HUB_ROOM_ID, normalizeRoomId } from "./roomLayouts.js";

export const GATE_AUTH_MAX = 5;

export type GateAccessWire = NonNullable<BlockStyleProps["gate"]>;

/** Canonical gate ACL from server wire or legacy single-address tiles. */
export function normalizeClientGate(g: GateAccessWire): {
  adminAddress: string;
  authorizedAddresses: string[];
  exitX: number;
  exitZ: number;
} {
  const exitX = g.exitX;
  const exitZ = g.exitZ;
  const legacy = g.authorizedAddress
    ? normalizeWalletKey(String(g.authorizedAddress))
    : "";
  let auths: string[] = [];
  if (Array.isArray(g.authorizedAddresses)) {
    for (const a of g.authorizedAddresses) {
      const c = normalizeWalletKey(String(a));
      if (c) auths.push(c);
    }
  }
  if (legacy && !auths.includes(legacy)) auths.unshift(legacy);
  auths = [...new Set(auths)].filter(Boolean).slice(0, GATE_AUTH_MAX);
  let admin = g.adminAddress ? normalizeWalletKey(String(g.adminAddress)) : "";
  if (!admin) admin = legacy;
  if (!admin && auths.length > 0) admin = auths[0]!;
  if (!admin) admin = legacy || "";
  if (admin && !auths.includes(admin)) {
    auths = [admin, ...auths.filter((x) => x !== admin)].slice(0, GATE_AUTH_MAX);
  }
  if (auths.length === 0 && admin) auths = [admin];
  return {
    adminAddress: admin,
    authorizedAddresses: auths,
    exitX,
    exitZ,
  };
}

export function canOpenGateAs(
  selfAddress: string,
  gate: BlockStyleProps["gate"] | undefined,
  roomId?: string
): boolean {
  if (!gate) return false;
  if (roomId !== undefined && normalizeRoomId(roomId) === HUB_ROOM_ID) {
    return true;
  }
  const n = normalizeClientGate(gate);
  const c = normalizeWalletKey(selfAddress);
  return n.authorizedAddresses.some((a) => normalizeWalletKey(a) === c);
}

export function isGateAclAdmin(
  selfAddress: string,
  gate: BlockStyleProps["gate"] | undefined
): boolean {
  if (!gate) return false;
  const n = normalizeClientGate(gate);
  return normalizeWalletKey(selfAddress) === n.adminAddress;
}
