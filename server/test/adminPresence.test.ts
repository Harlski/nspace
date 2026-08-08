import assert from "node:assert/strict";
import test from "node:test";
import {
  adminInvisibleToggleRecipientAction,
  canToggleAdminInvisible,
  playerVisibleToViewer,
  playersVisibleToViewer,
  shouldSuppressChatBubble,
  worldMutationsBlockedByInvisibility,
} from "../src/adminPresence.js";

test("canToggleAdminInvisible requires game admin", () => {
  assert.equal(canToggleAdminInvisible(true), true);
  assert.equal(canToggleAdminInvisible(false), false);
});

test("playerVisibleToViewer: non-admin omits invisible peers; admin sees them", () => {
  const invisible = { adminInvisible: true };
  const visible = { adminInvisible: false };
  assert.equal(playerVisibleToViewer({ isGameAdmin: false }, invisible), false);
  assert.equal(playerVisibleToViewer({ isGameAdmin: false }, visible), true);
  assert.equal(playerVisibleToViewer({ isGameAdmin: true }, invisible), true);
  assert.equal(playerVisibleToViewer({ isGameAdmin: true }, visible), true);
});

test("playersVisibleToViewer filters the list for non-admins", () => {
  const list = [
    { address: "A", adminInvisible: false },
    { address: "B", adminInvisible: true },
    { address: "C", adminInvisible: false },
  ];
  assert.deepEqual(
    playersVisibleToViewer({ isGameAdmin: false }, list).map((p) => p.address),
    ["A", "C"]
  );
  assert.deepEqual(
    playersVisibleToViewer({ isGameAdmin: true }, list).map((p) => p.address),
    ["A", "B", "C"]
  );
});

test("shouldSuppressChatBubble only when invisible", () => {
  assert.equal(shouldSuppressChatBubble(true), true);
  assert.equal(shouldSuppressChatBubble(false), false);
});

test("worldMutationsBlockedByInvisibility only when invisible", () => {
  assert.equal(worldMutationsBlockedByInvisibility(true), true);
  assert.equal(worldMutationsBlockedByInvisibility(false), false);
});

test("adminInvisibleToggleRecipientAction includes owning admin for self cue", () => {
  assert.equal(
    adminInvisibleToggleRecipientAction({
      subjectAddress: "NQADMIN",
      recipientAddress: "NQADMIN",
      recipientIsGameAdmin: true,
      enabled: false,
    }),
    "stateDelta"
  );
  assert.equal(
    adminInvisibleToggleRecipientAction({
      subjectAddress: "NQADMIN",
      recipientAddress: "NQPLAYER",
      recipientIsGameAdmin: false,
      enabled: true,
    }),
    "playerLeft"
  );
  assert.equal(
    adminInvisibleToggleRecipientAction({
      subjectAddress: "NQADMIN",
      recipientAddress: "NQOPS2",
      recipientIsGameAdmin: true,
      enabled: true,
    }),
    "stateDelta"
  );
  assert.equal(
    adminInvisibleToggleRecipientAction({
      subjectAddress: "NQADMIN",
      recipientAddress: "NQPLAYER",
      recipientIsGameAdmin: false,
      enabled: false,
    }),
    "playerJoined"
  );
});
