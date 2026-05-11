import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TERMS_PRIVACY_DOCS_VERSION } from "./termsPrivacyVersion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = path.join(__dirname, "..", "data");
const DEFAULT_STORE_PATH = path.join(DATA_DIR, "terms-privacy-acceptance.json");
/** Legacy filename on existing deployments — merged read until operators migrate solely to the primary file. */
const LEGACY_STORE_PATH = path.join(DATA_DIR, "legal-consent.json");

function resolveStorePath(): string {
  const fromEnv =
    process.env.TERMS_PRIVACY_ACCEPTANCE_STORE_FILE ?? process.env.LEGAL_CONSENT_STORE_FILE;
  return fromEnv ? path.resolve(fromEnv) : DEFAULT_STORE_PATH;
}

const STORE_FILE = resolveStorePath();

type AcceptanceRow = {
  acceptedVersion: string;
  acceptedAtMs: number;
};

type StoreFile = { consents: Record<string, AcceptanceRow> };

function normalizeWalletKey(v: string): string {
  return String(v || "").replace(/\s+/g, "").toUpperCase();
}

/** When using the default new path only, merge in rows from legacy `legal-consent.json`. */
function legacyCompanionPath(): string | null {
  if (STORE_FILE !== DEFAULT_STORE_PATH) return null;
  return LEGACY_STORE_PATH;
}

function ensureDir(): void {
  const dir = path.dirname(STORE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readPath(storePath: string): StoreFile | null {
  if (!fs.existsSync(storePath)) return null;
  try {
    const raw = fs.readFileSync(storePath, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (j && typeof j === "object" && "consents" in (j as StoreFile)) {
      const consents = (j as StoreFile).consents;
      if (consents && typeof consents === "object") return { consents };
    }
  } catch {
    /* fall through */
  }
  return null;
}

function mergeConsents(primary: StoreFile | null, secondary: StoreFile | null): Record<string, AcceptanceRow> {
  const out: Record<string, AcceptanceRow> = {};
  const take = (s: StoreFile | null): void => {
    if (!s?.consents) return;
    for (const [k, row] of Object.entries(s.consents)) {
      if (!row || typeof row !== "object") continue;
      const ver = String((row as AcceptanceRow).acceptedVersion ?? "").trim();
      const at = Number((row as AcceptanceRow).acceptedAtMs);
      if (!ver || !Number.isFinite(at)) continue;
      const cur = out[k];
      if (!cur || at >= cur.acceptedAtMs) out[k] = { acceptedVersion: ver, acceptedAtMs: at };
    }
  };
  take(primary);
  take(secondary);
  return out;
}

function readStoreMerged(): StoreFile {
  const primary = readPath(STORE_FILE);
  const legPath = legacyCompanionPath();
  const legacy = legPath ? readPath(legPath) : null;
  return { consents: mergeConsents(primary, legacy) };
}

function writeStore(data: StoreFile): void {
  ensureDir();
  const tmp = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 0), "utf8");
  fs.renameSync(tmp, STORE_FILE);
}

/** True when this wallet already acknowledged the active `TERMS_PRIVACY_DOCS_VERSION`. */
export function hasAcceptedCurrentTermsPrivacyDocs(normalizedWallet: string): boolean {
  const key = normalizeWalletKey(normalizedWallet);
  if (!key) return false;
  const row = readStoreMerged().consents[key];
  return row?.acceptedVersion === TERMS_PRIVACY_DOCS_VERSION;
}

export function recordTermsPrivacyAcceptance(normalizedWallet: string, version: string): void {
  const key = normalizeWalletKey(normalizedWallet);
  if (!key) return;
  const data = readStoreMerged();
  data.consents[key] = {
    acceptedVersion: String(version || "").trim(),
    acceptedAtMs: Date.now(),
  };
  writeStore(data);
}
