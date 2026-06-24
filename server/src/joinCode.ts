/** Shared 6-character join code for wallet rooms and Play Spaces (shown uppercase). */
export const JOIN_CODE_LENGTH = 6;

export const JOIN_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Play Space slugs minted before unification (mixed case, 8 chars). */
export const LEGACY_PLAY_SPACE_SLUG_LENGTH = 8;

const CODE_RE = /^[A-Za-z0-9]+$/;

export function isJoinCode(raw: string): boolean {
  const t = String(raw).trim().replace(/\s+/g, "");
  return t.length === JOIN_CODE_LENGTH && CODE_RE.test(t);
}

export function isLegacyPlaySpaceSlug(raw: string): boolean {
  const t = String(raw).trim().replace(/\s+/g, "");
  return t.length === LEGACY_PLAY_SPACE_SLUG_LENGTH && CODE_RE.test(t);
}

/** User-entered join code → uppercase (display + Play Space slug lookup). */
export function normalizeJoinCode(raw: string): string {
  return String(raw).trim().replace(/\s+/g, "").toUpperCase();
}

/** Wallet dynamic room id from a join code (lowercase registry key). */
export function walletRoomIdFromJoinCode(raw: string): string {
  return normalizeJoinCode(raw).toLowerCase();
}
