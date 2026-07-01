/** Direct Invite configuration (env-driven). */
function envFlag(name: string, defaultOn: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw.trim() === "") return defaultOn;
  const v = raw.trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "off" || v === "no");
}

function envInt(name: string, dflt: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw.trim() === "") return dflt;
  const n = Math.floor(Number(raw.trim()));
  return Number.isFinite(n) && n >= 0 ? n : dflt;
}

import { JOIN_CODE_CHARS, JOIN_CODE_LENGTH, isJoinCode, isLegacyPlaySpaceSlug } from "../joinCode.js";
import { WORLDCUP_ENABLED } from "../worldcup/config.js";

/** Master switch - follows WORLDCUP_ENABLED unless overridden. */
export const DIRECT_INVITE_ENABLED = envFlag(
  "DIRECT_INVITE_ENABLED",
  WORLDCUP_ENABLED
);

/** Invite lifetime from creation (default 15 minutes). */
export const DIRECT_INVITE_TTL_MS = envInt("DIRECT_INVITE_TTL_MS", 900_000);

/** Max total occupants of one Play Space (creator + guests). */
export const MAX_PLAY_SPACE_OCCUPANTS = Math.max(
  2,
  envInt("DIRECT_INVITE_MAX_OCCUPANTS", 8)
);

/** Guest JWT lifetime in seconds (default 4 hours). */
export const GUEST_SESSION_TTL_SEC = envInt("GUEST_SESSION_TTL_SEC", 4 * 60 * 60);

/** Ephemeral lobby room-id prefix. */
export const INVITE_LOBBY_PREFIX = "invite-lobby-";

/** Alphanumeric charset for shareable Play Space slugs (uppercase A–Z / 0–9). */
export const PLAY_SPACE_SLUG_CHARS = JOIN_CODE_CHARS;

/** Length of newly minted Play Space slugs (same as wallet room join codes). */
export const PLAY_SPACE_SLUG_LENGTH = JOIN_CODE_LENGTH;

export const PLAY_SPACE_SLUG_PATTERN = /^[A-Za-z0-9]+$/;

export function isValidPlaySpaceSlug(slug: string): boolean {
  return isJoinCode(slug) || isLegacyPlaySpaceSlug(slug);
}

export function makeInviteLobbyRoomId(slug: string): string {
  return `${INVITE_LOBBY_PREFIX}${slug}`;
}

export function isInviteLobbyRoomId(roomId: string | null | undefined): boolean {
  return typeof roomId === "string" && roomId.startsWith(INVITE_LOBBY_PREFIX);
}

export const INVITE_CONFIG = {
  ttlMs: DIRECT_INVITE_TTL_MS,
} as const;
