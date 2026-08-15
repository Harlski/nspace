/**
 * Sale Displays — admin-placed fixtures that bind Published Catalog Entries.
 * See CONTEXT.md (Sale Display) and docs/adr/0015-sale-displays.md.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCatalogEntry } from "./cosmeticStore.js";
import {
  getCosmeticPreset,
  type CosmeticSlot,
} from "./cosmeticPresets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_PATH = path.join(__dirname, "..", "data", "sale-displays.json");

export type SaleDisplay = {
  id: string;
  roomId: string;
  x: number;
  z: number;
  /** Bound Catalog Entry SKU, or null when unbound. */
  cosmeticSku: string | null;
  /** When true and walkTiles length ≥ 2, mannequin paces the path. */
  walkEnabled: boolean;
  walkTiles: { x: number; z: number }[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

export type SaleDisplayWire = {
  id: string;
  x: number;
  z: number;
  cosmeticSku: string | null;
  presetId?: string;
  label?: string;
  slot?: CosmeticSlot;
  kind?: "mannequin" | "floor";
  /** Admin-only: sku set but not player-visible (non-Published / non-shop). */
  bindInactive?: boolean;
  walkEnabled?: boolean;
  walkTiles?: { x: number; z: number }[];
};

export type BindSaleDisplayError =
  | "not_found"
  | "not_published"
  | "achievement_only"
  | "unknown_sku";

export const SALE_DISPLAY_WALK_TILES_MAX = 16;

/** Floor ints, drop non-finite, dedupe consecutive duplicates, cap length. */
export function normalizeWalkTiles(raw: unknown): { x: number; z: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { x: number; z: number }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const x = Math.floor(Number(o.x));
    const z = Math.floor(Number(o.z));
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const prev = out[out.length - 1];
    if (prev && prev.x === x && prev.z === z) continue;
    out.push({ x, z });
    if (out.length >= SALE_DISPLAY_WALK_TILES_MAX) break;
  }
  return out;
}

type SaleDisplaysData = {
  saleDisplays: SaleDisplay[];
};

let saleDisplays: SaleDisplay[] = [];
let dirty = false;
/** Test-only override; production always uses DEFAULT_DATA_PATH. */
let dataPathOverride: string | null = null;

function resolveDataPath(): string {
  return dataPathOverride ?? DEFAULT_DATA_PATH;
}

function ensureParentDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function normalizeRoomId(roomId: string): string {
  return roomId.trim().toLowerCase();
}

function normalizeLoaded(raw: unknown): SaleDisplay | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  const roomId = normalizeRoomId(String(o.roomId ?? ""));
  const x = Math.floor(Number(o.x));
  const z = Math.floor(Number(o.z));
  const createdBy = String(o.createdBy ?? "").trim();
  const createdAt = Math.floor(Number(o.createdAt ?? 0));
  const updatedAt = Math.floor(Number(o.updatedAt ?? createdAt));
  if (!id || !roomId || !Number.isFinite(x) || !Number.isFinite(z)) return null;
  const skuRaw = o.cosmeticSku;
  const cosmeticSku =
    skuRaw === null || skuRaw === undefined || skuRaw === ""
      ? null
      : String(skuRaw).trim() || null;
  const walkEnabled = o.walkEnabled === true;
  const walkTiles = normalizeWalkTiles(o.walkTiles);
  return {
    id,
    roomId,
    x,
    z,
    cosmeticSku,
    walkEnabled,
    walkTiles,
    createdBy,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
  };
}

export function loadSaleDisplays(): void {
  const filePath = resolveDataPath();
  ensureParentDir(filePath);
  if (!fs.existsSync(filePath)) {
    saleDisplays = [];
    dirty = false;
    return;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as SaleDisplaysData;
    const next: SaleDisplay[] = [];
    for (const item of data.saleDisplays ?? []) {
      const d = normalizeLoaded(item);
      if (d) next.push(d);
    }
    saleDisplays = next;
    dirty = false;
  } catch (err) {
    console.error("[saleDisplays] Failed to load:", err);
    saleDisplays = [];
    dirty = false;
  }
}

function saveSaleDisplays(): void {
  const filePath = resolveDataPath();
  ensureParentDir(filePath);
  const data: SaleDisplaysData = { saleDisplays };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  dirty = false;
}

export function flushSaleDisplaysSync(): void {
  if (!dirty) return;
  saveSaleDisplays();
}

export function _resetSaleDisplaysForTests(opts?: { dataPath?: string }): void {
  saleDisplays = [];
  dirty = false;
  dataPathOverride = opts?.dataPath?.trim() || null;
}

export function createSaleDisplay(input: {
  roomId: string;
  x: number;
  z: number;
  createdBy: string;
}): SaleDisplay {
  const now = Date.now();
  const roomId = normalizeRoomId(input.roomId);
  const x = Math.floor(input.x);
  const z = Math.floor(input.z);
  const display: SaleDisplay = {
    id: `sd_${roomId}_${x}_${z}_${now}`,
    roomId,
    x,
    z,
    cosmeticSku: null,
    walkEnabled: false,
    walkTiles: [],
    createdBy: String(input.createdBy ?? "").trim(),
    createdAt: now,
    updatedAt: now,
  };
  saleDisplays.push(display);
  dirty = true;
  return display;
}

