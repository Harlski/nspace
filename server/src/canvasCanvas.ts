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

/** Track claim order per player for FIFO removal */
type PlayerClaimHistory = Map<string, Array<{ x: number; z: number }>>;

const MAX_CLAIMS_PER_PLAYER = 10;

let claims: CanvasClaimsMap = {};
let playerClaimOrder: PlayerClaimHistory = new Map();
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
export function claimTile(x: number, z: number, address: string): { removedTile: { x: number; z: number } | null } {
  const key = `${x},${z}`;
  const previousOwner = claims[key];
  
  // If this tile was claimed by someone else, remove it from their history
  if (previousOwner && previousOwner !== address) {
    const prevHistory = playerClaimOrder.get(previousOwner);
    if (prevHistory) {
      const index = prevHistory.findIndex(t => t.x === x && t.z === z);
      if (index !== -1) {
        prevHistory.splice(index, 1);
      }
    }
  }
  
  // Get or create claim history for this player
  let history = playerClaimOrder.get(address);
  if (!history) {
    history = [];
    playerClaimOrder.set(address, history);
  }
  
  // Check if this tile is already in this player's history (reclaiming same tile)
  const existingIndex = history.findIndex(t => t.x === x && t.z === z);
  if (existingIndex !== -1) {
    // Already owned by this player, don't add again
    claims[key] = address;
    dirty = true;
    return { removedTile: null };
  }
  
  // Add new tile to history
  history.push({ x, z });
  claims[key] = address;
  
  let removedTile: { x: number; z: number } | null = null;
  
  // If player has more than MAX_CLAIMS_PER_PLAYER tiles, remove the oldest
  if (history.length > MAX_CLAIMS_PER_PLAYER) {
    const oldest = history.shift(); // Remove first (oldest) element
    if (oldest) {
      const oldKey = `${oldest.x},${oldest.z}`;
      delete claims[oldKey];
      removedTile = oldest;
      console.log(`[canvas] Player ${address.slice(0, 8)}... exceeded limit, removing oldest tile (${oldest.x}, ${oldest.z})`);
    }
  }
  
  dirty = true;
  return { removedTile };
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

/** Get all claims within room bounds */
export function getClaimsInBounds(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number
): Array<{ x: number; z: number; address: string }> {
  return Object.entries(claims)
    .filter(([key]) => {
      const [x, z] = key.split(",").map(Number);
      return x! >= minX && x! <= maxX && z! >= minZ && z! <= maxZ;
    })
    .map(([key, address]) => {
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

/** Clear all claims (reset the canvas) */
export function clearAllClaims(): void {
  claims = {};
  playerClaimOrder.clear();
  dirty = true;
  saveCanvasClaims();
  console.log("[canvas] All claims cleared");
}

// Auto-save every 10 seconds if dirty
setInterval(() => {
  if (dirty) saveCanvasClaims();
}, 10_000);
