/** Copy for login-gated standalone pages when the session is missing or expired. */
export const SIGNED_IN_REQUIRED_MESSAGE =
  "You must be signed in to perform this action.";

export function isUnauthenticatedFailure(
  status: number,
  error?: string | null
): boolean {
  if (status === 401) return true;
  const code = String(error ?? "").trim();
  return code === "unauthorized" || code === "not_signed_in";
}
