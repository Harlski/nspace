import { Filter } from "bad-words";

export const USERNAME_MIN_LEN = 1;
export const USERNAME_MAX_LEN = 12;

/** Exact-match reserved names (lowercase). Impersonation / staff labels. */
const RESTRICTED_USERNAMES = new Set([
  "admin",
  "administrator",
  "dev",
  "developer",
  "helpdesk",
  "mod",
  "moderator",
  "nimiq",
  "nimiqspace",
  "nspace",
  "npc",
  "official",
  "owner",
  "staff",
  "support",
  "system",
]);

const profanityFilter = new Filter();

export type UsernamePolicyError =
  | "invalid_username"
  | "username_profanity"
  | "username_restricted";

function isValidUsernameFormat(s: string): boolean {
  if (s.length < USERNAME_MIN_LEN || s.length > USERNAME_MAX_LEN) return false;
  if (/^\[NPC\]/i.test(s)) return false;
  return /^[a-zA-Z0-9]+$/.test(s);
}

/** Returns a policy error code, or null when the candidate is allowed. */
export function usernameAssignmentError(raw: string): UsernamePolicyError | null {
  const next = String(raw ?? "").trim();
  if (!isValidUsernameFormat(next)) return "invalid_username";
  const lower = next.toLowerCase();
  if (RESTRICTED_USERNAMES.has(lower)) return "username_restricted";
  if (profanityFilter.isProfane(next)) return "username_profanity";
  return null;
}
