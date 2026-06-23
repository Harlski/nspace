import os from "node:os";

function isRfc1918OrLinkLocal(a: number, b: number): boolean {
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

/** First non-internal IPv4 on a typical LAN (for dev share links / QR codes). */
export function pickLanIPv4(): string | null {
  const candidates: string[] = [];
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const addr of nets ?? []) {
      if (addr.family !== "IPv4" || addr.internal) continue;
      const parts = addr.address.split(".").map(Number);
      if (parts.length !== 4 || parts.some((o) => o > 255)) continue;
      if (!isRfc1918OrLinkLocal(parts[0]!, parts[1]!)) continue;
      candidates.push(addr.address);
    }
  }
  // Prefer 192.168.* (common home Wi‑Fi) when multiple interfaces exist.
  candidates.sort((x, y) => {
    const xp = x.startsWith("192.168.") ? 0 : 1;
    const yp = y.startsWith("192.168.") ? 0 : 1;
    return xp - yp || x.localeCompare(y);
  });
  return candidates[0] ?? null;
}

/**
 * Origin embedded in Play Space share links (`/join/{slug}`).
 * Production defaults to nimiq.space. Dev defaults to LAN IP + Vite port so phone QR scans work.
 */
export function resolvePublicBaseUrl(nodeEnv: string): string {
  const explicit = process.env.PUBLIC_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (nodeEnv === "production") return "https://nimiq.space";

  const clientPort = Number(process.env.DEV_CLIENT_PORT ?? "5173") || 5173;
  const lan = pickLanIPv4();
  if (lan) return `http://${lan}:${clientPort}`;
  return `http://localhost:${clientPort}`;
}
