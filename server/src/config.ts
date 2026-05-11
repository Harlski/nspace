/**
 * Server configuration and admin accounts
 */

/** Wallet addresses with admin privileges */
export const ADMIN_ADDRESSES = new Set([
  "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y",
]);

const ADMIN_COMPACT_KEYS = new Set(
  [...ADMIN_ADDRESSES].map((a) => a.replace(/\s+/g, "").toUpperCase())
);

/** Check if a wallet address has admin privileges (JWT `sub` may be grouped or compact). */
export function isAdmin(address: string): boolean {
  const c = String(address || "").replace(/\s+/g, "").toUpperCase();
  return ADMIN_COMPACT_KEYS.has(c);
}

/**
 * When set (≥16 chars), `POST /api/hooks/pre-deploy-restart` accepts
 * `Authorization: Bearer <this value>` from the deploy host (e.g. GitHub Actions SSH script)
 * so CI can warn players before `docker compose stop` without a JWT.
 */
export function getDeployRestartHookSecret(): string | null {
  const s = String(process.env.DEPLOY_RESTART_HOOK_SECRET ?? "").trim();
  return s.length >= 16 ? s : null;
}
