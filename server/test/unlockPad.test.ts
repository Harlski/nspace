import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "unlock-pad-"));
process.env.UNLOCK_PAD_GRANT_STORE_FILE = path.join(tmpDir, "grants.json");

const {
  clearUnlockPadGrantsForInstance,
  hasUnlockPadGrant,
  isUnlockPadPassableForMover,
  normalizeUnlockPadConfig,
  recordUnlockPadGrant,
} = await import("../src/unlockPad/index.js");

test("normalizeUnlockPadConfig accepts amount, recipient, label, proof mode", () => {
  const cfg = normalizeUnlockPadConfig({
    amountLuna: "1000000",
    recipient: "NQ01 TEST",
    buttonLabel: "Unlock path",
    proofMode: "optimistic",
    instanceId: "inst-1",
  });
  assert.ok(cfg);
  assert.equal(cfg.amountLuna, "1000000");
  assert.equal(cfg.recipient, "NQ01TEST");
  assert.equal(cfg.buttonLabel, "Unlock path");
  assert.equal(cfg.proofMode, "optimistic");
  assert.equal(cfg.instanceId, "inst-1");
});

test("normalizeUnlockPadConfig rejects missing instance or amount", () => {
  assert.equal(
    normalizeUnlockPadConfig({
      amountLuna: "",
      recipient: "NQ01",
      buttonLabel: "Unlock",
      proofMode: "payment_intent",
      instanceId: "x",
    }),
    null
  );
  assert.equal(
    normalizeUnlockPadConfig({
      amountLuna: "1",
      recipient: "NQ01",
      buttonLabel: "Unlock",
      proofMode: "optimistic",
      instanceId: "",
    }),
    null
  );
});

test("locked Unlock Pad is not passable without a grant", () => {
  const props = {
    passable: false,
    unlockPad: normalizeUnlockPadConfig({
      amountLuna: "1000000",
      recipient: "NQ01AAA",
      buttonLabel: "Unlock",
      proofMode: "optimistic",
      instanceId: "pad-a",
    })!,
  };
  assert.equal(
    isUnlockPadPassableForMover(props, "tutorial", "NQWALLET1"),
    false
  );
});

test("recordUnlockPadGrant makes pad passable for that wallet only", () => {
  const instanceId = "pad-b";
  const props = {
    passable: false,
    unlockPad: normalizeUnlockPadConfig({
      amountLuna: "1000000",
      recipient: "NQ01AAA",
      buttonLabel: "Unlock",
      proofMode: "optimistic",
      instanceId,
    })!,
  };
  const first = recordUnlockPadGrant({
    wallet: "NQ WALLET 1",
    roomId: "tutorial",
    instanceId,
  });
  assert.equal(first.ok, true);
  assert.equal(first.idempotent, false);
  assert.equal(hasUnlockPadGrant("NQWALLET1", "tutorial", instanceId), true);
  assert.equal(
    isUnlockPadPassableForMover(props, "tutorial", "NQWALLET1"),
    true
  );
  assert.equal(
    isUnlockPadPassableForMover(props, "tutorial", "NQWALLET2"),
    false
  );
  const second = recordUnlockPadGrant({
    wallet: "NQWALLET1",
    roomId: "tutorial",
    instanceId,
  });
  assert.equal(second.ok, true);
  assert.equal(second.idempotent, true);
});

test("clearing grants for an instance revokes walkability", () => {
  const instanceId = "pad-c";
  const props = {
    passable: false,
    unlockPad: normalizeUnlockPadConfig({
      amountLuna: "1",
      recipient: "NQ01",
      buttonLabel: "Unlock",
      proofMode: "payment_intent",
      instanceId,
    })!,
  };
  recordUnlockPadGrant({
    wallet: "NQW",
    roomId: "hub",
    instanceId,
  });
  assert.equal(isUnlockPadPassableForMover(props, "hub", "NQW"), true);
  clearUnlockPadGrantsForInstance("hub", instanceId);
  assert.equal(isUnlockPadPassableForMover(props, "hub", "NQW"), false);
});
