import { describe, expect, it } from "vitest";
import {
  prefabPlaceMeshTemplateSignature,
  prefabPlaceSnapshotAfterDesignChange,
  prefabPlaceSnapshotMatchesDesign,
  shouldApplyPrefabPlaceSnapshot,
} from "./prefabPlacePreview.js";

describe("prefabPlaceSnapshotMatchesDesign", () => {
  it("is false when design and snapshot ids differ", () => {
    expect(prefabPlaceSnapshotMatchesDesign("b", "a")).toBe(false);
  });

  it("is true when ids match", () => {
    expect(prefabPlaceSnapshotMatchesDesign("a", "a")).toBe(true);
  });
});

describe("shouldApplyPrefabPlaceSnapshot", () => {
  it("rejects stale loads when selection changed", () => {
    expect(shouldApplyPrefabPlaceSnapshot("b", "a")).toBe(false);
  });

  it("accepts loads for the current selection", () => {
    expect(shouldApplyPrefabPlaceSnapshot("a", "a")).toBe(true);
  });

  it("allows explicit clears", () => {
    expect(shouldApplyPrefabPlaceSnapshot("a", null)).toBe(true);
  });
});

describe("prefabPlaceMeshTemplateSignature", () => {
  it("differs when obstacle layout differs at same count", () => {
    const a = prefabPlaceMeshTemplateSignature("d", 1, 1, 0, [
      { dx: 0, dz: 0, y: 0 },
      { dx: 0, dz: 0, y: 1 },
    ]);
    const b = prefabPlaceMeshTemplateSignature("d", 1, 1, 0, [
      { dx: 0, dz: 0, y: 0 },
      { dx: 0, dz: 0, y: 2 },
    ]);
    expect(a).not.toBe(b);
  });
});

describe("prefabPlaceSnapshotAfterDesignChange", () => {
  it("clears snapshot binding when design id changes", () => {
    expect(
      prefabPlaceSnapshotAfterDesignChange("a", "b", "a")
    ).toBeNull();
  });

  it("keeps snapshot binding when design id is unchanged", () => {
    expect(
      prefabPlaceSnapshotAfterDesignChange("a", "a", "a")
    ).toBe("a");
  });

  it("clears binding when design is cleared", () => {
    expect(
      prefabPlaceSnapshotAfterDesignChange("a", null, "a")
    ).toBeNull();
  });
});
