/**
 * Attention Marker domain module — parallel tile-keyed layout layer (ADR 0009).
 * Pure store ops; rooms.ts / Build Shell / persistence are adapters.
 */

export type AttentionMarker = {
  x: number;
  z: number;
  /** Visual lift steps above co-occupant top (or floor). */
  hoverHeight: number;
  /** Uniform visual scale as percent of full size (20..100, step 10). */
  sizePercent: number;
  /** Body + glow tint 0xRRGGBB. */
  colorRgb: number;
};

/** roomId → `${x},${z}` → marker */
export type AttentionMarkerStore = Map<string, Map<string, AttentionMarker>>;

export const ATTENTION_MARKER_HOVER_HEIGHT_DEFAULT = 1;
export const ATTENTION_MARKER_HOVER_HEIGHT_MAX = 3;
export const ATTENTION_MARKER_SIZE_PERCENT_DEFAULT = 100;
export const ATTENTION_MARKER_SIZE_PERCENT_MIN = 20;
export const ATTENTION_MARKER_SIZE_PERCENT_MAX = 100;
export const ATTENTION_MARKER_SIZE_PERCENT_STEP = 10;
export const ATTENTION_MARKER_COLOR_DEFAULT = 0xffffff;

export function createAttentionMarkerStore(): AttentionMarkerStore {
  return new Map();
}

export function attentionMarkerTileKey(x: number, z: number): string {
  return `${x},${z}`;
}

function clampHoverHeight(n: number): number {
  if (!Number.isFinite(n)) return ATTENTION_MARKER_HOVER_HEIGHT_DEFAULT;
  return Math.max(
    0,
    Math.min(ATTENTION_MARKER_HOVER_HEIGHT_MAX, Math.floor(n))
  );
}

export function clampAttentionMarkerSizePercent(n: number): number {
  if (!Number.isFinite(n)) return ATTENTION_MARKER_SIZE_PERCENT_DEFAULT;
  const stepped =
    Math.round(n / ATTENTION_MARKER_SIZE_PERCENT_STEP) *
    ATTENTION_MARKER_SIZE_PERCENT_STEP;
  return Math.max(
    ATTENTION_MARKER_SIZE_PERCENT_MIN,
    Math.min(ATTENTION_MARKER_SIZE_PERCENT_MAX, stepped)
  );
}

function clampColorRgb(n: number): number {
  if (!Number.isFinite(n)) return ATTENTION_MARKER_COLOR_DEFAULT;
  return Math.max(0, Math.min(0xffffff, Math.floor(n))) >>> 0;
}

export function normalizeAttentionMarker(
  raw: unknown
): AttentionMarker | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const x = Number(o.x);
  const z = Number(o.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const hoverHeight =
    o.hoverHeight === undefined
      ? ATTENTION_MARKER_HOVER_HEIGHT_DEFAULT
      : clampHoverHeight(Number(o.hoverHeight));
  const sizePercent =
    o.sizePercent === undefined
      ? ATTENTION_MARKER_SIZE_PERCENT_DEFAULT
      : clampAttentionMarkerSizePercent(Number(o.sizePercent));
  const colorRgb =
    o.colorRgb === undefined
      ? ATTENTION_MARKER_COLOR_DEFAULT
      : clampColorRgb(Number(o.colorRgb));
  return { x: xi, z: zi, hoverHeight, sizePercent, colorRgb };
}

function roomMap(
  store: AttentionMarkerStore,
  roomId: string
): Map<string, AttentionMarker> {
  let m = store.get(roomId);
  if (!m) {
    m = new Map();
    store.set(roomId, m);
  }
  return m;
}

export function upsertAttentionMarker(
  store: AttentionMarkerStore,
  roomId: string,
  raw: unknown
): AttentionMarker | null {
  const marker = normalizeAttentionMarker(raw);
  if (!marker) return null;
  const m = roomMap(store, roomId);
  m.set(attentionMarkerTileKey(marker.x, marker.z), marker);
  return marker;
}

