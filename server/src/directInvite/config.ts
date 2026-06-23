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

import { WORLDCUP_ENABLED } from "../worldcup/config.js";

/** Master switch — follows WORLDCUP_ENABLED unless overridden. */
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

/** Alphanumeric charset for shareable Play Space slugs (mixed case, no `-` / `_`). */
export const PLAY_SPACE_SLUG_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Length of newly minted Play Space slugs. */
export const PLAY_SPACE_SLUG_LENGTH = 8;

export const PLAY_SPACE_SLUG_PATTERN = /^[A-Za-z0-9]+$/;

export function isValidPlaySpaceSlug(slug: string): boolean {
  return (
    slug.length === PLAY_SPACE_SLUG_LENGTH && PLAY_SPACE_SLUG_PATTERN.test(slug)
  );
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
