/**
 * Mosquito Tag — client feature flag (not World Cup).
 * Set VITE_MOSQUITO_TAG_ENABLED=0 to hide Games Wheel Tag and ignore snapshots.
 */

function envFlag(raw: unknown, defaultOn: boolean): boolean {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "") return defaultOn;
  return !(s === "0" || s === "false" || s === "off" || s === "no");
}

export const MOSQUITO_TAG_ENABLED = envFlag(
  import.meta.env.VITE_MOSQUITO_TAG_ENABLED,
  true
);
