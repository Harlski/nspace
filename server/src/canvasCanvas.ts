/**
 * Canvas room tile claims — track which player identicon owns each tile.
 * Data persists to disk as JSON.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const CANVAS_FILE = path.join(DATA_DIR, "canvas-claims.json");

/** Map of "x,z" => wallet address */
type CanvasClaimsMap = Record<string, string>;

let claims: CanvasClaimsMap = {};
let dirty = false;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/** Load claims from disk on startup */
export function loadCanvasClaims(): void {
  ensureDataDir();
  if (!fs.existsSync(CANVAS_FILE)) {
    claims = {};
    return;
  }
  try {
    const raw = fs.readFileSync(CANVAS_FILE, "utf8");
    claims = JSON.parse(raw);
  } catch (err) {
    console.error("[canvas] Failed to load claims:", err);
    claims = {};
  }
}

/** Save claims to disk (debounced via dirty flag) */
function saveCanvasClaims(): void {
  if (!dirty) return;
  ensureDataDir();
  try {
    fs.writeFileSync(CANVAS_FILE, JSON.stringify(claims, null, 2), "utf8");
    dirty = false;
  } catch (err) {
    console.error("[canvas] Failed to save claims:", err);
  }
}

/** Flush immediately (call on shutdown) */
export function flushCanvasClaimsSync(): void {
  saveCanvasClaims();
}

/** Claim a tile for a player (or overwrite if already claimed) */
export function claimTile(x: number, z: number, address: string): void {
  const key = `${x},${z}`;
  claims[key] = address;
  dirty = true;
}

/** Get the address that owns a tile, or null if unclaimed */
export function getTileOwner(x: number, z: number): string | null {
  const key = `${x},${z}`;
  return claims[key] ?? null;
}

/** Get all claims as { x, z, address }[] */
export function getAllClaims(): Array<{ x: number; z: number; address: string }> {
  return Object.entries(claims).map(([key, address]) => {
    const [x, z] = key.split(",").map(Number);
    return { x: x!, z: z!, address };
  });
}

/** Count tiles claimed per player, return top N sorted descending */
export function getTopPlayers(limit: number): Array<{ address: string; count: number }> {
  const counts = new Map<string, number>();
  for (const address of Object.values(claims)) {
    counts.set(address, (counts.get(address) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([address, count]) => ({ address, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// Auto-save every 10 seconds if dirty
setInterval(() => {
  if (dirty) saveCanvasClaims();
}, 10_000);
