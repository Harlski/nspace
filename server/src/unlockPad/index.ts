function normalizeWalletKey(addr: string): string {
  return String(addr ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

export type UnlockPadProofMode = "optimistic" | "payment_intent";

export type UnlockPadConfig = {
  amountLuna: string;
  recipient: string;
  buttonLabel: string;
  proofMode: UnlockPadProofMode;
  /** Stable id for this placed instance; new place → new id. */
  instanceId: string;
};

export type UnlockPadTerrain = {
  passable?: boolean;
  unlockPad?: UnlockPadConfig | null;
};

const BUTTON_LABEL_MAX = 48;

export function normalizeUnlockPadConfig(
  raw: unknown
): UnlockPadConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const amountLuna = String(o.amountLuna ?? "").trim();
  if (!/^\d+$/.test(amountLuna) || amountLuna === "0") return null;
  const recipient = normalizeWalletKey(String(o.recipient ?? ""));
  if (!recipient) return null;
  let buttonLabel = String(o.buttonLabel ?? "Unlock")
    .trim()
    .slice(0, BUTTON_LABEL_MAX);
  if (!buttonLabel) buttonLabel = "Unlock";
  const proofMode =
    o.proofMode === "optimistic" || o.proofMode === "payment_intent"
      ? o.proofMode
      : null;
  if (!proofMode) return null;
  const instanceId = String(o.instanceId ?? "").trim();
  if (!instanceId || instanceId.length > 80) return null;
  return {
    amountLuna,
    recipient,
    buttonLabel,
    proofMode,
    instanceId,
  };
}

export function isUnlockPadTerrain(
  p: UnlockPadTerrain | null | undefined
): p is UnlockPadTerrain & { unlockPad: UnlockPadConfig } {
  return Boolean(p?.unlockPad && normalizeUnlockPadConfig(p.unlockPad));
}

export {
  clearUnlockPadGrantsForInstance,
  clearUnlockPadGrantsForWalletInRoom,
  hasUnlockPadGrant,
  listUnlockPadInstanceIdsForWallet,
  recordUnlockPadGrant,
} from "./grantStore.js";

import {
  clearUnlockPadGrantsForInstance,
  hasUnlockPadGrant,
} from "./grantStore.js";
import { randomUUID } from "node:crypto";

/** True when this Unlock Pad is walkable for the mover (has a durable grant). */
export function isUnlockPadPassableForMover(
  p: UnlockPadTerrain | null | undefined,
  roomId: string,
  moverAddress: string | null
): boolean {
  if (!moverAddress) return false;
  const cfg = p?.unlockPad ? normalizeUnlockPadConfig(p.unlockPad) : null;
  if (!cfg) return false;
  return hasUnlockPadGrant(moverAddress, roomId, cfg.instanceId);
}

/** Drop all grants for a removed pad instance (call when the obstacle is deleted). */
export function forgetUnlockPadInstance(
  roomId: string,
  p: UnlockPadTerrain | null | undefined
): void {
  const cfg = p?.unlockPad ? normalizeUnlockPadConfig(p.unlockPad) : null;
  if (!cfg) return;
  clearUnlockPadGrantsForInstance(roomId, cfg.instanceId);
}

export function newUnlockPadInstanceId(): string {
  return randomUUID();
}

export function defaultUnlockPadConfig(opts?: {
  amountLuna?: string;
  recipient?: string;
  buttonLabel?: string;
  proofMode?: UnlockPadProofMode;
}): UnlockPadConfig {
  const amountLuna = String(opts?.amountLuna ?? "100000").trim();
  const recipient = normalizeWalletKey(
    opts?.recipient ??
      process.env.PAYMENT_INTENT_RECIPIENT_ADDRESS ??
      process.env.TUTORIAL_DOOR_RECIPIENT ??
      ""
  );
  return {
    amountLuna: /^\d+$/.test(amountLuna) && amountLuna !== "0" ? amountLuna : "100000",
    recipient: recipient || "SYSTEM",
    buttonLabel: String(opts?.buttonLabel ?? "Unlock").trim().slice(0, BUTTON_LABEL_MAX) || "Unlock",
    proofMode: opts?.proofMode === "optimistic" ? "optimistic" : "payment_intent",
    instanceId: newUnlockPadInstanceId(),
  };
}
