/** Matches server `playerProfileStore` username rules. */
export const USERNAME_MIN_LEN = 1;
export const USERNAME_MAX_LEN = 12;
export const USERNAME_PROMPT_MAX_DEFERRALS = 5;

export function isValidUsernameCandidate(s: string): boolean {
  const t = s.trim();
  if (t.length < USERNAME_MIN_LEN || t.length > USERNAME_MAX_LEN) return false;
  if (/^\[NPC\]/i.test(t)) return false;
  return /^[a-zA-Z0-9]+$/.test(t);
}
