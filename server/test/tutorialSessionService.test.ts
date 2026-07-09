import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-tutorial-"));
const storeFile = path.join(dir, "player-profiles.json");
process.env.PLAYER_PROFILE_STORE_FILE = storeFile;
process.env.TUTORIAL_ENABLED = "1";

before(async () => {
  await import("../src/playerProfileStore.js");
});

after(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.PLAYER_PROFILE_STORE_FILE;
  delete process.env.TUTORIAL_ENABLED;
  delete process.env.TUTORIAL_DOOR_AMOUNT_LUNA;
  delete process.env.TUTORIAL_DOOR_RECIPIENT;
});

test("needsTutorial is true for Pay wallet without completion, false after complete or for web", async () => {
  const {
    computeNeedsTutorial,
    completeTutorial,
  } = await import("../src/tutorialSessionService.js");

  const payWallet = "NQ07 PAY000000000000000000000000000001";
  assert.equal(computeNeedsTutorial(true, payWallet), true);
  assert.equal(computeNeedsTutorial(false, payWallet), false);

  const done = completeTutorial(payWallet, 1_000);
  assert.equal(done.ok, true);
  assert.equal(computeNeedsTutorial(true, payWallet), false);
});

test("two wallets get distinct stable mine slot assignments", async () => {
  const { ensureTutorialMineSlot } = await import("../src/tutorialSessionService.js");
  const slots = ["1,0", "2,0", "3,0"];
  const w1 = "NQ07 PAY000000000000000000000000000011";
  const w2 = "NQ07 PAY000000000000000000000000000012";

  const s1a = ensureTutorialMineSlot(w1, slots);
  const s2 = ensureTutorialMineSlot(w2, slots);
  const s1b = ensureTutorialMineSlot(w1, slots);

  assert.ok(s1a);
  assert.ok(s2);
  assert.notEqual(s1a, s2);
  assert.equal(s1a, s1b);
});

test("door-sent sets doorPaidAt and is idempotent", async () => {
  const {
    ackTutorialDoorSent,
    isTutorialGatePassableForWallet,
  } = await import("../src/tutorialSessionService.js");
  const { getTutorialProfileRow } = await import("../src/playerProfileStore.js");
  const wallet = "NQ07 PAY000000000000000000000000000021";

  const first = ackTutorialDoorSent(wallet, 5_000);
  assert.deepEqual(first, { ok: true, idempotent: false });
  assert.equal(isTutorialGatePassableForWallet(wallet), true);
  assert.equal(getTutorialProfileRow(wallet).tutorialSession?.doorPaidAt, 5_000);

  const second = ackTutorialDoorSent(wallet, 9_000);
  assert.deepEqual(second, { ok: true, idempotent: true });
  assert.equal(getTutorialProfileRow(wallet).tutorialSession?.doorPaidAt, 5_000);
});

test("unstick opens gate without completing tutorial", async () => {
  const {
    unstickTutorialGate,
    isTutorialGatePassableForWallet,
    completeTutorial,
  } = await import("../src/tutorialSessionService.js");
  const { getTutorialProfileRow } = await import("../src/playerProfileStore.js");
  const wallet = "NQ07 PAY000000000000000000000000000031";

  unstickTutorialGate(wallet, 3_000);
  assert.equal(isTutorialGatePassableForWallet(wallet), true);
  assert.equal(getTutorialProfileRow(wallet).tutorialCompletedAt, undefined);

  completeTutorial(wallet, 4_000);
  assert.equal(typeof getTutorialProfileRow(wallet).tutorialCompletedAt, "number");
});

test("abandon sets tutorialAbandonedAt while tutorial stays incomplete", async () => {
  const { abandonTutorial } = await import("../src/tutorialSessionService.js");
  const { getTutorialProfileRow } = await import("../src/playerProfileStore.js");
  const wallet = "NQ07 PAY000000000000000000000000000041";

  abandonTutorial(wallet, 8_000);
  const row = getTutorialProfileRow(wallet);
  assert.equal(row.tutorialAbandonedAt, 8_000);
  assert.equal(row.tutorialCompletedAt, undefined);
});

test("completed Pay wallet is rejected for direct Tutorial Room join", async () => {
  const {
    completeTutorial,
    evaluateTutorialRoomJoin,
  } = await import("../src/tutorialSessionService.js");
  const { TUTORIAL_ROOM_ID } = await import("../src/tutorial/config.js");
  const wallet = "NQ07 PAY000000000000000000000000000051";

  completeTutorial(wallet, 1);
  const blocked = evaluateTutorialRoomJoin({
    targetRoomId: TUTORIAL_ROOM_ID,
    wallet,
    sessionNimiqPay: true,
    isAdminOrBuilder: false,
  });
  assert.deepEqual(blocked, { ok: false, reason: "tutorial_complete_use_teleporter" });

  const viaTp = evaluateTutorialRoomJoin({
    targetRoomId: TUTORIAL_ROOM_ID,
    wallet,
    sessionNimiqPay: true,
    isAdminOrBuilder: false,
    viaTeleporter: true,
  });
  assert.deepEqual(viaTp, { ok: true });
});

test("welcome payload uses sandbox mode for completed teleporter entry", async () => {
  const {
    buildTutorialWelcomePayload,
    completeTutorial,
    ensureTutorialMineSlot,
  } = await import("../src/tutorialSessionService.js");
  const { TUTORIAL_ROOM_ID } = await import("../src/tutorial/config.js");
  const wallet = "NQ07 PAY000000000000000000000000000061";

  ensureTutorialMineSlot(wallet, ["0,0"]);
  completeTutorial(wallet, 2_000);

  const welcome = buildTutorialWelcomePayload({
    wallet,
    roomId: TUTORIAL_ROOM_ID,
    sessionNimiqPay: true,
    viaTeleporter: true,
    availableMineSlots: ["0,0"],
  });
  assert.ok(welcome);
  assert.equal(welcome.mode, "sandbox");
  assert.equal(welcome.lessonMode, false);
});

test("door-quote returns configured amount and memo", async () => {
  process.env.TUTORIAL_DOOR_AMOUNT_LUNA = "1000";
  process.env.TUTORIAL_DOOR_RECIPIENT = "NQ07 TEST000000000000000000000000000099";
  const { getTutorialDoorQuote } = await import("../src/tutorialSessionService.js");
  const wallet = "NQ07 PAY000000000000000000000000000071";
  const quote = getTutorialDoorQuote(wallet);
  assert.ok(quote);
  assert.equal(quote.amountLuna, "1000");
  assert.equal(quote.amountNim, "0.0100");
  assert.ok(quote.recipient.length > 0);
  assert.match(quote.memo, /tutorial-door:/);
});
