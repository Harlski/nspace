import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isBetweenUsEligibleWhisper,
  isComeOnInHostEligible,
  isTakeALookEligibleProfileView,
} from "../src/socialPlaySpaceAchievementEvaluator.js";

describe("Between Us / Take a Look / Come On In eligibility", () => {
  it("Between Us requires a wallet Whisper to another wallet", () => {
    assert.equal(
      isBetweenUsEligibleWhisper({
        senderAddress: "NQ07 A",
        targetAddress: "NQ07 B",
      }),
      true
    );
    assert.equal(
      isBetweenUsEligibleWhisper({
        senderAddress: "guest:1",
        targetAddress: "NQ07 B",
      }),
      false
    );
    assert.equal(
      isBetweenUsEligibleWhisper({
        senderAddress: "NQ07 A",
        targetAddress: "NQ07 A",
      }),
      false
    );
  });

  it("Take a Look requires viewing another player's profile", () => {
    assert.equal(
      isTakeALookEligibleProfileView({
        viewerAddress: "NQ07 A",
        profileAddress: "NQ07 B",
      }),
      true
    );
    assert.equal(
      isTakeALookEligibleProfileView({
        viewerAddress: "NQ07 A",
        profileAddress: "NQ07 A",
      }),
      false
    );
  });

  it("Come On In is host-only on first Guest land", () => {
    assert.equal(
      isComeOnInHostEligible({
        hostWallet: "NQ07 HOST",
        guestAddress: "guest:abc",
        guestAlreadyJoinedLobby: false,
      }),
      true
    );
    assert.equal(
      isComeOnInHostEligible({
        hostWallet: "NQ07 HOST",
        guestAddress: "guest:abc",
        guestAlreadyJoinedLobby: true,
      }),
      false
    );
    assert.equal(
      isComeOnInHostEligible({
        hostWallet: "NQ07 HOST",
        guestAddress: "NQ07 OTHER",
        guestAlreadyJoinedLobby: false,
      }),
      false
    );
  });
});
