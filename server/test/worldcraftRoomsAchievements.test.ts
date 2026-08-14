import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countsTowardTwoKeys,
  isCompanyVisitorEligible,
  isExtraHandsEligibleBuilderList,
  isOpenHouseEligibleRoom,
  isRoomToRoomEligibleLink,
  publicRoomVisitorSeenKey,
  PUBLIC_ROOM_VISITOR_SEEN_PREFIX,
} from "../src/worldcraftRoomsAchievementEvaluator.js";

const OWNER = "NQ07 ALICE00000000000000000000000001";
const OTHER = "NQ07 BOB0000000000000000000000000001";

describe("Open House / Two Keys room eligibility", () => {
  it("accepts a public persisted player room and rejects private / official / Play Space", () => {
    assert.equal(
      isOpenHouseEligibleRoom({
        roomId: "alice01",
        isPublic: true,
        isOfficial: false,
      }),
      true
    );
    assert.equal(
      isOpenHouseEligibleRoom({
        roomId: "alice01",
        isPublic: false,
        isOfficial: false,
      }),
      false
    );
    assert.equal(
      isOpenHouseEligibleRoom({
        roomId: "alice01",
        isPublic: true,
        isOfficial: true,
      }),
      false
    );
    assert.equal(
      isOpenHouseEligibleRoom({
        roomId: "invite-lobby-abc",
        isPublic: true,
        isOfficial: false,
      }),
      false
    );
    assert.equal(
      countsTowardTwoKeys({ roomId: "alice01", isOfficial: false }),
      true
    );
    assert.equal(
      countsTowardTwoKeys({ roomId: "hub", isOfficial: false }),
      false
    );
  });
});

describe("Room to Room eligibility", () => {
  it("requires owned-to-owned different rooms and excludes Hub / Shaper / same room", () => {
    assert.equal(
      isRoomToRoomEligibleLink({
        sourceRoomId: "room-a",
        destRoomId: "room-b",
        sourceOwnerAddress: OWNER,
        destOwnerAddress: OWNER,
        actorAddress: OWNER,
      }),
      true
    );
    assert.equal(
      isRoomToRoomEligibleLink({
        sourceRoomId: "room-a",
        destRoomId: "room-a",
        sourceOwnerAddress: OWNER,
        destOwnerAddress: OWNER,
        actorAddress: OWNER,
      }),
      false
    );
    assert.equal(
      isRoomToRoomEligibleLink({
        sourceRoomId: "room-a",
        destRoomId: "hub",
        sourceOwnerAddress: OWNER,
        destOwnerAddress: OWNER,
        actorAddress: OWNER,
      }),
      false
    );
    assert.equal(
      isRoomToRoomEligibleLink({
        sourceRoomId: "room-a",
        destRoomId: "cosmetic-gallery",
        sourceOwnerAddress: OWNER,
        destOwnerAddress: OWNER,
        actorAddress: OWNER,
      }),
      false
    );
    assert.equal(
      isRoomToRoomEligibleLink({
        sourceRoomId: "room-a",
        destRoomId: "room-b",
        sourceOwnerAddress: OWNER,
        destOwnerAddress: OTHER,
        actorAddress: OWNER,
      }),
      false
    );
  });
});

describe("Extra Hands eligibility", () => {
  it("requires another wallet on the builder list", () => {
    assert.equal(
      isExtraHandsEligibleBuilderList({
        ownerAddress: OWNER,
        builderAddresses: [OTHER],
      }),
      true
    );
    assert.equal(
      isExtraHandsEligibleBuilderList({
        ownerAddress: OWNER,
        builderAddresses: [OWNER],
      }),
      false
    );
    assert.equal(
      isExtraHandsEligibleBuilderList({
        ownerAddress: OWNER,
        builderAddresses: [],
      }),
      false
    );
  });
});

describe("Company / Housewarming visitor ladder", () => {
  it("counts unique other wallets in public owned rooms; rejects owner, Guest, private", () => {
    assert.equal(
      isCompanyVisitorEligible({
        roomId: "alice01",
        isPublic: true,
        isOfficial: false,
        ownerAddress: OWNER,
        visitorAddress: OTHER,
      }),
      true
    );
    assert.equal(
      isCompanyVisitorEligible({
        roomId: "alice01",
        isPublic: false,
        isOfficial: false,
        ownerAddress: OWNER,
        visitorAddress: OTHER,
      }),
      false
    );
    assert.equal(
      isCompanyVisitorEligible({
        roomId: "alice01",
        isPublic: true,
        isOfficial: false,
        ownerAddress: OWNER,
        visitorAddress: OWNER,
      }),
      false
    );
    assert.equal(
      isCompanyVisitorEligible({
        roomId: "alice01",
        isPublic: true,
        isOfficial: false,
        ownerAddress: OWNER,
        visitorAddress: "guest:session-1",
      }),
      false
    );
    assert.ok(
      publicRoomVisitorSeenKey(OTHER).startsWith(PUBLIC_ROOM_VISITOR_SEEN_PREFIX)
    );
  });
});
