import type { DeployDefaults } from "./cosmeticPresets.js";
import {
  getCatalogEntry,
  getResolvedDeployRules,
  hasEntitlement,
  listOwnedDeployables,
} from "./cosmeticStore.js";

type ActiveDeployable = {
  cosmeticSku: string;
  presetId: string;
  x: number;
  z: number;
  by: string;
  expiresAtMs: number;
};

const cooldownUntil = new Map<string, number>();
const activeByRoom = new Map<string, ActiveDeployable[]>();

function cooldownKey(wallet: string, sku: string): string {
  return `${wallet}:${sku}`;
}

export function clearCosmeticDeployStateForTests(): void {
  cooldownUntil.clear();
  activeByRoom.clear();
}

export function pruneExpiredDeployables(roomId: string, now = Date.now()): void {
  const list = activeByRoom.get(roomId);
  if (!list?.length) return;
  const next = list.filter((d) => d.expiresAtMs > now);
  if (next.length) activeByRoom.set(roomId, next);
  else activeByRoom.delete(roomId);
}

export function getDeployCooldownRemainingMs(
  wallet: string,
  cosmeticSku: string,
  now = Date.now()
): number {
  const until = cooldownUntil.get(cooldownKey(wallet, cosmeticSku)) ?? 0;
  return Math.max(0, until - now);
}

export type DeployRejectReason =
  | "not_entitled"
  | "not_deployable"
  | "deployables_disabled"
  | "not_walkable"
  | "out_of_range"
  | "cooldown"
  | "room_cap"
  | "invalid_tile";

export function validateCosmeticDeploy(opts: {
  wallet: string;
  roomId: string;
  cosmeticSku: string;
  playerX: number;
  playerZ: number;
  tileX: number;
  tileZ: number;
  deployablesAllowed: boolean;
  isWalkable: (x: number, z: number) => boolean;
  now?: number;
}):
  | { ok: true; rules: DeployDefaults; presetId: string; expiresAtMs: number }
  | { ok: false; reason: DeployRejectReason } {
  const now = opts.now ?? Date.now();
  if (!opts.deployablesAllowed) {
    return { ok: false, reason: "deployables_disabled" };
  }
  if (!hasEntitlement(opts.wallet, opts.cosmeticSku)) {
    return { ok: false, reason: "not_entitled" };
  }
  const entry = getCatalogEntry(opts.cosmeticSku);
  if (!entry || entry.slot !== "deployable") {
    return { ok: false, reason: "not_deployable" };
  }
  const rules = getResolvedDeployRules(entry.cosmeticSku);
  if (!rules) return { ok: false, reason: "not_deployable" };

  if (!opts.isWalkable(opts.tileX, opts.tileZ)) {
    return { ok: false, reason: "not_walkable" };
  }
  const dx = opts.tileX - opts.playerX;
  const dz = opts.tileZ - opts.playerZ;
  const dist = Math.max(Math.abs(dx), Math.abs(dz));
  if (dist > rules.deployRange) {
    return { ok: false, reason: "out_of_range" };
  }
  if (getDeployCooldownRemainingMs(opts.wallet, entry.cosmeticSku, now) > 0) {
    return { ok: false, reason: "cooldown" };
  }

  pruneExpiredDeployables(opts.roomId, now);
  const active = activeByRoom.get(opts.roomId) ?? [];
  const sameSku = active.filter((d) => d.cosmeticSku === entry.cosmeticSku);
  if (sameSku.length >= rules.roomCap) {
    return { ok: false, reason: "room_cap" };
  }

  return {
    ok: true,
    rules,
    presetId: entry.presetId,
    expiresAtMs: now + rules.durationSec * 1000,
  };
}

export function recordCosmeticDeploy(opts: {
  roomId: string;
  wallet: string;
  cosmeticSku: string;
  presetId: string;
  x: number;
  z: number;
  expiresAtMs: number;
  now?: number;
}): ActiveDeployable {
  const now = opts.now ?? Date.now();
  const rules = getResolvedDeployRules(opts.cosmeticSku);
  if (rules) {
    cooldownUntil.set(
      cooldownKey(opts.wallet, opts.cosmeticSku),
      now + rules.cooldownSec * 1000
    );
  }
  const deploy: ActiveDeployable = {
    cosmeticSku: opts.cosmeticSku,
    presetId: opts.presetId,
    x: opts.x,
    z: opts.z,
    by: opts.wallet,
    expiresAtMs: opts.expiresAtMs,
  };
  const list = activeByRoom.get(opts.roomId) ?? [];
  list.push(deploy);
  activeByRoom.set(opts.roomId, list);
  return deploy;
}

export function listOwnedDeployableSkus(wallet: string): string[] {
  return listOwnedDeployables(wallet).map((d) => d.cosmeticSku);
}

export function deployRejectMessage(reason: DeployRejectReason): string {
  switch (reason) {
    case "not_entitled":
      return "You do not own that deployable.";
    case "not_deployable":
      return "That item is not a deployable.";
    case "deployables_disabled":
      return "Deployables are disabled in this room.";
    case "not_walkable":
      return "Pick a walkable floor tile.";
    case "out_of_range":
      return "That tile is out of range.";
    case "cooldown":
      return "That deployable is on cooldown.";
    case "room_cap":
      return "Too many of that effect are active in this room.";
    default:
      return "Could not deploy there.";
  }
}
