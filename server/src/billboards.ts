/**
 * Billboards — multi-tile floor markers + image plane metadata (JSON on disk).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BILLBOARD_LIVE_CHART_PLACEHOLDER_SLIDE,
  type BillboardLiveChart,
  normalizeLiveChartWire,
} from "./billboardLiveChart.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const BILLBOARDS_FILE = path.join(DATA_DIR, "billboards.json");

export type BillboardOrientation = "horizontal" | "vertical";

export type Billboard = {
  id: string;
  roomId: string;
  /** Min corner of floor footprint (tile X). */
  anchorX: number;
  /** Min corner of floor footprint (tile Z). */
  anchorZ: number;
  orientation: BillboardOrientation;
  /** 0–3 inclusive, quarter-turns around +Y. */
  yawSteps: number;
  /** Ordered image URLs (https or same-origin path); client cycles with intervalMs. */
  slides: string[];
  intervalMs: number;
  /** Catalog id when placed from admin advert list (optional for legacy data). */
  advertId?: string;
  /** Ordered catalog ids for rotation (one image per id); optional for legacy. */
  advertIds?: string[];
  /** Epoch (ms) so all clients agree on slideshow phase; defaults to `createdAt` on wire. */
  slideshowEpochMs?: number;
  /** Label for “Visit {name}” and UI. */
  visitName: string;
  /** External HTTPS URL opened after user confirmation. */
  visitUrl: string;
  /** Live NIM candlestick chart (client fetches OHLC from nim-chart-service). */
  liveChart?: BillboardLiveChart;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

type BillboardsData = {
  billboards: Billboard[];
};

let billboards: Billboard[] = [];
let dirty = false;

export const BILLBOARD_HORIZONTAL_WIDTH_TILES = 4;
export const BILLBOARD_VERTICAL_WIDTH_TILES = 2;
export const BILLBOARD_FACE_HEIGHT_TILES = 3;

