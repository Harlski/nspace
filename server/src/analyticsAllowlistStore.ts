import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

function allowlistFilePath(): string {
  const raw = process.env.ANALYTICS_ALLOWLIST_PATH?.trim();
  if (raw) return path.resolve(raw);
  return path.join(DATA_DIR, "analytics-allowlist.json");
}

function normalizeWalletId(v: string): string {
  return String(v || "").replace(/\s+/g, "").toUpperCase();
}

type PersistedV1 = {
  version: 1;
  wallets: string[];
  managerWallets?: string[];
};

function parseWalletArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    const n = normalizeWalletId(String(x ?? ""));
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/**
 * When present, overrides env-based `ANALYTICS_*_WALLETS` for this process.
 * Written whenever an admin mutates the allowlist via API.
 */
export function loadAnalyticsAllowlistFromDisk(): {
  wallets: Set<string>;
  managerWallets: Set<string>;
} | null {
  const fp = allowlistFilePath();
  if (!fs.existsSync(fp)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(fp, "utf8")) as unknown;
    if (!raw || typeof raw !== "object") return null;
    const v = (raw as PersistedV1).version;
    if (v !== 1) return null;
    const wallets = parseWalletArray((raw as PersistedV1).wallets);
    if (wallets.length === 0) return null;
    const mgrRaw = parseWalletArray((raw as PersistedV1).managerWallets ?? []);
    const managerWallets = mgrRaw.length > 0 ? mgrRaw : wallets;
    return {
      wallets: new Set(wallets),
      managerWallets: new Set(managerWallets),
    };
  } catch {
    return null;
  }
}

export function saveAnalyticsAllowlistToDisk(
  wallets: ReadonlySet<string>,
  managerWallets: ReadonlySet<string>
): void {
  const fp = allowlistFilePath();
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  const payload: PersistedV1 = {
    version: 1,
    wallets: [...wallets].sort(),
    managerWallets: [...managerWallets].sort(),
  };
  const tmp = `${fp}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload), "utf8");
  fs.renameSync(tmp, fp);
}
