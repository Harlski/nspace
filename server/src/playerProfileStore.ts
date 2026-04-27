import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STORE_FILE = process.env.PLAYER_PROFILE_STORE_FILE
  ? path.resolve(process.env.PLAYER_PROFILE_STORE_FILE)
  : path.join(__dirname, "..", "data", "player-profiles.json");

type Row = { message: string; updatedAt: number };
type StoreFile = { profiles: Record<string, Row> };

function ensureDir(): void {
  const dir = path.dirname(STORE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readStore(): StoreFile {
  if (!fs.existsSync(STORE_FILE)) return { profiles: {} };
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (j && typeof j === "object" && "profiles" in (j as StoreFile)) {
      const profiles = (j as StoreFile).profiles;
      if (profiles && typeof profiles === "object") return { profiles };
    }
  } catch {
    /* fall through */
  }
  return { profiles: {} };
}

function writeStore(data: StoreFile): void {
  ensureDir();
  const tmp = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 0), "utf8");
  fs.renameSync(tmp, STORE_FILE);
}

export function getPlayerProfileMessage(normalizedAddress: string): string {
  const key = normalizedAddress.trim();
  if (!key) return "";
  const row = readStore().profiles[key];
  return row?.message ? String(row.message) : "";
}

export function setPlayerProfileMessage(
  normalizedAddress: string,
  message: string
): { message: string; updatedAt: number } {
  const key = normalizedAddress.trim();
  if (!key) throw new Error("missing_address");
  const data = readStore();
  const updatedAt = Date.now();
  data.profiles[key] = { message, updatedAt };
  writeStore(data);
  return { message, updatedAt };
}