const BILLBOARD_IMAGE_URL_MAX = 512;
export const BILLBOARD_MAX_SLIDES = 8;
const BILLBOARD_INTERVAL_MIN_MS = 1000;
const BILLBOARD_INTERVAL_MAX_MS = 300_000;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/** Same-origin path or http(s) URL for prototype images. */
export function isAllowedBillboardImageUrl(url: string): boolean {
  const u = String(url).trim();
  if (!u || u.length > BILLBOARD_IMAGE_URL_MAX) return false;
  if (u.startsWith("/") && !u.startsWith("//")) return true;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function billboardFootprintWidth(orientation: BillboardOrientation): number {
  return orientation === "horizontal"
    ? BILLBOARD_HORIZONTAL_WIDTH_TILES
    : BILLBOARD_VERTICAL_WIDTH_TILES;
}

/**
 * Unit step along footprint from anchor for each tile index, matching Three.js
 * `Ry(yaw * π/2) * (1,0,0)` (plane width axis after `rotation.y`).
 */
function billboardWidthStepXZ(yawSteps: number): { dx: number; dz: number } {
  const q = ((Math.floor(yawSteps) % 4) + 4) % 4;
  const cos = [1, 0, -1, 0][q]!;
  const sin = [0, 1, 0, -1][q]!;
  const vx = cos;
  const vz = -sin;
  if (Math.abs(vx) >= Math.abs(vz)) {
    return { dx: vx > 0 ? 1 : -1, dz: 0 };
  }
  return { dx: 0, dz: vz > 0 ? 1 : -1 };
}

/** Anchor tile is index 0; footprint extends by `widthSteps` along the width axis for this yaw. */
export function footprintTileCoords(b: Billboard): { x: number; z: number }[] {
  const w = billboardFootprintWidth(b.orientation);
  const { dx, dz } = billboardWidthStepXZ(b.yawSteps);
  const out: { x: number; z: number }[] = [];
  for (let i = 0; i < w; i++) {
    out.push({ x: b.anchorX + i * dx, z: b.anchorZ + i * dz });
  }
  return out;
}

function footprintTileKeySet(b: Billboard): Set<string> {
  return new Set(footprintTileCoords(b).map((t) => `${t.x},${t.z}`));
}

export function getBillboardAtTile(
  roomId: string,
  x: number,
  z: number,
  excludeId?: string
): Billboard | null {
  for (const b of billboards) {
    if (b.roomId !== roomId) continue;
    if (excludeId && b.id === excludeId) continue;
    for (const t of footprintTileCoords(b)) {
      if (t.x === x && t.z === z) return b;
    }
  }
  return null;
}

function billboardsOverlapFootprint(a: Billboard, b: Billboard): boolean {
  if (a.roomId !== b.roomId) return false;
  const sa = footprintTileKeySet(a);
  const sb = footprintTileKeySet(b);
  for (const k of sa) {
    if (sb.has(k)) return true;
  }
  return false;
}

export function loadBillboards(): void {
  ensureDataDir();
  if (!fs.existsSync(BILLBOARDS_FILE)) {
    console.log("[billboards] No existing data file, starting fresh");
    return;
  }
  try {
    const raw = fs.readFileSync(BILLBOARDS_FILE, "utf-8");
    const data = JSON.parse(raw) as BillboardsData;
    const next: Billboard[] = [];
    for (const item of data.billboards ?? []) {
      const b = normalizeLoaded(item);
      if (b) next.push(b);
    }
    billboards = next;
    console.log(`[billboards] Loaded ${billboards.length} billboards`);
  } catch (err) {
    console.error("[billboards] Failed to load:", err);
  }
}

function normalizeLoaded(raw: unknown): Billboard | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  const roomId = String(o.roomId ?? "").trim().toLowerCase();
  const anchorX = Math.floor(Number(o.anchorX));
  const anchorZ = Math.floor(Number(o.anchorZ));
  const orientation =
    o.orientation === "vertical" ? "vertical" : "horizontal";
  const yawSteps = Math.max(0, Math.min(3, Math.floor(Number(o.yawSteps ?? 0))));
  let slides: string[] = [];
  if (Array.isArray(o.slides)) {
    slides = o.slides
      .map((u) => String(u).trim())
      .filter((u) => isAllowedBillboardImageUrl(u))
      .slice(0, BILLBOARD_MAX_SLIDES);
  }
  if (slides.length === 0) {
    const imageUrl = String(o.imageUrl ?? "").trim();
    if (isAllowedBillboardImageUrl(imageUrl)) slides = [imageUrl];
  }
  let liveChart: BillboardLiveChart | undefined;
  const lcRaw = o.liveChart;
  if (lcRaw) {
    liveChart = normalizeLiveChartWire(lcRaw) ?? undefined;
  }
  if (liveChart) {
    slides = [BILLBOARD_LIVE_CHART_PLACEHOLDER_SLIDE];
  }
  if (!id || !roomId || !Number.isFinite(anchorX) || !Number.isFinite(anchorZ)) {
    return null;
  }
  if (slides.length === 0) return null;
  let intervalMs = Math.floor(Number(o.intervalMs ?? 8000));
  if (!Number.isFinite(intervalMs)) intervalMs = 8000;
  intervalMs = Math.max(
    BILLBOARD_INTERVAL_MIN_MS,
    Math.min(BILLBOARD_INTERVAL_MAX_MS, intervalMs)
  );
  const createdBy = String(o.createdBy ?? "").trim();
  const createdAt = Math.floor(Number(o.createdAt ?? Date.now()));
  const updatedAt = Math.floor(Number(o.updatedAt ?? createdAt));
  const advertId = String(o.advertId ?? "").trim() || undefined;
  let advertIds: string[] | undefined;
  if (Array.isArray(o.advertIds)) {
    advertIds = o.advertIds
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .slice(0, BILLBOARD_MAX_SLIDES);
    if (advertIds.length === 0) advertIds = undefined;
  }
  if (!advertIds?.length && advertId) {
    advertIds = [advertId];
  }
  let slideshowEpochMs = Math.floor(Number(o.slideshowEpochMs ?? NaN));
  if (!Number.isFinite(slideshowEpochMs)) {
    slideshowEpochMs = createdAt;
  }
  const visitName = String(o.visitName ?? "").trim();
  const visitUrl = String(o.visitUrl ?? "").trim();
  return {
    id,
    roomId,
    anchorX,
    anchorZ,
    orientation,
    yawSteps,
    slides,
    intervalMs,
    advertId,
    advertIds,
    slideshowEpochMs,
    visitName,
    visitUrl,
    liveChart,
    createdBy,
    createdAt,
    updatedAt,
  };
}

function saveBillboards(): void {
  ensureDataDir();
  try {
    const data: BillboardsData = { billboards };
    fs.writeFileSync(BILLBOARDS_FILE, JSON.stringify(data, null, 2), "utf-8");
    dirty = false;
    console.log(`[billboards] Saved ${billboards.length} billboards`);
  } catch (err) {
    console.error("[billboards] Failed to save:", err);
  }
}

export function flushBillboardsSync(): void {
  if (dirty) saveBillboards();
}

export function getBillboardsForRoom(roomId: string): Billboard[] {
  return billboards.filter((b) => b.roomId === roomId);
}

