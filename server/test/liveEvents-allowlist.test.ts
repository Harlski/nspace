import assert from "node:assert/strict";
import test from "node:test";
import { isLiveEventWallet, liveEventAllowlistConfigured } from "../src/liveEvents/allowlist.js";

const WALLET = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";
const OTHER = "NQ16 2SSN 82TL SMQS KXT3 Q01V CMAL NU6F 1LJG";

function withEnv(t: test.TestContext, value: string | undefined): void {
  const prev = process.env.LIVE_EVENT_ADDRESSES;
  if (value === undefined) delete process.env.LIVE_EVENT_ADDRESSES;
  else process.env.LIVE_EVENT_ADDRESSES = value;
  t.after(() => {
    if (prev === undefined) delete process.env.LIVE_EVENT_ADDRESSES;
    else process.env.LIVE_EVENT_ADDRESSES = prev;
  });
}

test("Live Event allowlist is fail-closed when unset", (t) => {
  withEnv(t, undefined);
  assert.equal(liveEventAllowlistConfigured(), false);
  assert.equal(isLiveEventWallet(WALLET), false);
});

test("Live Event allowlist matches compact or grouped Nimiq addresses", (t) => {
  withEnv(t, WALLET);
  assert.equal(liveEventAllowlistConfigured(), true);
  assert.equal(isLiveEventWallet(WALLET), true);
  assert.equal(isLiveEventWallet(WALLET.replace(/\s+/g, "")), true);
  assert.equal(isLiveEventWallet(OTHER), false);
});

test("Live Event allowlist accepts comma-separated wallets", (t) => {
  withEnv(t, `${WALLET}, ${OTHER}`);
  assert.equal(isLiveEventWallet(WALLET), true);
  assert.equal(isLiveEventWallet(OTHER), true);
});
