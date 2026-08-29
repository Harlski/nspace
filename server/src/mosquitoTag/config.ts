function envFlag(name: string, defaultOn: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw.trim() === "") return defaultOn;
  const v = raw.trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "off" || v === "no");
}

/** Master switch. On by default; set MOSQUITO_TAG_ENABLED=0 to disable. */
export const MOSQUITO_TAG_ENABLED = envFlag("MOSQUITO_TAG_ENABLED", true);
