/** Whether a loaded snapshot still matches the selected place design. */
export function prefabPlaceSnapshotMatchesDesign(
  designId: string | null | undefined,
  snapshotDesignId: string | null | undefined
): boolean {
  if (!designId || !snapshotDesignId) return false;
  return designId === snapshotDesignId;
}

/** Clear snapshot binding when the selected design id changes. */
export function prefabPlaceSnapshotAfterDesignChange(
  prevDesignId: string | null | undefined,
  nextDesignId: string | null | undefined,
  snapshotDesignId: string | null | undefined
): string | null | undefined {
  if (!nextDesignId) return null;
  if (prevDesignId !== nextDesignId) return null;
  return snapshotDesignId;
}

/** Ignore async snapshot loads that completed after the user picked another prefab. */
export function shouldApplyPrefabPlaceSnapshot(
  currentDesignId: string | null | undefined,
  forDesignId: string | null | undefined
): boolean {
  if (forDesignId == null) return true;
  return currentDesignId === forDesignId;
}

/** Stable mesh-template key so obstacle layout changes invalidate the ghost. */
export function prefabPlaceMeshTemplateSignature(
  designId: string,
  footprintW: number,
  footprintD: number,
  yawSteps: number,
  obstacles: readonly { dx: number; dz: number; y: number }[]
): string {
  const layout = obstacles
    .map((o) => `${o.dx},${o.dz},${o.y}`)
    .sort()
    .join(";");
  return `${designId}|${footprintW}|${footprintD}|${yawSteps}|${layout}`;
}
