import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TEMPORARILY_UNAVAILABLE_LABEL,
  achievementAvailability,
  countsTowardProgressOverview,
  shouldIgnoreAchievementProgress,
} from "../src/achievementAvailability.js";

describe("achievementAvailability", () => {
  it("keeps Complete even when the feature is off", () => {
    assert.equal(
      achievementAvailability({
        completed: true,
        featureDependency: "shop",
        shopOpen: false,
        shaperReachable: false,
      }),
      "complete"
    );
  });

  it("marks incomplete shop-dependent rows Temporarily unavailable when Shop is closed", () => {
    assert.equal(
      achievementAvailability({
        completed: false,
        featureDependency: "shop",
        shopOpen: false,
        shaperReachable: false,
      }),
      "temporarily_unavailable"
    );
    assert.equal(TEMPORARILY_UNAVAILABLE_LABEL, "Temporarily unavailable");
  });

  it("marks only shaper-dependent rows unavailable when Shop is open and The Shaper is hidden", () => {
    assert.equal(
      achievementAvailability({
        completed: false,
        featureDependency: "shop",
        shopOpen: true,
        shaperReachable: false,
      }),
      "in_progress"
    );
    assert.equal(
      achievementAvailability({
        completed: false,
        featureDependency: "shaper",
        shopOpen: true,
        shaperReachable: false,
      }),
      "temporarily_unavailable"
    );
  });

  it("does not label defs without a feature dependency (Football pause stays unlabeled)", () => {
    assert.equal(
      achievementAvailability({
        completed: false,
        shopOpen: false,
        shaperReachable: false,
      }),
      "in_progress"
    );
  });
});

describe("Progress Overview fraction filter", () => {
  it("omits incomplete Temporarily unavailable rows; Complete still counts", () => {
    assert.equal(
      countsTowardProgressOverview({
        completed: false,
        availability: "temporarily_unavailable",
      }),
      false
    );
    assert.equal(
      countsTowardProgressOverview({
        completed: true,
        availability: "temporarily_unavailable",
      }),
      true
    );
    assert.equal(
      countsTowardProgressOverview({
        completed: false,
        availability: "in_progress",
      }),
      true
    );
  });
});

describe("ignore progress while unavailable", () => {
  it("ignores incomplete shop-dependent progress when Shop is closed", () => {
    assert.equal(
      shouldIgnoreAchievementProgress({
        completed: false,
        featureDependency: "shop",
        shopOpen: false,
        shaperReachable: false,
      }),
      true
    );
    assert.equal(
      shouldIgnoreAchievementProgress({
        completed: true,
        featureDependency: "shop",
        shopOpen: false,
        shaperReachable: false,
      }),
      false
    );
    assert.equal(
      shouldIgnoreAchievementProgress({
        completed: false,
        featureDependency: "shop",
        shopOpen: true,
        shaperReachable: true,
      }),
      false
    );
  });
});
