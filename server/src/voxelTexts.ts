import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const VOXEL_TEXT_FILE = path.join(DATA_DIR, "voxel-texts.json");

export type VoxelTextSpec = {
  id: string;
  text: string;
  roomId: string;
  x: number;
  y: number;
  z: number;
  yawDeg: number;
  unit: number;
  letterSpacing: number;
  color: number;
  emissive: number;
  emissiveIntensity: number;
  zTween: boolean;
  zTweenAmp: number;
  zTweenSpeed: number;
};

type PersistedVoxelTexts = {
  voxelTexts: VoxelTextSpec[];
};

let voxelTexts: VoxelTextSpec[] = [];
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 300;

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalizeSpec(spec: VoxelTextSpec): VoxelTextSpec {
  const id = String(spec.id ?? "").trim();
  const text = String(spec.text ?? "").trim().toUpperCase();
  return {
    id,
    text,
    roomId: String(spec.roomId ?? "").trim().toLowerCase(),
    x: Number(spec.x),
    y: Number(spec.y),
    z: Number(spec.z),
    yawDeg: Number(spec.yawDeg),
    unit: Math.max(0.05, Number(spec.unit)),
    letterSpacing: Math.max(0, Number(spec.letterSpacing)),
    color: Math.max(0, Math.min(0xffffff, Math.floor(Number(spec.color)))),
    emissive: Math.max(0, Math.min(0xffffff, Math.floor(Number(spec.emissive)))),
    emissiveIntensity: Math.max(0, Number(spec.emissiveIntensity)),
    zTween: Boolean(spec.zTween),
    zTweenAmp: Math.max(0, Number(spec.zTweenAmp ?? 0.18)),
    zTweenSpeed: Math.max(0, Number(spec.zTweenSpeed ?? 1.4)),
  };
}

function persistNow(): void {
  ensureDataDir();
  const payload: PersistedVoxelTexts = { voxelTexts };
  const tmp = `${VOXEL_TEXT_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload), "utf8");
  fs.renameSync(tmp, VOXEL_TEXT_FILE);
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      persistNow();
    } catch (err) {
      console.error("[voxelTexts] Failed to save:", err);
    }
  }, SAVE_DEBOUNCE_MS);
}

export function loadVoxelTexts(): void {
  if (!fs.existsSync(VOXEL_TEXT_FILE)) {
    voxelTexts = [
      {
        id: "space-sign",
        text: "SPACE",
        roomId: "hub",
        x: 0,
        y: 0.55,
        z: -10.5,
        yawDeg: 0,
        unit: 0.1875,
        letterSpacing: 1,
        color: 0xe2f3ff,
        emissive: 0x3b82f6,
        emissiveIntensity: 0.08,
        zTween: false,
        zTweenAmp: 0.18,
        zTweenSpeed: 1.4,
      },
    ];
    scheduleSave();
    console.log("[voxelTexts] No existing data file, seeded defaults");
    return;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(VOXEL_TEXT_FILE, "utf8")) as PersistedVoxelTexts;
    const next: VoxelTextSpec[] = [];
    for (const item of raw.voxelTexts ?? []) {
      const s = normalizeSpec(item);
      if (!s.id || !s.text || !s.roomId) continue;
      if (
        !Number.isFinite(s.x) ||
        !Number.isFinite(s.y) ||
        !Number.isFinite(s.z) ||
        !Number.isFinite(s.yawDeg) ||
        !Number.isFinite(s.unit) ||
        !Number.isFinite(s.letterSpacing) ||
        !Number.isFinite(s.emissiveIntensity) ||
        !Number.isFinite(s.zTweenAmp) ||
        !Number.isFinite(s.zTweenSpeed)
      ) {
        continue;
      }
      next.push(s);
    }
    voxelTexts = next;
    console.log(`[voxelTexts] Loaded ${voxelTexts.length} voxel text objects`);
  } catch (err) {
    console.error("[voxelTexts] Failed to load:", err);
    voxelTexts = [];
  }
}

export function flushVoxelTextsSync(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    persistNow();
  } catch (err) {
    console.error("[voxelTexts] Failed to flush:", err);
  }
}

export function getVoxelTextsForRoom(roomId: string): VoxelTextSpec[] {
  const rid = String(roomId).trim().toLowerCase();
  return voxelTexts.filter((v) => v.roomId === rid).map((v) => ({ ...v }));
}

export function upsertVoxelText(spec: VoxelTextSpec): VoxelTextSpec | null {
  const s = normalizeSpec(spec);
  if (!s.id || !s.text || !s.roomId) return null;
  if (
    !Number.isFinite(s.x) ||
    !Number.isFinite(s.y) ||
    !Number.isFinite(s.z) ||
    !Number.isFinite(s.yawDeg) ||
    !Number.isFinite(s.unit) ||
    !Number.isFinite(s.letterSpacing) ||
    !Number.isFinite(s.emissiveIntensity) ||
    !Number.isFinite(s.zTweenAmp) ||
    !Number.isFinite(s.zTweenSpeed)
  ) {
    return null;
  }
  const idx = voxelTexts.findIndex((v) => v.id === s.id && v.roomId === s.roomId);
  if (idx >= 0) voxelTexts[idx] = s;
  else voxelTexts.push(s);
  scheduleSave();
  return { ...s };
}

export function removeVoxelText(roomId: string, id: string): boolean {
  const rid = String(roomId).trim().toLowerCase();
  const key = String(id).trim();
  const before = voxelTexts.length;
  voxelTexts = voxelTexts.filter((v) => !(v.roomId === rid && v.id === key));
  if (voxelTexts.length !== before) {
    scheduleSave();
    return true;
  }
  return false;
}