export function createBillboard(
  roomId: string,
  anchorX: number,
  anchorZ: number,
  orientation: BillboardOrientation,
  yawSteps: number,
  slides: string[],
  intervalMs: number,
  createdBy: string,
  visitMeta: {
    advertId?: string;
    advertIds?: string[];
    visitName: string;
    visitUrl: string;
    slideshowEpochMs: number;
    liveChart?: BillboardLiveChart;
  }
): Billboard {
  const now = Date.now();
  const id = `bb_${roomId}_${anchorX}_${anchorZ}_${now}`;
  const b: Billboard = {
    id,
    roomId,
    anchorX,
    anchorZ,
    orientation,
    yawSteps,
    slides,
    intervalMs,
    advertId: visitMeta.liveChart ? undefined : visitMeta.advertId,
    advertIds: visitMeta.liveChart
      ? undefined
      : visitMeta.advertIds?.length
        ? [...visitMeta.advertIds]
        : undefined,
    slideshowEpochMs: visitMeta.slideshowEpochMs,
    visitName: visitMeta.visitName,
    visitUrl: visitMeta.visitUrl,
    liveChart: visitMeta.liveChart,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
  billboards.push(b);
  dirty = true;
  return b;
}

export function billboardToWire(b: Billboard) {
  return {
    id: b.id,
    anchorX: b.anchorX,
    anchorZ: b.anchorZ,
    orientation: b.orientation,
    yawSteps: b.yawSteps,
    slides: b.slides,
    intervalMs: b.intervalMs,
    advertId: b.advertId ?? "",
    advertIds: b.liveChart
      ? []
      : b.advertIds?.length
        ? b.advertIds
        : b.advertId
          ? [b.advertId]
          : [],
    slideshowEpochMs: b.slideshowEpochMs ?? b.createdAt,
    visitName: b.visitName ?? "",
    visitUrl: b.visitUrl ?? "",
    liveChart: b.liveChart,
    createdBy: b.createdBy,
    createdAt: b.createdAt,
  };
}

export function deleteBillboard(id: string): boolean {
  const idx = billboards.findIndex((b) => b.id === id);
  if (idx === -1) return false;
  billboards.splice(idx, 1);
  dirty = true;
  return true;
}

export function getBillboardById(id: string): Billboard | undefined {
  return billboards.find((b) => b.id === id);
}

/** Update content and pose fields in place (caller handles floor markers when footprint changes). */
export function setBillboardContent(
  id: string,
  next: {
    orientation: BillboardOrientation;
    yawSteps: number;
    slides: string[];
    intervalMs: number;
    advertId?: string;
    advertIds?: string[];
    slideshowEpochMs?: number;
    visitName: string;
    visitUrl: string;
    liveChart?: BillboardLiveChart;
  }
): boolean {
  const b = billboards.find((x) => x.id === id);
  if (!b) return false;
  b.orientation = next.orientation;
  b.yawSteps = next.yawSteps;
  b.slides = next.slides;
  b.intervalMs = next.intervalMs;
  if (next.liveChart) {
    b.liveChart = { ...next.liveChart };
    b.advertId = undefined;
    b.advertIds = undefined;
  } else {
    b.liveChart = undefined;
    b.advertId = next.advertId;
    if (next.advertIds !== undefined) {
      b.advertIds = next.advertIds.length ? [...next.advertIds] : undefined;
    }
  }
  if (next.slideshowEpochMs !== undefined) {
    b.slideshowEpochMs = next.slideshowEpochMs;
  }
  b.visitName = next.visitName;
  b.visitUrl = next.visitUrl;
  b.updatedAt = Date.now();
  dirty = true;
  return true;
}

export function hasBillboardFootprintConflict(
  roomId: string,
  anchorX: number,
  anchorZ: number,
  orientation: BillboardOrientation,
  excludeBillboardId?: string,
  yawSteps = 0
): boolean {
  const ys = Math.max(0, Math.min(3, Math.floor(yawSteps)));
  const fake: Billboard = {
    id: "_",
    roomId,
    anchorX,
    anchorZ,
    orientation,
    yawSteps: ys,
    slides: ["/"],
    intervalMs: 8000,
    visitName: "",
    visitUrl: "",
    createdBy: "",
    createdAt: 0,
    updatedAt: 0,
  };
  for (const b of billboards) {
    if (b.roomId !== roomId) continue;
    if (excludeBillboardId && b.id === excludeBillboardId) continue;
    if (billboardsOverlapFootprint(fake, b)) return true;
  }
  return false;
}

export function patchBillboardRecord(
  id: string,
  patch: { anchorX?: number; anchorZ?: number; yawSteps?: number }
): boolean {
  const b = billboards.find((x) => x.id === id);
  if (!b) return false;
  if (patch.anchorX !== undefined) b.anchorX = Math.floor(patch.anchorX);
  if (patch.anchorZ !== undefined) b.anchorZ = Math.floor(patch.anchorZ);
  if (patch.yawSteps !== undefined) {
    b.yawSteps = Math.max(0, Math.min(3, Math.floor(patch.yawSteps)));
  }
  b.updatedAt = Date.now();
  dirty = true;
  return true;
}

setInterval(() => {
  if (dirty) saveBillboards();
}, 10_000);
