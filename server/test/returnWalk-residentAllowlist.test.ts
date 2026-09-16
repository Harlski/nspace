import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "return-walk-resident-"));
process.env.ADMIN_RUNTIME_SETTINGS_FILE = path.join(tmp, "admin-runtime-settings.json");
delete process.env.RESIDENT_ADDRESSES;
delete process.env.RETURN_WALK_SERVER_WALLET_ADDRESS;

const ENV_RESIDENT = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";
const RUNTIME_RESIDENT = "NQ21 F410 VXJB UK02 6TLG 8YHT 4M4B L664 NPM7";
const OTHER = "NQ12 34AB CDEF GHJK LMNP QRST UVWX YZ01 2345";

const {
  getReturnWalkConnectionsAdminJson,
  invalidateReturnWalkConfigCache,
  isResidentWallet,
  residentAllowlistConfigured,
  residentEnvConfigured,
} = await import("../src/returnWalk/config.js");
const { patchResidentAddresses } = await import(
  "../src/adminRuntimeSettingsStore.js"
);
const { adminConnectionsPageHtml } = await import(
  "../src/adminConnectionsPage.js"
);
const { SIGNED_IN_REQUIRED_MESSAGE } = await import(
  "../src/signedInRequired.js"
);
const { normalizeWalletAddressListField } = await import(
  "../src/walletAddresses.js"
);

after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("Resident allowlist (env + /admin/connections)", { concurrency: false }, () => {
  test("empty env and empty runtime fail closed", () => {
    delete process.env.RESIDENT_ADDRESSES;
    patchResidentAddresses("");
    invalidateReturnWalkConfigCache();
    assert.equal(isResidentWallet(ENV_RESIDENT), false);
    assert.equal(residentAllowlistConfigured(), false);
    assert.equal(residentEnvConfigured(), false);
  });

  test("runtime Resident is allowlisted without env", () => {
    delete process.env.RESIDENT_ADDRESSES;
    patchResidentAddresses(RUNTIME_RESIDENT);
    invalidateReturnWalkConfigCache();
    assert.equal(isResidentWallet(RUNTIME_RESIDENT), true);
    assert.equal(isResidentWallet(ENV_RESIDENT), false);
    assert.equal(isResidentWallet(OTHER), false);
    assert.equal(residentAllowlistConfigured(), true);
    assert.equal(residentEnvConfigured(), false);
    const snap = getReturnWalkConnectionsAdminJson();
    assert.match(snap.residentAddresses, /NQ21/);
    assert.equal(snap.residentEnvConfigured, false);
    assert.equal(snap.residentAllowlistConfigured, true);
  });

  test("env and runtime lists merge", () => {
    process.env.RESIDENT_ADDRESSES = ENV_RESIDENT;
    patchResidentAddresses(RUNTIME_RESIDENT);
    invalidateReturnWalkConfigCache();
    assert.equal(isResidentWallet(ENV_RESIDENT), true);
    assert.equal(isResidentWallet(RUNTIME_RESIDENT), true);
    assert.equal(isResidentWallet(OTHER), false);
    assert.equal(residentEnvConfigured(), true);
    const snap = getReturnWalkConnectionsAdminJson();
    assert.equal(snap.residentEnvConfigured, true);
    assert.match(snap.residentAddresses, /NQ21/);
    assert.doesNotMatch(snap.residentAddresses, /NQ97/);
  });

  test("clearing runtime keeps env Resident", () => {
    process.env.RESIDENT_ADDRESSES = ENV_RESIDENT;
    patchResidentAddresses("");
    invalidateReturnWalkConfigCache();
    assert.equal(isResidentWallet(ENV_RESIDENT), true);
    assert.equal(isResidentWallet(RUNTIME_RESIDENT), false);
    assert.equal(residentAllowlistConfigured(), true);
  });

  test("invalid checksum is rejected", () => {
    assert.throws(() => normalizeWalletAddressListField(OTHER), /invalid_nimiq_address/);
    assert.throws(() => patchResidentAddresses("not-a-wallet"));
  });

  test("/admin/connections HTML uses the Sign-in Gate and connections API", () => {
    const html = adminConnectionsPageHtml();
    assert.match(html, /\/admin\/connections/);
    assert.match(html, /\/api\/admin\/connections/);
    assert.equal(html.includes(SIGNED_IN_REQUIRED_MESSAGE), true);
    assert.equal(html.includes("Could not load"), false);
  });
});
