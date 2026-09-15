/**
 * Return Gold / ordinary-solid helpers (pure).
 */

import type { GoldKind } from "./constants.js";

export type ClaimableProps = {
  passable?: boolean;
  ramp?: boolean;
  claimable?: boolean;
  kind?: string;
  returnGold?: boolean;
  teleporter?: unknown;
  gate?: unknown;
  unlockPad?: unknown;
  saleDisplayId?: string;
  signboardId?: string;
  active?: boolean;
  cooldownMs?: number;
  lastClaimedAt?: number;
};

export function isReturnGold(props: ClaimableProps | null | undefined): boolean {
  if (!props) return false;
  if (props.kind === "returnGold") return true;
  return props.returnGold === true;
}

export function isGoldBlock(props: ClaimableProps | null | undefined): boolean {
  if (!props?.claimable) return false;
  return !isReturnGold(props);
}

export function directoryGoldKind(props: ClaimableProps): GoldKind {
  return isReturnGold(props) ? "returnGold" : "goldBlock";
}

/** Ordinary solid at y === 0: eligible for an Upgrade. */
export function isOrdinarySolidEligibleForUpgrade(
  props: ClaimableProps | null | undefined
): boolean {
  if (!props) return false;
  if (props.passable) return false;
  if (props.ramp) return false;
  if (props.claimable) return false;
  if (isReturnGold(props)) return false;
  if (props.teleporter) return false;
  if (props.gate) return false;
  if (props.unlockPad) return false;
  if (props.saleDisplayId) return false;
  return true;
}

export const ORTHOGONAL_NEIGHBOR_DELTAS: ReadonlyArray<{ dx: number; dz: number }> =
  [
    { dx: 1, dz: 0 },
    { dx: -1, dz: 0 },
    { dx: 0, dz: 1 },
    { dx: 0, dz: -1 },
  ];

export function pickUpgradeTiles(
  eligible: ReadonlyArray<{ x: number; z: number }>,
  count: number,
  random: () => number
): Array<{ x: number; z: number }> {
  if (count <= 0 || eligible.length === 0) return [];
  const pool = eligible.slice();
  const out: Array<{ x: number; z: number }> = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    out.push(pool.splice(idx, 1)[0]!);
  }
  return out;
}

export function applyReturnGoldUpgrade(props: ClaimableProps): void {
  props.claimable = true;
  props.active = true;
  props.kind = "returnGold";
  props.returnGold = true;
  props.cooldownMs = 0;
}

export function revertReturnGoldToOrdinarySolid(props: ClaimableProps): void {
  props.claimable = false;
  props.returnGold = undefined;
  props.kind = undefined;
  props.active = undefined;
  props.cooldownMs = undefined;
  props.lastClaimedAt = undefined;
}
