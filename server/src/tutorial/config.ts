import { isAdmin } from "../config.js";
import { TUTORIAL_ROOM_ID, TUTORIAL_STAGING_ROOM_ID } from "./roomIds.js";

export { TUTORIAL_ROOM_ID, TUTORIAL_STAGING_ROOM_ID };

const DEFAULT_FAUCET_LUNA = 1_000n;
const DEFAULT_DOOR_LUNA = 1_000n;

function parseBoolEnv(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined || raw.trim() === "") return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return defaultValue;
}

function parseBigIntEnv(raw: string | undefined, fallback: bigint): bigint {
  if (raw === undefined || raw.trim() === "") return fallback;
  try {
    const v = BigInt(raw.trim());
    return v > 0n ? v : fallback;
  } catch {
    return fallback;
  }
}

function parseWalletAllowlist(raw: string | undefined): Set<string> {
  const out = new Set<string>();
  if (!raw?.trim()) return out;
  for (const part of raw.split(",")) {
    const c = part.replace(/\s+/g, "").trim().toUpperCase();
    if (c) out.add(c);
  }
  return out;
}

export function isTutorialFeatureEnabled(): boolean {
  return parseBoolEnv(process.env.TUTORIAL_ENABLED, true);
}

export function getTutorialBuilderAllowlist(): Set<string> {
  return parseWalletAllowlist(process.env.TUTORIAL_BUILDER_ALLOWLIST);
}

export function isTutorialBuilderWallet(address: string): boolean {
  const c = String(address ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
  if (!c) return false;
  if (isAdmin(address)) return true;
  return getTutorialBuilderAllowlist().has(c);
}

export function getTutorialFaucetAmountLuna(): bigint {
  return parseBigIntEnv(process.env.TUTORIAL_FAUCET_AMOUNT_LUNA, DEFAULT_FAUCET_LUNA);
}

export function getTutorialDoorAmountLuna(): bigint {
  return parseBigIntEnv(process.env.TUTORIAL_DOOR_AMOUNT_LUNA, DEFAULT_DOOR_LUNA);
}

export function getTutorialDoorRecipientAddress(): string {
  const fromEnv = process.env.TUTORIAL_DOOR_RECIPIENT?.trim();
  if (fromEnv) return fromEnv;
  const adv = process.env.ADVERTISE_FUND_RECIPIENT_ADDRESS?.trim();
  if (adv) return adv;
  return "";
}

export function isTutorialRoomId(roomId: string): boolean {
  const id = roomId.trim().toLowerCase();
  return id === TUTORIAL_ROOM_ID || id === TUTORIAL_STAGING_ROOM_ID;
}

export function isTutorialRuntimeRoomId(roomId: string): boolean {
  return roomId.trim().toLowerCase() === TUTORIAL_ROOM_ID;
}

export function isTutorialStagingRoomId(roomId: string): boolean {
  return roomId.trim().toLowerCase() === TUTORIAL_STAGING_ROOM_ID;
}

/** Hidden from Rooms browser and Home Wheel My Rooms. */
export function isTutorialRoomHiddenFromCatalog(roomId: string): boolean {
  return isTutorialRoomId(roomId);
}
