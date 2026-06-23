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
