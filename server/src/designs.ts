/**
 * Player-authored design catalog (object prefabs and room regions).
 * Persisted as JSON until consolidated into SQLite.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  captureDesignSnapshot,
  designCapsForKind,
  footprintFromBbox,
  validateBboxForKind,
  type DesignBbox,
  type DesignKind,
  type DesignSnapshotV1,
  type RoomBaseFloorColorMap,
  type RoomExtraFloorMap,
  type RoomPlacedMap,
} from "./designSnapshot.js";
import { normalizeWalletKey } from "./grid.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const DESIGNS_FILE = path.join(DATA_DIR, "designs.json");

export type DesignVisibility = "private" | "unlisted" | "public";

export type DesignRecord = {
  id: string;
  kind: DesignKind;
  creatorWallet: string;
  name: string;
  description: string;
  tags: string[];
  version: number;
  footprintW: number;
  footprintD: number;
  priceLuna: string;
  hubStampAllowed: boolean;
  visibility: DesignVisibility;
  contentHash: string;
  createdAt: number;
  updatedAt: number;
};

export type DesignSnapshotRecord = {
  designId: string;
  version: number;
  payload: DesignSnapshotV1;
  obstacleCount: number;
};

export type DesignEntitlement = {
  wallet: string;
  designId: string;
  versionMax: number;
  hubStampAllowed: boolean;
  purchasedAt: number;
  intentId?: string;
};

type DesignsData = {
  designs: DesignRecord[];
  snapshots: DesignSnapshotRecord[];
  entitlements: DesignEntitlement[];
};

let designs: DesignRecord[] = [];
let snapshots: DesignSnapshotRecord[] = [];
let entitlements: DesignEntitlement[] = [];
let dirty = false;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadDesigns(): void {
  ensureDataDir();
  if (!fs.existsSync(DESIGNS_FILE)) return;
  try {
    const raw = fs.readFileSync(DESIGNS_FILE, "utf-8");
    const data = JSON.parse(raw) as DesignsData;
    designs = data.designs ?? [];
    snapshots = data.snapshots ?? [];
    entitlements = data.entitlements ?? [];
    console.log(`[designs] Loaded ${designs.length} designs`);
  } catch (err) {
    console.error("[designs] Failed to load:", err);
  }
}

function saveDesigns(): void {
  ensureDataDir();
  const data: DesignsData = { designs, snapshots, entitlements };
  fs.writeFileSync(DESIGNS_FILE, JSON.stringify(data, null, 2), "utf-8");
  dirty = false;
}

export function flushDesignsSync(): void {
  if (dirty) saveDesigns();
}

function hashPayload(payload: DesignSnapshotV1): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url").slice(0, 32);
}

export function getDesignById(id: string): DesignRecord | undefined {
  return designs.find((d) => d.id === id);
}

export function getSnapshot(
  designId: string,
  version: number
): DesignSnapshotRecord | undefined {
  return snapshots.find((s) => s.designId === designId && s.version === version);
}

export function listDesignsForCreator(wallet: string): DesignRecord[] {
  const w = normalizeWalletKey(wallet);
  return designs.filter((d) => d.creatorWallet === w);
}

export function listPublicDesigns(opts: {
  kind?: DesignKind;
  limit?: number;
}): DesignRecord[] {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
  let out = designs.filter((d) => d.visibility === "public");
  if (opts.kind) out = out.filter((d) => d.kind === opts.kind);
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out.slice(0, limit);
}

/** Designs the wallet may stamp (own, free public, or licensed). */
export function listPlaceableDesigns(
  wallet: string,
  opts: { kind?: DesignKind; limit?: number } = {}
): DesignRecord[] {
  const w = normalizeWalletKey(wallet);
  const limit = Math.min(200, Math.max(1, opts.limit ?? 80));
  const seen = new Set<string>();
  const out: DesignRecord[] = [];
  const push = (d: DesignRecord): void => {
    if (opts.kind && d.kind !== opts.kind) return;
    if (seen.has(d.id)) return;
    if (!hasEntitlement(w, d.id)) return;
    seen.add(d.id);
    out.push(d);
  };
  for (const d of designs) {
    if (d.creatorWallet === w) push(d);
  }
  for (const d of designs) {
    if (d.visibility === "public" && d.priceLuna === "0") push(d);
  }
  for (const e of entitlements) {
    if (e.wallet !== w) continue;
    const d = getDesignById(e.designId);
    if (d) push(d);
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out.slice(0, limit);
}

/** Latest snapshot payload when the wallet may place the design. */
export function getDesignSnapshotForWallet(
  wallet: string,
  designId: string
): DesignSnapshotV1 | null {
  if (!hasEntitlement(wallet, designId)) return null;
  const d = getDesignById(designId);
  if (!d) return null;
  const row = getSnapshot(d.id, d.version);
  return row?.payload ?? null;
}

export function hasEntitlement(wallet: string, designId: string): boolean {
  const w = normalizeWalletKey(wallet);
  const d = getDesignById(designId);
  if (!d) return false;
  if (d.creatorWallet === w) return true;
  if (d.visibility === "public" && d.priceLuna === "0") return true;
  return entitlements.some(
    (e) => e.wallet === w && e.designId === designId
  );
}

export function designToWire(d: DesignRecord) {
  return {
    id: d.id,
    kind: d.kind,
    creatorWallet: d.creatorWallet,
    name: d.name,
    description: d.description,
    tags: d.tags,
    version: d.version,
    footprintW: d.footprintW,
    footprintD: d.footprintD,
    priceLuna: d.priceLuna,
    hubStampAllowed: d.hubStampAllowed,
    visibility: d.visibility,
    updatedAt: d.updatedAt,
  };
}

export type PublishDesignInput = {
  kind: DesignKind;
  creatorWallet: string;
  sourceRoomId: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  name: string;
  description?: string;
  tags?: string[];
  visibility?: DesignVisibility;
  priceLuna?: bigint;
  hubStampAllowed?: boolean;
  placed: RoomPlacedMap;
  extraFloor?: RoomExtraFloorMap;
  baseFloorColors?: RoomBaseFloorColorMap;
};

export type PublishDesignResult =
  | { ok: true; design: DesignRecord }
  | { ok: false; code: string };

export function publishDesign(input: PublishDesignInput): PublishDesignResult {
  const bbox: DesignBbox = {
    minX: Math.floor(input.minX),
    maxX: Math.floor(input.maxX),
    minZ: Math.floor(input.minZ),
    maxZ: Math.floor(input.maxZ),
  };
  const bboxErr = validateBboxForKind(bbox, input.kind);
  if (bboxErr) return { ok: false, code: bboxErr };

  const captured = captureDesignSnapshot(
    input.placed,
    input.extraFloor,
    input.baseFloorColors,
    bbox
  );
  if ("error" in captured) return { ok: false, code: captured.error };

  const caps = designCapsForKind(input.kind);
  if (captured.obstacleCount > caps.maxObstacles) {
    return { ok: false, code: "too_many_obstacles" };
  }
  if (captured.obstacleCount === 0) {
    return { ok: false, code: "empty_selection" };
  }

  const { w, d } = footprintFromBbox(bbox);
  const name = String(input.name ?? "").trim().slice(0, 64);
  if (!name) return { ok: false, code: "name_required" };

  const visibility = input.visibility ?? "private";
  const priceLuna = (input.priceLuna ?? 0n).toString();
  const now = Date.now();
  const id = randomUUID();
  const payload = captured.snapshot;
  const version = 1;

  const design: DesignRecord = {
    id,
    kind: input.kind,
    creatorWallet: normalizeWalletKey(input.creatorWallet),
    name,
    description: String(input.description ?? "").trim().slice(0, 256),
    tags: (input.tags ?? []).map((t) => String(t).trim().slice(0, 32)).filter(Boolean).slice(0, 8),
    version,
    footprintW: w,
    footprintD: d,
    priceLuna,
    hubStampAllowed: Boolean(input.hubStampAllowed),
    visibility,
    contentHash: hashPayload(payload),
    createdAt: now,
    updatedAt: now,
  };

  designs.push(design);
  snapshots.push({
    designId: id,
    version,
    payload,
    obstacleCount: captured.obstacleCount,
  });
  dirty = true;
  saveDesigns();
  return { ok: true, design };
}

export function grantEntitlement(e: Omit<DesignEntitlement, "purchasedAt">): void {
  const wallet = normalizeWalletKey(e.wallet);
  const existing = entitlements.findIndex(
    (x) => x.wallet === wallet && x.designId === e.designId
  );
  const row: DesignEntitlement = { ...e, wallet, purchasedAt: Date.now() };
  if (existing >= 0) entitlements[existing] = row;
  else entitlements.push(row);
  dirty = true;
  saveDesigns();
}
