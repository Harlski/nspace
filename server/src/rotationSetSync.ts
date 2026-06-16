import {
  billboardToWire,
  getBillboardById,
  getBillboardsForRoom,
  listBillboardsWithRotationSet,
  setBillboardRotationContent,
  type Billboard,
} from "./billboards.js";
import { compileRotationSet, type CompiledRotationSet } from "./rotationSetCompile.js";

export function applyCompiledRotationToBillboard(
  billboardId: string,
  compiled: CompiledRotationSet,
  opts?: { bumpEpoch?: boolean }
): boolean {
  const bb = getBillboardById(billboardId);
  if (!bb || !bb.rotationSetId) return false;
  const now = Date.now();
  return setBillboardRotationContent(billboardId, {
    slides: compiled.slides,
    intervalMs: compiled.intervalMs,
    slideDurationsMs: compiled.slideDurationsMs,
    slideVisitNames: compiled.slideVisitNames,
    slideVisitUrls: compiled.slideVisitUrls,
    slideMiniappTargetUrls: compiled.slideMiniappTargetUrls,
    slideCampaignIds: compiled.slideCampaignIds,
    advertIds: compiled.advertIds,
    visitName: compiled.visitName,
    visitUrl: compiled.visitUrl,
    miniappTargetUrl: compiled.miniappTargetUrl,
    rotationRevision: compiled.revision,
    slideshowEpochMs: opts?.bumpEpoch ? now : bb.slideshowEpochMs ?? bb.createdAt,
  });
}

export function rebuildBillboardsForRotationSet(setId: string): number {
  const compiled = compileRotationSet(setId);
  if (!compiled) return 0;
  const billboards = listBillboardsWithRotationSet(setId);
  let updated = 0;
  for (const bb of billboards) {
    if (applyCompiledRotationToBillboard(bb.id, compiled)) updated++;
  }
  return updated;
}

export function rebuildAllRotationBillboards(): number {
  const ids = new Set<string>();
  for (const bb of listBillboardsWithRotationSet()) {
    if (bb.rotationSetId) ids.add(bb.rotationSetId);
  }
  let total = 0;
  for (const setId of ids) {
    total += rebuildBillboardsForRotationSet(setId);
  }
  return total;
}

export function broadcastRotationBillboardsInRoom(
  roomId: string,
  broadcast: (roomId: string, payload: unknown) => void
): void {
  broadcast(roomId, {
    type: "billboards",
    roomId,
    billboards: getBillboardsForRoom(roomId).map(billboardToWire),
  });
}

export function isRotationManagedBillboard(bb: Billboard): boolean {
  return Boolean(String(bb.rotationSetId ?? "").trim());
}
