import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-tutorial-"));
const storeFile = path.join(dir, "player-profiles.json");
const adminSettingsFile = path.join(dir, "admin-runtime-settings.json");
process.env.PLAYER_PROFILE_STORE_FILE = storeFile;
process.env.ADMIN_RUNTIME_SETTINGS_FILE = adminSettingsFile;
process.env.TUTORIAL_ENABLED = "1";

before(async () => {
  await import("../src/playerProfileStore.js");
  const { patchAdminRuntimeSettings } = await import(
    "../src/adminRuntimeSettingsStore.js"
  );
  // Store DEFAULTS.tutorialEnabled is false; suite exercises the learner flow when on.
  patchAdminRuntimeSettings({ tutorialEnabled: true });
});

after(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.PLAYER_PROFILE_STORE_FILE;
  delete process.env.ADMIN_RUNTIME_SETTINGS_FILE;
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

test("door-quote falls back to advertise fund recipient when TUTORIAL_DOOR_RECIPIENT unset", async () => {
  delete process.env.TUTORIAL_DOOR_RECIPIENT;
  delete process.env.ADVERTISE_FUND_RECIPIENT_ADDRESS;
  const { getTutorialDoorQuote } = await import("../src/tutorialSessionService.js");
  const wallet = "NQ07 PAY000000000000000000000000000072";
  const quote = getTutorialDoorQuote(wallet);
  assert.ok(quote);
  assert.match(quote.recipient, /^NQ32\s/);
  assert.match(quote.memo, /tutorial-door:/);
});

test("tutorial mine claim accepts any claimable gold on step 1 including sandbox", async () => {
  const { tutorialTryFinalizeMineClaim } = await import(
    "../src/tutorial/roomsIntegration.js"
  );
  const { TUTORIAL_ROOM_ID } = await import("../src/tutorial/config.js");
  const wallet = "NQ07 PAY000000000000000000000000000091";

  const props = {
    passable: false,
    half: false,
    quarter: false,
    hex: false,
    pyramid: true,
    sphere: false,
    ramp: false,
    rampDir: 0,
    colorRgb: 0xf59e0b,
    claimable: true,
    active: true,
  };

  const first = tutorialTryFinalizeMineClaim({
    roomId: TUTORIAL_ROOM_ID,
    wallet,
    tileKey: "1,-5,0",
    props,
    sandboxMode: false,
    listMineSlots: () => ["0,-5,0", "1,-5,0"],
  });
  assert.equal(first.ok, true);
  if (first.ok) assert.ok(first.rewardLuna > 0n);

  const again = tutorialTryFinalizeMineClaim({
    roomId: TUTORIAL_ROOM_ID,
    wallet,
    tileKey: "0,-5,0",
    props,
    sandboxMode: false,
    listMineSlots: () => ["0,-5,0"],
  });
  assert.deepEqual(again, { ok: false, reason: "already_claimed" });

  const sandboxWallet = "NQ07 PAY000000000000000000000000000092";
  const sandbox = tutorialTryFinalizeMineClaim({
    roomId: TUTORIAL_ROOM_ID,
    wallet: sandboxWallet,
    tileKey: "-1,-5,0",
    props,
    sandboxMode: true,
    listMineSlots: () => [],
  });
  assert.equal(sandbox.ok, true);
  if (sandbox.ok) assert.equal(sandbox.rewardLuna, 0n);
});

test("resetTutorialProgress clears session and completion", async () => {
  const {
    completeTutorial,
    markTutorialMineComplete,
    resetTutorialProgress,
    getTutorialDoorQuote,
  } = await import("../src/tutorialSessionService.js");
  const { getTutorialProfileRow } = await import("../src/playerProfileStore.js");
  const wallet = "NQ07 PAY000000000000000000000000000088";
  markTutorialMineComplete(wallet, 1000);
  completeTutorial(wallet, 2000);
  const before = getTutorialProfileRow(wallet);
  assert.equal(typeof before.tutorialCompletedAt, "number");
  assert.equal(typeof before.tutorialSession?.mineCompletedAt, "number");
  const result = resetTutorialProgress(wallet);
  assert.equal(result.ok, true);
  const after = getTutorialProfileRow(wallet);
  assert.equal(after.tutorialCompletedAt, undefined);
  assert.equal(after.tutorialSession, undefined);
  assert.equal(after.tutorialAbandonedAt, undefined);
  // quote still available after reset
  process.env.TUTORIAL_DOOR_RECIPIENT = "NQ07 TEST000000000000000000000000000099";
  assert.ok(getTutorialDoorQuote(wallet));
});

test("tutorial welcome does not inject a virtual Hub exit door (Exit Teleporter is authored)", async () => {
  const { findTutorialHubExitDoor, doorsForWelcomeWithTutorialExit } =
    await import("../src/tutorial/roomsIntegration.js");
  const { ackTutorialDoorSent } = await import(
    "../src/tutorialSessionService.js"
  );
  const { TUTORIAL_ROOM_ID } = await import("../src/tutorial/config.js");
  const wallet = "NQ07 PAY000000000000000000000000000081";
  const placed = new Map([
    [
      "0,0,0",
      {
        unlockPad: { instanceId: "tutorial-path-unlock-pad-v1" },
      },
    ],
  ]);

  ackTutorialDoorSent(wallet, 9_000);
  assert.equal(
    findTutorialHubExitDoor({
      roomId: TUTORIAL_ROOM_ID,
      wallet,
      placed,
    }),
    null
  );
  assert.deepEqual(
    doorsForWelcomeWithTutorialExit(TUTORIAL_ROOM_ID, wallet, [], placed),
    []
  );
});

test("admin runtime toggle disables tutorial when env allows", async () => {
  const { patchAdminRuntimeSettings } = await import(
    "../src/adminRuntimeSettingsStore.js"
  );
  const {
    isTutorialFeatureEnabled,
    isTutorialEnvEnabled,
  } = await import("../src/tutorial/config.js");

  assert.equal(isTutorialEnvEnabled(), true);
  patchAdminRuntimeSettings({ tutorialEnabled: true });
  assert.equal(isTutorialFeatureEnabled(), true);

  patchAdminRuntimeSettings({ tutorialEnabled: false });
  assert.equal(isTutorialFeatureEnabled(), false);

  patchAdminRuntimeSettings({ tutorialEnabled: true });
  assert.equal(isTutorialFeatureEnabled(), true);
});

test("tutorial env defaults off when TUTORIAL_ENABLED unset", async () => {
  const prev = process.env.TUTORIAL_ENABLED;
  delete process.env.TUTORIAL_ENABLED;
  const { isTutorialEnvEnabled } = await import("../src/tutorial/config.js");
  assert.equal(isTutorialEnvEnabled(), false);
  process.env.TUTORIAL_ENABLED = prev ?? "1";
});

test("admins may join Tutorial Room when feature is off", async () => {
  const { patchAdminRuntimeSettings } = await import(
    "../src/adminRuntimeSettingsStore.js"
  );
  const { evaluateTutorialRoomJoin } = await import(
    "../src/tutorialSessionService.js"
  );
  const { TUTORIAL_ROOM_ID } = await import("../src/tutorial/config.js");
  const { teleporterMayTargetTutorialRoom } = await import(
    "../src/tutorial/roomsIntegration.js"
  );

  patchAdminRuntimeSettings({ tutorialEnabled: false });
  const learner = evaluateTutorialRoomJoin({
    targetRoomId: TUTORIAL_ROOM_ID,
    wallet: "NQ07 PAY000000000000000000000000000071",
    sessionNimiqPay: true,
    isAdminOrBuilder: false,
  });
  assert.deepEqual(learner, { ok: false, reason: "not_found" });

  const admin = evaluateTutorialRoomJoin({
    targetRoomId: TUTORIAL_ROOM_ID,
    wallet: "NQ07 ADM000000000000000000000000000001",
    sessionNimiqPay: false,
    isAdminOrBuilder: true,
  });
  assert.deepEqual(admin, { ok: true });
  assert.equal(teleporterMayTargetTutorialRoom(TUTORIAL_ROOM_ID, true), true);
  assert.equal(teleporterMayTargetTutorialRoom(TUTORIAL_ROOM_ID, false), false);

  patchAdminRuntimeSettings({ tutorialEnabled: true });
});

test("admin gets tutorial welcome when feature is off; reset clears completion", async () => {
  const { patchAdminRuntimeSettings } = await import(
    "../src/adminRuntimeSettingsStore.js"
  );
  const {
    buildTutorialWelcomePayload,
    completeTutorial,
    resetTutorialProgress,
    getTutorialCompletedAt,
  } = await import("../src/tutorialSessionService.js");
  const { buildTutorialWelcomeForConn } = await import(
    "../src/tutorial/roomsIntegration.js"
  );
  const { TUTORIAL_ROOM_ID } = await import("../src/tutorial/config.js");
  const adminWallet = "NQ07 ADM000000000000000000000000000002";

  patchAdminRuntimeSettings({ tutorialEnabled: false });
  assert.equal(
    buildTutorialWelcomeForConn({
      wallet: adminWallet,
      roomId: TUTORIAL_ROOM_ID,
      sessionNimiqPay: false,
      viaTeleporter: true,
      listMineSlots: () => ["0,0"],
      isAdmin: false,
    }),
    undefined
  );
  const welcome = buildTutorialWelcomeForConn({
    wallet: adminWallet,
    roomId: TUTORIAL_ROOM_ID,
    sessionNimiqPay: false,
    viaTeleporter: true,
    listMineSlots: () => ["0,0"],
    isAdmin: true,
  });
  assert.ok(welcome);

  completeTutorial(adminWallet, 3_000);
  assert.ok(typeof getTutorialCompletedAt(adminWallet) === "number");
  assert.deepEqual(resetTutorialProgress(adminWallet), { ok: true });
  assert.equal(getTutorialCompletedAt(adminWallet), undefined);
  assert.ok(
    buildTutorialWelcomePayload({
      wallet: adminWallet,
      roomId: TUTORIAL_ROOM_ID,
      sessionNimiqPay: false,
      viaTeleporter: true,
      availableMineSlots: ["0,0"],
      allowWhenFeatureOff: true,
    })
  );

  patchAdminRuntimeSettings({ tutorialEnabled: true });
});

test("resolveInitialRoomForPaySession sends incomplete Pay wallets to tutorial", async () => {
  const { resolveInitialRoomForPaySession } = await import(
    "../src/tutorial/roomsIntegration.js"
  );
  const { TUTORIAL_ROOM_ID } = await import("../src/tutorial/config.js");
  const { patchAdminRuntimeSettings } = await import(
    "../src/adminRuntimeSettingsStore.js"
  );
  const { completeTutorial } = await import("../src/tutorialSessionService.js");

  patchAdminRuntimeSettings({ tutorialEnabled: true });
  const incomplete = "NQ07 PAY000000000000000000000000000081";
  assert.equal(
    resolveInitialRoomForPaySession({
      wallet: incomplete,
      sessionNimiqPay: true,
      requestedRoomId: "chamber",
    }),
    TUTORIAL_ROOM_ID
  );

  completeTutorial(incomplete, 9_000);
  assert.equal(
    resolveInitialRoomForPaySession({
      wallet: incomplete,
      sessionNimiqPay: true,
      requestedRoomId: "chamber",
    }),
    "chamber"
  );

  patchAdminRuntimeSettings({ tutorialEnabled: false });
  const other = "NQ07 PAY000000000000000000000000000082";
  assert.equal(
    resolveInitialRoomForPaySession({
      wallet: other,
      sessionNimiqPay: true,
      requestedRoomId: "chamber",
    }),
    "chamber"
  );
  patchAdminRuntimeSettings({ tutorialEnabled: true });
});

test("tutorial room build is limited to admins and builder allowlist", async () => {
  process.env.TUTORIAL_BUILDER_ALLOWLIST =
    "NQ07 BUILD0000000000000000000000000001";
  const { canEditTutorialRoomContent } = await import("../src/tutorial/config.js");
  const learner = "NQ07 PAY000000000000000000000000000099";
  const builder = "NQ07 BUILD0000000000000000000000000001";

  assert.equal(canEditTutorialRoomContent(learner), false);
  assert.equal(canEditTutorialRoomContent(builder), true);

  delete process.env.TUTORIAL_BUILDER_ALLOWLIST;
});

test("tutorial room appears in room definitions when feature enabled", async () => {
  const { listRoomDefinitions } = await import("../src/roomLayouts.js");
  const { TUTORIAL_ROOM_ID } = await import("../src/tutorial/config.js");
  const ids = listRoomDefinitions().map((d) => d.id.trim().toLowerCase());
  assert.ok(ids.includes(TUTORIAL_ROOM_ID));
});