export function removeAttentionMarker(
  store: AttentionMarkerStore,
  roomId: string,
  x: number,
  z: number
): boolean {
  const m = store.get(roomId);
  if (!m) return false;
  return m.delete(attentionMarkerTileKey(Math.floor(x), Math.floor(z)));
}

export function moveAttentionMarker(
  store: AttentionMarkerStore,
  roomId: string,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number
): AttentionMarker | null {
  const m = store.get(roomId);
  if (!m) return null;
  const fromKey = attentionMarkerTileKey(Math.floor(fromX), Math.floor(fromZ));
  const prev = m.get(fromKey);
  if (!prev) return null;
  const dest = normalizeAttentionMarker({
    x: toX,
    z: toZ,
    hoverHeight: prev.hoverHeight,
    sizePercent: prev.sizePercent,
    colorRgb: prev.colorRgb,
  });
  if (!dest) return null;
  m.delete(fromKey);
  m.set(attentionMarkerTileKey(dest.x, dest.z), dest);
  return dest;
}

export function listAttentionMarkers(
  store: AttentionMarkerStore,
  roomId: string
): AttentionMarker[] {
  const m = store.get(roomId);
  if (!m || m.size === 0) return [];
  return [...m.values()].sort((a, b) =>
    a.z !== b.z ? a.z - b.z : a.x - b.x
  );
}

export function replaceAllAttentionMarkers(
  store: AttentionMarkerStore,
  roomId: string,
  rawList: unknown
): AttentionMarker[] {
  const next = new Map<string, AttentionMarker>();
  if (Array.isArray(rawList)) {
    for (const raw of rawList) {
      const marker = normalizeAttentionMarker(raw);
      if (!marker) continue;
      next.set(attentionMarkerTileKey(marker.x, marker.z), marker);
    }
  }
  store.set(roomId, next);
  return listAttentionMarkers(store, roomId);
}

export function clearRoomAttentionMarkers(
  store: AttentionMarkerStore,
  roomId: string
): void {
  store.delete(roomId);
}

/** Snapshot for persistence / Build Shell (stable sort). */
export function serializeAttentionMarkers(
  store: AttentionMarkerStore,
  roomId: string
): AttentionMarker[] {
  return listAttentionMarkers(store, roomId);
}

/** Process-wide store used by rooms / persistence / Build Shell adapters. */
const globalAttentionMarkerStore = createAttentionMarkerStore();

export function getAttentionMarkerStore(): AttentionMarkerStore {
  return globalAttentionMarkerStore;
}

export function _resetAttentionMarkerStoreForTests(): void {
  globalAttentionMarkerStore.clear();
}

export function listRoomAttentionMarkers(roomId: string): AttentionMarker[] {
  return listAttentionMarkers(globalAttentionMarkerStore, roomId);
}

export function upsertRoomAttentionMarker(
  roomId: string,
  raw: unknown
): AttentionMarker | null {
  return upsertAttentionMarker(globalAttentionMarkerStore, roomId, raw);
}

export function removeRoomAttentionMarker(
  roomId: string,
  x: number,
  z: number
): boolean {
  return removeAttentionMarker(globalAttentionMarkerStore, roomId, x, z);
}

export function moveRoomAttentionMarker(
  roomId: string,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number
): AttentionMarker | null {
  return moveAttentionMarker(
    globalAttentionMarkerStore,
    roomId,
    fromX,
    fromZ,
    toX,
    toZ
  );
}

export function replaceRoomAttentionMarkers(
  roomId: string,
  rawList: unknown
): AttentionMarker[] {
  return replaceAllAttentionMarkers(
    globalAttentionMarkerStore,
    roomId,
    rawList
  );
}

export function clearRoomAttentionMarkersGlobal(roomId: string): void {
  clearRoomAttentionMarkers(globalAttentionMarkerStore, roomId);
}
