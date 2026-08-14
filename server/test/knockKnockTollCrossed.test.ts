import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isKnockKnockEligibleVisit,
  isTollCrossedEligibleRoom,
} from "../src/explorationAchievementEvaluator.js";

describe("Knock Knock eligibility", () => {
  it("Completes only for another player's public persisted room", () => {
    assert.equal(
      isKnockKnockEligibleVisit({
        roomId: "alice-room",
        isPublic: true,
        isBuiltin: false,
        isOfficial: false,
        isPlaySpace: false,
        ownerAddress: "NQ07 ALICE00000000000000000000000001",
        visitorAddress: "NQ07 BOB0000000000000000000000000001",
      }),
      true
    );
  });

  it("rejects builtins, own rooms, private rooms, and Play Spaces", () => {
    const base = {
      roomId: "alice-room",
      isPublic: true,
      isBuiltin: false,
      isOfficial: false,
      isPlaySpace: false,
      ownerAddress: "NQ07 ALICE00000000000000000000000001",
      visitorAddress: "NQ07 BOB0000000000000000000000000001",
    };
    assert.equal(isKnockKnockEligibleVisit({ ...base, isBuiltin: true }), false);
    assert.equal(isKnockKnockEligibleVisit({ ...base, isOfficial: true }), false);
    assert.equal(isKnockKnockEligibleVisit({ ...base, isPublic: false }), false);
    assert.equal(isKnockKnockEligibleVisit({ ...base, isPlaySpace: true }), false);
    assert.equal(
      isKnockKnockEligibleVisit({
        ...base,
        visitorAddress: "NQ07 ALICE00000000000000000000000001",
      }),
      false
    );
    assert.equal(
      isKnockKnockEligibleVisit({ ...base, ownerAddress: null }),
      false
    );
  });
});

describe("Toll Crossed eligibility", () => {
  it("accepts non-tutorial rooms and rejects Tutorial Room / Staging", () => {
    assert.equal(isTollCrossedEligibleRoom("hub"), true);
    assert.equal(isTollCrossedEligibleRoom("alice-room"), true);
    assert.equal(isTollCrossedEligibleRoom("tutorial"), false);
    assert.equal(isTollCrossedEligibleRoom("tutorial-staging"), false);
    assert.equal(isTollCrossedEligibleRoom("TUTORIAL"), false);
  });
});
