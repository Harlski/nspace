/**
 * Signboard management — admin-placed signs with messages that appear on hover/click
 * Data persists to disk as JSON
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const SIGNBOARDS_FILE = path.join(DATA_DIR, "signboards.json");

export type Signboard = {
  id: string; // unique ID (UUID or timestamp-based)
  roomId: string;
  x: number;
  z: number;
  message: string;
  createdBy: string; // wallet address
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
};

type SignboardsData = {
  signboards: Signboard[];
};

let signboards: Signboard[] = [];
let dirty = false;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadSignboards(): void {
  ensureDataDir();
  if (!fs.existsSync(SIGNBOARDS_FILE)) {
    console.log("[signboards] No existing data file, starting fresh");
    return;
  }
  try {
    const raw = fs.readFileSync(SIGNBOARDS_FILE, "utf-8");
    const data: SignboardsData = JSON.parse(raw);
    signboards = data.signboards || [];
    console.log(`[signboards] Loaded ${signboards.length} signboards`);
  } catch (err) {
    console.error("[signboards] Failed to load:", err);
  }
}

function saveSignboards(): void {
  ensureDataDir();
  try {
    const data: SignboardsData = { signboards };
    fs.writeFileSync(SIGNBOARDS_FILE, JSON.stringify(data, null, 2), "utf-8");
    dirty = false;
    console.log(`[signboards] Saved ${signboards.length} signboards`);
  } catch (err) {
    console.error("[signboards] Failed to save:", err);
  }
}

export function flushSignboardsSync(): void {
  if (dirty) saveSignboards();
}

/** Create a new signboard */
export function createSignboard(
  roomId: string,
  x: number,
  z: number,
  message: string,
  createdBy: string
): Signboard {
  const now = Date.now();
  const signboard: Signboard = {
    id: `${roomId}_${x}_${z}_${now}`,
    roomId,
    x,
    z,
    message,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
  signboards.push(signboard);
  dirty = true;
  return signboard;
}

/** Update a signboard's message */
export function updateSignboard(id: string, message: string): boolean {
  const signboard = signboards.find((s) => s.id === id);
  if (!signboard) return false;
  signboard.message = message;
  signboard.updatedAt = Date.now();
  dirty = true;
  return true;
}

/** Update a signboard's position */
export function updateSignboardPosition(id: string, x: number, z: number): boolean {
  const signboard = signboards.find((s) => s.id === id);
  if (!signboard) return false;
  signboard.x = x;
  signboard.z = z;
  signboard.updatedAt = Date.now();
  dirty = true;
  return true;
}

/** Delete a signboard */
export function deleteSignboard(id: string): boolean {
  const idx = signboards.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  signboards.splice(idx, 1);
  dirty = true;
  return true;
}

/** Get all signboards for a room */
export function getSignboardsForRoom(roomId: string): Signboard[] {
  return signboards.filter((s) => s.roomId === roomId);
}

/** Get signboard at specific position */
export function getSignboardAt(
  roomId: string,
  x: number,
  z: number
): Signboard | null {
  return (
    signboards.find((s) => s.roomId === roomId && s.x === x && s.z === z) ||
    null
  );
}

/** Get all signboards */
export function getAllSignboards(): Signboard[] {
  return [...signboards];
}

// Auto-save every 10 seconds if dirty
setInterval(() => {
  if (dirty) saveSignboards();
}, 10_000);
