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
};

export type BindSaleDisplayError =
  | "not_found"
  | "not_published"
  | "achievement_only"
  | "unknown_sku";

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
  return {
    id,
    roomId,
    x,
    z,
    cosmeticSku,
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

export function saleDisplayToWire(
  display: SaleDisplay,
  viewer: { isAdmin: boolean }
): SaleDisplayWire | null {
  const base = {
    id: display.id,
    x: display.x,
    z: display.z,
    cosmeticSku: display.cosmeticSku,
  };

  if (!display.cosmeticSku) {
    if (!viewer.isAdmin) return null;
    return base;
  }

  const active = resolveActiveBind(display.cosmeticSku);
  if (active) {
    return {
      ...base,
      presetId: active.presetId,
      label: active.label,
      slot: active.slot,
      kind: active.kind,
    };
  }

  if (!viewer.isAdmin) return null;
  return {
    ...base,
    bindInactive: true,
  };
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
