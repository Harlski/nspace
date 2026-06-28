import assert from "node:assert/strict";
import test from "node:test";
import {
  TELESCOPE_ACHIEVEMENT_ID,
  countOnboardingPrerequisitesComplete,
  isAllOnboardingPrerequisitesComplete,
  listOnboardingPrerequisiteDefinitions,
} from "../src/onboardingComplete.js";

test("onboarding prerequisites exclude the telescope capstone", () => {
  const prereqs = listOnboardingPrerequisiteDefinitions();
  assert.ok(prereqs.length >= 9);
  assert.ok(!prereqs.some((d) => d.id === TELESCOPE_ACHIEVEMENT_ID));
  assert.ok(prereqs.every((d) => d.category === "onboarding"));
});

test("isAllOnboardingPrerequisitesComplete requires every prerequisite id", () => {
  const prereqs = listOnboardingPrerequisiteDefinitions();
  const all = new Set(prereqs.map((d) => d.id));
  assert.equal(isAllOnboardingPrerequisitesComplete(all), true);
  assert.equal(
    countOnboardingPrerequisitesComplete(all),
    prereqs.length
  );

  const missingOne = new Set(prereqs.slice(1).map((d) => d.id));
  assert.equal(isAllOnboardingPrerequisitesComplete(missingOne), false);
  assert.equal(
    countOnboardingPrerequisitesComplete(missingOne),
    prereqs.length - 1
  );
});
