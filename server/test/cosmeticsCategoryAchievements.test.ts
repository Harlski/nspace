import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  achievementAvailability,
  shouldIgnoreAchievementProgress,
} from "../src/achievementAvailability.js";

describe("Cosmetics Category availability matrix", () => {
  it("Shop closed: shop-dependent rows unavailable; Framed stays in progress", () => {
    assert.equal(
      achievementAvailability({
        completed: false,
        featureDependency: "shop",
        shopOpen: false,
        shaperReachable: false,
      }),
      "temporarily_unavailable"
    );
    assert.equal(
      achievementAvailability({
        completed: false,
        featureDependency: "shaper",
        shopOpen: false,
        shaperReachable: false,
      }),
      "temporarily_unavailable"
    );
    assert.equal(
      achievementAvailability({
        completed: false,
        shopOpen: false,
        shaperReachable: false,
      }),
      "in_progress"
    );
  });

  it("Shop open, Shaper hidden: only shaper dependency is unavailable", () => {
    assert.equal(
      shouldIgnoreAchievementProgress({
        completed: false,
        featureDependency: "shop",
        shopOpen: true,
        shaperReachable: false,
      }),
      false
    );
    assert.equal(
      shouldIgnoreAchievementProgress({
        completed: false,
        featureDependency: "shaper",
        shopOpen: true,
        shaperReachable: false,
      }),
      true
    );
  });
});