export function getSaleDisplayById(id: string): SaleDisplay | undefined {
  const key = String(id ?? "").trim();
  return saleDisplays.find((d) => d.id === key);
}

export function getSaleDisplaysForRoom(roomId: string): SaleDisplay[] {
  const id = normalizeRoomId(roomId);
  return saleDisplays.filter((d) => d.roomId === id);
}

export function moveSaleDisplay(
  id: string,
  x: number,
  z: number
): SaleDisplay | null {
  const d = getSaleDisplayById(id);
  if (!d) return null;
  d.x = Math.floor(x);
  d.z = Math.floor(z);
  d.updatedAt = Date.now();
  dirty = true;
  return d;
}

export function deleteSaleDisplay(id: string): boolean {
  const idx = saleDisplays.findIndex((d) => d.id === String(id ?? "").trim());
  if (idx === -1) return false;
  saleDisplays.splice(idx, 1);
  dirty = true;
  return true;
}

/** True when a Catalog Entry may be newly bound to a Sale Display. */
export function isBindablePublishedShopSku(cosmeticSku: string): boolean {
  const entry = getCatalogEntry(cosmeticSku);
  if (!entry) return false;
  if (entry.status !== "published") return false;
  if (entry.collection.trim().toLowerCase() === "achievements") return false;
  return true;
}

export function bindSaleDisplay(
  id: string,
  cosmeticSku: string
): { ok: true; display: SaleDisplay } | { ok: false; error: BindSaleDisplayError } {
  const d = getSaleDisplayById(id);
  if (!d) return { ok: false, error: "not_found" };
  const sku = String(cosmeticSku ?? "").trim();
  const entry = getCatalogEntry(sku);
  if (!entry) return { ok: false, error: "unknown_sku" };
  if (entry.collection.trim().toLowerCase() === "achievements") {
    return { ok: false, error: "achievement_only" };
  }
  if (entry.status !== "published") {
    return { ok: false, error: "not_published" };
  }
  d.cosmeticSku = entry.cosmeticSku;
  d.updatedAt = Date.now();
  dirty = true;
  return { ok: true, display: d };
}

export function clearSaleDisplayBind(id: string): SaleDisplay | null {
  const d = getSaleDisplayById(id);
  if (!d) return null;
  d.cosmeticSku = null;
  d.updatedAt = Date.now();
  dirty = true;
  return d;
}

export function setSaleDisplayWalk(
  id: string,
  input: { enabled: boolean; tiles?: unknown }
): SaleDisplay | null {
  const d = getSaleDisplayById(id);
  if (!d) return null;
  d.walkEnabled = input.enabled === true;
  if (input.tiles !== undefined) {
    d.walkTiles = normalizeWalkTiles(input.tiles);
  }
  d.updatedAt = Date.now();
  dirty = true;
  return d;
}

function showcaseKindForSlot(slot: CosmeticSlot): "mannequin" | "floor" {
  return slot === "deployable" ? "floor" : "mannequin";
}

function resolveActiveBind(cosmeticSku: string): {
  presetId: string;
  label: string;
  slot: CosmeticSlot;
  kind: "mannequin" | "floor";
} | null {
  if (!isBindablePublishedShopSku(cosmeticSku)) return null;
  const entry = getCatalogEntry(cosmeticSku)!;
  const preset = getCosmeticPreset(entry.presetId);
  const slot = preset?.slot ?? entry.slot;
  return {
    presetId: entry.presetId,
    label: entry.displayName,
    slot,
    kind: showcaseKindForSlot(slot),
  };
}

function attachWalkWire(
  wire: SaleDisplayWire,
  display: SaleDisplay,
  viewer: { isAdmin: boolean },
  kind: "mannequin" | "floor" | undefined
): SaleDisplayWire {
  const canWalk =
    kind === "mannequin" &&
    display.walkEnabled &&
    display.walkTiles.length >= 2;
  if (viewer.isAdmin) {
    return {
      ...wire,
      walkEnabled: display.walkEnabled,
      walkTiles: display.walkTiles,
    };
  }
  if (!canWalk) return wire;
  return {
    ...wire,
    walkEnabled: true,
    walkTiles: display.walkTiles,
  };
}

export function saleDisplayToWire(
  display: SaleDisplay,
  viewer: { isAdmin: boolean }
): SaleDisplayWire | null {
  const base: SaleDisplayWire = {
    id: display.id,
    x: display.x,
    z: display.z,
    cosmeticSku: display.cosmeticSku,
  };

  if (!display.cosmeticSku) {
    if (!viewer.isAdmin) return null;
    return attachWalkWire(base, display, viewer, undefined);
  }

  const active = resolveActiveBind(display.cosmeticSku);
  if (active) {
    return attachWalkWire(
      {
        ...base,
        presetId: active.presetId,
        label: active.label,
        slot: active.slot,
        kind: active.kind,
      },
      display,
      viewer,
      active.kind
    );
  }

  if (!viewer.isAdmin) return null;
  return attachWalkWire(
    {
      ...base,
      bindInactive: true,
    },
    display,
    viewer,
    undefined
  );
}

export function listSaleDisplaysWire(
  roomId: string,
  viewer: { isAdmin: boolean }
): SaleDisplayWire[] {
  const out: SaleDisplayWire[] = [];
  for (const d of getSaleDisplaysForRoom(roomId)) {
    const wire = saleDisplayToWire(d, viewer);
    if (wire) out.push(wire);
  }
  return out;
}
