import { describe, expect, it } from "vitest";
import {
  prefabPlaceSnapshotAfterDesignChange,
  prefabPlaceSnapshotMatchesDesign,
} from "./prefabPlacePreview.js";

describe("prefabPlaceSnapshotMatchesDesign", () => {
  it("is false when design and snapshot ids differ", () => {
    expect(prefabPlaceSnapshotMatchesDesign("b", "a")).toBe(false);
  });

  it("is true when ids match", () => {
    expect(prefabPlaceSnapshotMatchesDesign("a", "a")).toBe(true);
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
